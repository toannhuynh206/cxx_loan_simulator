#include "AmortizationCalculator.h"
#include <cmath>
#include <stdexcept>
#include <algorithm>
#include <iomanip>
#include <sstream>

// ============================================================
// CALCULATION ASSUMPTIONS
// ============================================================
//
// INTEREST TIMING
//   Interest accrues at the START of each monthly period on the
//   outstanding balance. The payment is then applied at the END of
//   that period, covering interest first and reducing principal
//   with the remainder. This mirrors how lenders actually apply
//   payments on the due date.
//
//   Formula per month:
//     interest      = balance × monthly_rate
//     payment       = min(scheduled_payment, balance + interest)
//     principal_paid = payment - interest
//     new_balance   = balance + interest - payment
//
// RATE MODELS BY LOAN TYPE
//   Credit card        →  APR / 365 × 30  (daily accrual, 30-day cycle)
//   Personal loan      →  APR / 12        (actuarial monthly, Reg Z)
//   Auto loan          →  APR / 12        (actuarial monthly, Reg Z)
//   Mortgage           →  APR / 12        (actuarial monthly, Reg Z / CFPB)
//   Student loan       →  APR / 12        (actuarial monthly, Dept. of Ed.)
//
// AMORTIZATION PAYMENT FORMULA
//   M = P × [r(1+r)^n] / [(1+r)^n - 1]
//   where:
//     P = principal
//     r = monthly rate (APR/12 or APR/365×30 depending on type)
//     n = term in months
//   Derived so that exactly n equal payments zero the balance.
//
// MORTGAGE SPECIFICS
//   - P&I payment is calculated via the amortization formula.
//   - Escrow (taxes + insurance + HOA) is added on top.
//   - PMI is charged when LTV > 80%, automatically cancelled at 78% LTV
//     or requestable at 80% LTV after 24 months (Homeowners Protection Act).
//   - totalPaid = P&I payments + PMI + escrow.
//
// AUTO LOAN SPECIFICS
//   - Vehicle depreciation is tracked separately for informational display.
//   - New car: 25% year 1, 15% thereafter (annual, applied monthly).
//   - Used car: 15% year 1, 10% thereafter (annual, applied monthly).
//   - Depreciation does not affect the loan amortization schedule.
//
// CREDIT CARD SPECIFICS
//   - Minimum payment = max(balance × minimumPaymentPercent, minimumPaymentFloor).
//   - If no payment is provided, the minimum payment is used.
//   - No fixed term — schedule runs until balance reaches zero.
//
// STUDENT LOAN SPECIFICS
//   - Standard plan: 120-month term (10 years).
//   - Extended plan: 300-month term (25 years).
//   - Graduated: 120-month term (same as standard — 10 years).
//   - Payment is calculated via amortization formula if not provided.
//
// ============================================================

namespace loan {

namespace {
constexpr double kPaymentEpsilon = 0.01;

bool isSupportedLoanType(const std::string& type) {
    return type == "credit-card" ||
           type == "personal-loan" ||
           type == "auto-loan" ||
           type == "mortgage" ||
           type == "student-loan";
}

bool isSupportedCascadeStrategy(const std::string& strategy) {
    return strategy == "avalanche" ||
           strategy == "snowball" ||
           strategy == "standard";
}

std::string formatDollars(double value) {
    std::ostringstream oss;
    oss << std::fixed << std::setprecision(2) << value;
    return oss.str();
}

void validatePaymentCoversFirstMonthInterest(
    double principal,
    double monthlyRate,
    double payment,
    const std::string& loanLabel
) {
    if (principal <= 0 || payment <= 0) {
        return;
    }

    const double firstMonthInterest = principal * monthlyRate;
    if (payment <= firstMonthInterest + 1e-9) {
        throw std::invalid_argument(
            loanLabel + " monthly payment must exceed first-month interest ($" +
            formatDollars(firstMonthInterest) + ")."
        );
    }
}
} // namespace

bool AmortizationCalculator::validateInput(const LoanRequest& request, std::string& error) {
    if (request.principal <= 0) {
        error = "Principal must be positive";
        return false;
    }

    if (request.apr < 0 || request.apr > 100) {
        error = "APR must be between 0 and 100";
        return false;
    }

    if (request.monthlyPayment <= 0) {
        error = "Monthly payment must be positive";
        return false;
    }

    // Check payment covers at least the first month's interest.
    // This legacy endpoint uses the actuarial monthly model (APR/12) only — it is
    // not used for credit cards (which go through calculate-multiple or calculate-cascade).
    double firstMonthInterest = request.principal * installmentMonthlyRate(request.apr);
    if (request.monthlyPayment <= firstMonthInterest) {
        error = "Monthly payment must exceed monthly interest ($" +
                formatDollars(firstMonthInterest) +
                ") to pay off loan";
        return false;
    }

    return true;
}

double AmortizationCalculator::calculateAmortizationPayment(double principal, double rate, int months) const {
    if (months <= 0) {
        throw std::invalid_argument("Loan term must be at least 1 month");
    }
    if (rate == 0) {
        return principal / months;
    }
    double factor = std::pow(1 + rate, months);
    double denominator = factor - 1.0;
    // Guard against floating-point underflow on very small rates
    if (denominator < 1e-12) {
        return principal / months;
    }
    return principal * (rate * factor) / denominator;
}

// monthlyRate is pre-computed by the caller using the correct model for the loan type.
// Interest accrues first, then payment is applied (interest first, then principal).
void AmortizationCalculator::buildSimpleSchedule(
    double principal,
    double monthlyRate,
    double scheduledPayment,
    int maxMonths,
    std::vector<MonthlyEvent>& events,
    double& totalInterest,
    double& totalPaid,
    int& totalMonths
) const {
    events.clear();
    totalInterest = 0.0;
    totalPaid = 0.0;
    totalMonths = 0;

    if (principal <= 0 || scheduledPayment <= 0) {
        return;
    }

    double balance = principal;
    int month = 0;
    const int safeMaxMonths = maxMonths > 0 ? maxMonths : 1200;

    while (balance > 0.01 && month < safeMaxMonths) {
        month++;

        MonthlyEvent event;
        event.month = month;
        event.startBalance = balance;
        event.pmiPayment = 0.0;
        event.escrowPayment = 0.0;

        // Interest accrues on the balance at the start of this period
        event.interest = balance * monthlyRate;
        totalInterest += event.interest;

        // Payment covers interest first, remainder reduces principal
        event.payment = std::min(scheduledPayment, balance + event.interest);
        event.principalPaid = std::max(0.0, event.payment - event.interest);
        balance = balance + event.interest - event.payment;

        event.endBalance = std::max(0.0, balance);
        event.totalPayment = event.payment;
        totalPaid += event.totalPayment;
        events.push_back(event);
    }

    totalMonths = month;
}

// ============================================
// LEGACY CALCULATE (generic, uses APR/12)
// ============================================
LoanResponse AmortizationCalculator::calculate(const LoanRequest& request) {
    std::string error;
    if (!validateInput(request, error)) {
        throw std::invalid_argument(error);
    }

    LoanResponse response;
    response.principal = request.principal;
    response.apr = request.apr;
    response.monthlyPayment = request.monthlyPayment;
    response.totalInterest = 0.0;
    response.totalPaid = 0.0;
    response.totalPMI = 0.0;
    response.totalEscrow = 0.0;

    buildSimpleSchedule(
        request.principal,
        installmentMonthlyRate(request.apr),
        request.monthlyPayment,
        1200,
        response.events,
        response.totalInterest,
        response.totalPaid,
        response.totalMonths
    );
    return response;
}

// ============================================
// CREDIT CARD  —  APR / 365 × 30 (daily accrual model)
// ============================================
LoanCalculationResult AmortizationCalculator::calculateCreditCard(const CreditCardEntry& entry) {
    if (entry.balance <= 0) {
        throw std::invalid_argument("Credit card balance must be greater than 0");
    }
    if (entry.apr < 0 || entry.apr > 100) {
        throw std::invalid_argument("Credit card APR must be between 0 and 100");
    }
    if (entry.monthlyPayment < 0) {
        throw std::invalid_argument("Credit card monthlyPayment cannot be negative");
    }
    if (entry.minimumPaymentPercent < 0 || entry.minimumPaymentPercent > 100) {
        throw std::invalid_argument("Credit card minimumPaymentPercent must be between 0 and 100");
    }
    if (entry.minimumPaymentFloor < 0) {
        throw std::invalid_argument("Credit card minimumPaymentFloor cannot be negative");
    }

    LoanCalculationResult result;
    result.loanId = entry.id;
    result.loanName = entry.name;
    result.loanType = entry.type;
    result.principal = entry.balance;
    result.interestRate = entry.apr;
    result.totalInterest = 0.0;
    result.totalPaid = 0.0;
    result.totalPMI = 0.0;
    result.totalEscrow = 0.0;
    result.vehicleValue = 0.0;
    result.equityPercent = 0.0;

    // Credit cards use the daily accrual model: APR / 365 × 30
    double rate = creditCardMonthlyRate(entry.apr);

    double minPaymentByPercent = entry.balance * (entry.minimumPaymentPercent / 100.0);
    double policyMinimum = std::max(minPaymentByPercent, entry.minimumPaymentFloor);
    double interestFloor = entry.balance * rate + kPaymentEpsilon;
    result.minimumPayment = std::max(policyMinimum, interestFloor);

    double payment = entry.monthlyPayment > 0 ? entry.monthlyPayment : result.minimumPayment;
    validatePaymentCoversFirstMonthInterest(entry.balance, rate, payment, "Credit card");
    result.monthlyPayment = payment;

    buildSimpleSchedule(
        entry.balance,
        rate,
        payment,
        1200,
        result.events,
        result.totalInterest,
        result.totalPaid,
        result.totalMonths
    );
    return result;
}

// ============================================
// PERSONAL LOAN  —  APR / 12 (actuarial monthly model)
// ============================================
LoanCalculationResult AmortizationCalculator::calculatePersonalLoan(const PersonalLoanEntry& entry) {
    if (entry.balance <= 0) {
        throw std::invalid_argument("Personal loan balance must be greater than 0");
    }
    if (entry.interestRate < 0 || entry.interestRate > 100) {
        throw std::invalid_argument("Personal loan APR/interestRate must be between 0 and 100");
    }
    if (entry.termMonths <= 0) {
        throw std::invalid_argument("Personal loan termMonths must be greater than 0");
    }
    if (entry.monthlyPayment < 0) {
        throw std::invalid_argument("Personal loan monthlyPayment cannot be negative");
    }

    LoanCalculationResult result;
    result.loanId = entry.id;
    result.loanName = entry.name;
    result.loanType = entry.type;
    result.principal = entry.balance;
    result.interestRate = entry.interestRate;
    result.totalInterest = 0.0;
    result.totalPaid = 0.0;
    result.totalPMI = 0.0;
    result.totalEscrow = 0.0;
    result.minimumPayment = 0.0;
    result.vehicleValue = 0.0;
    result.equityPercent = 0.0;

    // Personal loans use the actuarial monthly model: APR / 12
    double rate = installmentMonthlyRate(entry.interestRate);

    double payment = entry.monthlyPayment;
    if (payment <= 0 && entry.termMonths > 0) {
        payment = calculateAmortizationPayment(entry.balance, rate, entry.termMonths);
    }
    validatePaymentCoversFirstMonthInterest(entry.balance, rate, payment, "Personal loan");
    result.monthlyPayment = payment;

    buildSimpleSchedule(
        entry.balance,
        rate,
        payment,
        entry.termMonths > 0 ? entry.termMonths : 1200,
        result.events,
        result.totalInterest,
        result.totalPaid,
        result.totalMonths
    );
    return result;
}

// ============================================
// AUTO LOAN  —  APR / 12 (actuarial monthly model)
// ============================================
LoanCalculationResult AmortizationCalculator::calculateAutoLoan(const AutoLoanEntry& entry) {
    const bool existingMode = entry.inputMode == "existing";

    // vehiclePrice is only required in future (planning) mode
    if (!existingMode && entry.vehiclePrice <= 0) {
        throw std::invalid_argument("Auto loan vehiclePrice must be greater than 0");
    }
    if (entry.balance <= 0) {
        throw std::invalid_argument("Auto loan balance must be greater than 0");
    }
    if (entry.interestRate < 0 || entry.interestRate > 100) {
        throw std::invalid_argument("Auto loan APR/interestRate must be between 0 and 100");
    }
    if (entry.termMonths <= 0) {
        throw std::invalid_argument("Auto loan termMonths must be greater than 0");
    }
    if (entry.downPayment < 0 || entry.tradeInValue < 0 || entry.tradeInPayoff < 0) {
        throw std::invalid_argument("Auto loan optional amounts cannot be negative");
    }
    if (entry.monthlyPayment < 0) {
        throw std::invalid_argument("Auto loan monthlyPayment cannot be negative");
    }

    LoanCalculationResult result;
    result.loanId = entry.id;
    result.loanName = entry.name;
    result.loanType = entry.type;
    result.principal = entry.balance;
    result.interestRate = entry.interestRate;
    result.totalInterest = 0.0;
    result.totalPaid = 0.0;
    result.totalPMI = 0.0;
    result.totalEscrow = 0.0;
    result.minimumPayment = 0.0;
    result.equityPercent = 0.0;

    // Auto loans use the actuarial monthly model: APR / 12
    double rate = installmentMonthlyRate(entry.interestRate);
    double calculatedPayment = calculateAmortizationPayment(entry.balance, rate, entry.termMonths);
    double payment = calculatedPayment;

    if (existingMode) {
        if (entry.monthlyPayment <= 0) {
            throw std::invalid_argument("Auto loan monthlyPayment must be greater than 0 in existing mode");
        }
        // Existing-loan mode trusts the user's contractual payment.
        payment = entry.monthlyPayment;
    } else {
        // Future mode: use user-specified payment if provided, otherwise calculated minimum.
        payment = (entry.monthlyPayment > 0) ? entry.monthlyPayment : calculatedPayment;
        if (payment < calculatedPayment) payment = calculatedPayment; // floor at amortization min
    }
    validatePaymentCoversFirstMonthInterest(entry.balance, rate, payment, "Auto loan");

    result.monthlyPayment = payment;

    buildSimpleSchedule(
        entry.balance,
        rate,
        payment,
        entry.termMonths,
        result.events,
        result.totalInterest,
        result.totalPaid,
        result.totalMonths
    );

    // Depreciation tracking: only when vehiclePrice is known (future mode or provided)
    double vehicleValue = entry.vehiclePrice;
    if (vehicleValue > 0) {
        double annualDepreciation = entry.isUsed ? 0.10 : 0.15;
        double firstYearBonus = entry.isUsed ? 0.05 : 0.10;
        for (int month = 1; month <= result.totalMonths; month++) {
            double monthlyDepreciation;
            if (month <= 12) {
                monthlyDepreciation = vehicleValue * (annualDepreciation + firstYearBonus) / 12.0;
            } else {
                monthlyDepreciation = vehicleValue * annualDepreciation / 12.0;
            }
            vehicleValue = std::max(0.0, vehicleValue - monthlyDepreciation);
        }
    }

    result.vehicleValue = vehicleValue;
    return result;
}

// ============================================
// MORTGAGE  —  APR / 12 (actuarial monthly model)
// PITI: Principal, Interest, Taxes, Insurance with PMI tracking
// ============================================
LoanCalculationResult AmortizationCalculator::calculateMortgage(const MortgageEntry& entry) {
    const bool existingModeMtg = entry.inputMode == "existing";

    // homePrice is only required in future (planning) mode
    if (!existingModeMtg && entry.homePrice <= 0) {
        throw std::invalid_argument("Mortgage homePrice must be greater than 0");
    }
    if (entry.balance <= 0) {
        throw std::invalid_argument("Mortgage balance must be greater than 0");
    }
    if (entry.interestRate < 0 || entry.interestRate > 100) {
        throw std::invalid_argument("Mortgage interestRate must be between 0 and 100");
    }
    if (entry.termYears <= 0) {
        throw std::invalid_argument("Mortgage termYears must be greater than 0");
    }
    if (entry.downPayment < 0 || entry.propertyTaxAnnual < 0 ||
        entry.homeInsuranceAnnual < 0 || entry.pmiRate < 0 || entry.hoaMonthly < 0) {
        throw std::invalid_argument("Mortgage optional amounts cannot be negative");
    }
    if (entry.monthlyPayment < 0) {
        throw std::invalid_argument("Mortgage monthlyPayment cannot be negative");
    }

    LoanCalculationResult result;
    result.loanId = entry.id;
    result.loanName = entry.name;
    result.loanType = entry.type;
    result.principal = entry.balance;
    result.interestRate = entry.interestRate;
    result.totalInterest = 0.0;
    result.totalPaid = 0.0;
    result.totalPMI = 0.0;
    result.totalEscrow = 0.0;
    result.minimumPayment = 0.0;
    result.vehicleValue = 0.0;

    int termMonths = entry.termYears * 12;

    // Mortgage uses the actuarial monthly model: APR / 12
    double rate = installmentMonthlyRate(entry.interestRate);
    const double calculatedPiPayment = calculateAmortizationPayment(entry.balance, rate, termMonths);
    double piPayment = calculatedPiPayment;
    if (existingModeMtg) {
        if (entry.monthlyPayment <= 0) {
            throw std::invalid_argument("Mortgage monthlyPayment must be greater than 0 in existing mode");
        }
        // Existing-loan mode expects the known P&I payment from statement.
        piPayment = entry.monthlyPayment;
    } else if (entry.monthlyPayment > 0) {
        // Future mode: use user-specified payment; floor at amortization minimum.
        piPayment = std::max(entry.monthlyPayment, calculatedPiPayment);
    }
    validatePaymentCoversFirstMonthInterest(entry.balance, rate, piPayment, "Mortgage");

    double monthlyTax = entry.propertyTaxAnnual / 12.0;
    double monthlyInsurance = entry.homeInsuranceAnnual / 12.0;
    double escrowPayment = entry.includeEscrow ? (monthlyTax + monthlyInsurance + entry.hoaMonthly) : 0.0;

    // PMI only applies when homePrice is known (future mode)
    double originalLTV = (entry.homePrice > 0) ? (entry.balance / entry.homePrice) : 1.0;
    double monthlyPMI = 0.0;
    if (originalLTV > 0.80 && entry.pmiRate > 0 && entry.homePrice > 0) {
        monthlyPMI = (entry.balance * entry.pmiRate / 100.0) / 12.0;
    }

    result.monthlyPayment = piPayment + escrowPayment + monthlyPMI;

    buildSimpleSchedule(
        entry.balance,
        rate,
        piPayment,
        termMonths,
        result.events,
        result.totalInterest,
        result.totalPaid,
        result.totalMonths
    );

    for (size_t i = 0; i < result.events.size(); ++i) {
        MonthlyEvent& event = result.events[i];
        if (entry.homePrice > 0) {
            double currentLTV = event.endBalance / entry.homePrice;
            if (currentLTV <= 0.78) {
                event.pmiPayment = 0.0;
            } else if (currentLTV <= 0.80 && event.month > 24) {
                event.pmiPayment = 0.0;
            } else {
                event.pmiPayment = monthlyPMI;
            }
        } else {
            event.pmiPayment = 0.0;
        }
        result.totalPMI += event.pmiPayment;

        event.escrowPayment = escrowPayment;
        result.totalEscrow += event.escrowPayment;

        event.totalPayment = event.payment + event.pmiPayment + event.escrowPayment;
        result.totalPaid += (event.pmiPayment + event.escrowPayment);
    }

    double endingBalance = result.events.empty() ? entry.balance : result.events.back().endBalance;
    if (entry.homePrice > 0) {
        result.equityPercent = ((entry.homePrice - endingBalance) / entry.homePrice) * 100.0;
    } else {
        result.equityPercent = 0.0;
    }
    return result;
}

// ============================================
// STUDENT LOAN  —  APR / 12 (actuarial monthly model)
// ============================================
LoanCalculationResult AmortizationCalculator::calculateStudentLoan(const StudentLoanEntry& entry) {
    if (entry.balance <= 0) {
        throw std::invalid_argument("Student loan balance must be greater than 0");
    }
    if (entry.interestRate < 0 || entry.interestRate > 100) {
        throw std::invalid_argument("Student loan APR/interestRate must be between 0 and 100");
    }
    if (entry.monthlyPayment < 0) {
        throw std::invalid_argument("Student loan monthlyPayment cannot be negative");
    }

    LoanCalculationResult result;
    result.loanId = entry.id;
    result.loanName = entry.name;
    result.loanType = entry.type;
    result.principal = entry.balance;
    result.interestRate = entry.interestRate;
    result.totalInterest = 0.0;
    result.totalPaid = 0.0;
    result.totalPMI = 0.0;
    result.totalEscrow = 0.0;
    result.minimumPayment = 0.0;
    result.vehicleValue = 0.0;
    result.equityPercent = 0.0;

    int termMonths;
    if (entry.repaymentPlan == "standard") {
        termMonths = 120;
    } else if (entry.repaymentPlan == "extended") {
        termMonths = 300;
    } else if (entry.repaymentPlan == "graduated") {
        termMonths = 120;
    } else {
        termMonths = 120; // Default to standard 10-year plan (120 months)
    }

    // Student loans use the actuarial monthly model: APR / 12
    double rate = installmentMonthlyRate(entry.interestRate);

    double payment = entry.monthlyPayment;
    if (payment <= 0) {
        payment = calculateAmortizationPayment(entry.balance, rate, termMonths);
    }
    validatePaymentCoversFirstMonthInterest(entry.balance, rate, payment, "Student loan");
    result.monthlyPayment = payment;
    result.minimumPayment = payment;

    // Allow 12 months past the stated term as a rounding buffer.
    // If a manually-set payment is below the amortization minimum, the schedule
    // will stop at termMonths + 12 rather than running indefinitely.
    buildSimpleSchedule(
        entry.balance,
        rate,
        payment,
        termMonths + 12,
        result.events,
        result.totalInterest,
        result.totalPaid,
        result.totalMonths
    );
    return result;
}

// ============================================
// GENERIC LOAN DISPATCHER
// ============================================
LoanCalculationResult AmortizationCalculator::calculateLoan(const LoanEntry& entry) {
    if (entry.type == "credit-card") {
        return calculateCreditCard(CreditCardEntry::fromJson(entry.rawJson));
    } else if (entry.type == "personal-loan") {
        return calculatePersonalLoan(PersonalLoanEntry::fromJson(entry.rawJson));
    } else if (entry.type == "auto-loan") {
        return calculateAutoLoan(AutoLoanEntry::fromJson(entry.rawJson));
    } else if (entry.type == "mortgage") {
        return calculateMortgage(MortgageEntry::fromJson(entry.rawJson));
    } else if (entry.type == "student-loan") {
        return calculateStudentLoan(StudentLoanEntry::fromJson(entry.rawJson));
    }

    throw std::invalid_argument("Unsupported loan type: " + entry.type);
}

// ============================================
// CASCADE MINIMUM PAYMENT HELPER
// ============================================
double AmortizationCalculator::computeCascadeMinimum(
    const LoanEntry& entry, double currentBalance) const
{
    const std::string& type = entry.type;
    double minimum = 0.0;
    double interestFloor = 0.0;

    if (type == "credit-card") {
        double apr = entry.rawJson.get("apr", 0.0).asDouble();
        double pct = entry.rawJson.get("minimumPaymentPercent", 2.0).asDouble() / 100.0;
        double floor = entry.rawJson.get("minimumPaymentFloor", 25.0).asDouble();
        minimum = std::max(currentBalance * pct, floor);
        interestFloor = currentBalance * creditCardMonthlyRate(apr);
    } else {
        const double rate = installmentMonthlyRate(entry.interestRate);
        interestFloor = currentBalance * rate;

        if (type == "personal-loan") {
            int term = entry.rawJson.get("termMonths", 36).asInt();
            minimum = calculateAmortizationPayment(entry.balance, rate, term);
        } else if (type == "auto-loan") {
            int term = entry.rawJson.get("termMonths", 60).asInt();
            minimum = calculateAmortizationPayment(entry.balance, rate, term);
        } else if (type == "mortgage") {
            int term = entry.rawJson.get("termYears", 30).asInt() * 12;
            minimum = calculateAmortizationPayment(entry.balance, rate, term);
        } else if (type == "student-loan") {
            std::string plan = entry.rawJson.get("repaymentPlan", "standard").asString();
            int term = (plan == "extended") ? 300 : 120;
            minimum = calculateAmortizationPayment(entry.balance, rate, term);
        } else {
            throw std::invalid_argument("Unsupported loan type in cascade: " + type);
        }
    }

    return std::max(minimum, interestFloor + kPaymentEpsilon);
}

// ============================================
// CASCADE CALCULATION
// ============================================
MultiLoanResponse AmortizationCalculator::calculateCascade(const CascadeRequest& request)
{
    const int MAX_MONTHS = 1200;
    const double EPSILON  = 0.01;

    const int n = static_cast<int>(request.loans.size());
    if (!isSupportedCascadeStrategy(request.strategy)) {
        throw std::invalid_argument("Unsupported cascade strategy: " + request.strategy);
    }

    // --- Per-loan working state ---
    struct LoanState {
        double balance;
        double monthlyRate;
        double originalMinimum;   // Fixed at start (except CC which recalcs)
        double effectiveAPR;      // For avalanche sort
        std::vector<MonthlyEvent> events;
        double totalInterest;
        double totalPaid;
    };

    std::vector<LoanState> states(n);
    for (int i = 0; i < n; ++i) {
        const LoanEntry& e = request.loans[i];
        if (!isSupportedLoanType(e.type)) {
            throw std::invalid_argument("Unsupported loan type in cascade: " + e.type);
        }
        if (e.balance <= 0) {
            throw std::invalid_argument("Cascade loan balance must be greater than 0");
        }
        if (e.monthlyPayment < 0) {
            throw std::invalid_argument("Cascade loan monthlyPayment cannot be negative");
        }

        LoanState& s = states[i];
        s.balance = e.balance;

        // Credit card: APR lives in rawJson["apr"], NOT entry.interestRate
        if (e.type == "credit-card") {
            double apr = e.rawJson.get("apr", 0.0).asDouble();
            if (apr < 0 || apr > 100) {
                throw std::invalid_argument("Credit card APR in cascade must be between 0 and 100");
            }
            s.monthlyRate = creditCardMonthlyRate(apr);
            s.effectiveAPR = apr;
        } else {
            if (e.interestRate < 0 || e.interestRate > 100) {
                throw std::invalid_argument("Loan APR/interestRate in cascade must be between 0 and 100");
            }
            s.monthlyRate  = installmentMonthlyRate(e.interestRate);
            s.effectiveAPR = e.interestRate;
        }

        s.originalMinimum = computeCascadeMinimum(e, e.balance);
        s.totalInterest = 0.0;
        s.totalPaid     = 0.0;
    }

    // --- Budget validation: ensure totalBudget covers all first-month minimums ---
    {
        double firstMonthMin = 0.0;
        for (int i = 0; i < n; ++i) {
            const double firstMonthInterest = request.loans[i].balance * states[i].monthlyRate;
            const double firstMonthCap = request.loans[i].balance + firstMonthInterest;
            firstMonthMin += std::min(states[i].originalMinimum, firstMonthCap);
        }
        if (request.totalBudget < firstMonthMin - 0.50) {
            throw std::invalid_argument(
                "totalBudget (" + std::to_string(static_cast<int>(request.totalBudget)) +
                ") is less than the sum of all loan minimums (" +
                std::to_string(static_cast<int>(std::ceil(firstMonthMin))) + ")."
            );
        }
    }

    // --- Month-by-month simulation ---
    for (int month = 1; month <= MAX_MONTHS; ++month) {
        // Collect indices of still-active loans
        std::vector<int> active;
        for (int i = 0; i < n; ++i) {
            if (states[i].balance > EPSILON) active.push_back(i);
        }
        if (active.empty()) break;

        // Step 1: compute minimums for this month
        std::vector<double> minimums(n, 0.0);
        double totalMin = 0.0;
        for (int i : active) {
            const double startBalance = states[i].balance;
            const double interest = startBalance * states[i].monthlyRate;
            const double maxPayoff = startBalance + interest;

            double rawMinimum = 0.0;
            if (request.loans[i].type == "credit-card") {
                rawMinimum = computeCascadeMinimum(request.loans[i], startBalance);
            } else {
                rawMinimum = states[i].originalMinimum;
            }
            minimums[i] = std::min(rawMinimum, maxPayoff);
            totalMin += minimums[i];
        }

        double extra = std::max(0.0, request.totalBudget - totalMin);

        // Step 2: build priority order for extra allocation
        std::vector<int> priority = active;
        if (request.strategy == "avalanche") {
            std::stable_sort(priority.begin(), priority.end(), [&](int a, int b) {
                if (std::abs(states[a].effectiveAPR - states[b].effectiveAPR) > 1e-9)
                    return states[a].effectiveAPR > states[b].effectiveAPR;
                return states[a].balance < states[b].balance;  // tiebreak: smaller balance first
            });
        } else if (request.strategy == "snowball") {
            std::stable_sort(priority.begin(), priority.end(), [&](int a, int b) {
                if (std::abs(states[a].balance - states[b].balance) > 0.01)
                    return states[a].balance < states[b].balance;
                return states[a].effectiveAPR > states[b].effectiveAPR;  // tiebreak: higher APR
            });
        }
        // "standard": no reordering, extra is split evenly below

        // Step 3: allocate extra
        std::vector<double> allocs(n);
        for (int i : active) allocs[i] = minimums[i];

        if (request.strategy == "standard") {
            double remaining = extra;
            std::vector<int> adjustable = active;

            while (remaining > EPSILON && !adjustable.empty()) {
                const double extraPerLoan = remaining / static_cast<double>(adjustable.size());
                double distributed = 0.0;
                std::vector<int> nextAdjustable;

                for (int i : adjustable) {
                    const double interest = states[i].balance * states[i].monthlyRate;
                    const double maxPayoff = states[i].balance + interest;
                    const double maxExtra = maxPayoff - allocs[i];
                    if (maxExtra <= EPSILON) {
                        continue;
                    }

                    const double toApply = std::min(extraPerLoan, maxExtra);
                    allocs[i] += toApply;
                    distributed += toApply;

                    if (maxExtra - toApply > EPSILON) {
                        nextAdjustable.push_back(i);
                    }
                }

                if (distributed <= EPSILON) {
                    break;
                }

                remaining -= distributed;
                adjustable = std::move(nextAdjustable);
            }
        } else {
            double remaining = extra;
            for (int i : priority) {
                if (remaining <= EPSILON) break;
                double interest  = states[i].balance * states[i].monthlyRate;
                double maxPayoff = states[i].balance + interest;
                double maxExtra  = maxPayoff - allocs[i];
                if (maxExtra > EPSILON) {
                    double toApply = std::min(remaining, maxExtra);
                    allocs[i] += toApply;
                    remaining  -= toApply;
                }
            }
        }

        // Step 4: apply payments and record events
        for (int i = 0; i < n; ++i) {
            double startBalance = states[i].balance;

            MonthlyEvent evt{};
            evt.month        = month;
            evt.pmiPayment   = 0.0;
            evt.escrowPayment = 0.0;

            if (startBalance <= EPSILON) {
                evt.startBalance  = 0.0;
                evt.interest      = 0.0;
                evt.payment       = 0.0;
                evt.endBalance    = 0.0;
                evt.principalPaid = 0.0;
                evt.totalPayment  = 0.0;
                states[i].events.push_back(evt);
                continue;
            }

            double interest  = startBalance * states[i].monthlyRate;
            double payment   = std::min(allocs[i], startBalance + interest);  // cap at full payoff
            double endBalance = std::max(0.0, startBalance + interest - payment);

            evt.startBalance  = startBalance;
            evt.interest      = interest;
            evt.payment       = payment;
            evt.endBalance    = endBalance;
            evt.principalPaid = std::max(0.0, payment - interest);
            evt.totalPayment  = payment;

            states[i].balance        = endBalance;
            states[i].totalInterest += interest;
            states[i].totalPaid     += payment;
            states[i].events.push_back(evt);
        }
    }

    // --- Build response ---
    MultiLoanResponse response;
    response.totalPrincipal      = 0.0;
    response.totalInterest       = 0.0;
    response.totalMonths         = 0;
    response.totalMonthlyPayment = request.totalBudget;
    response.totalPaid           = 0.0;

    for (int i = 0; i < n; ++i) {
        const LoanEntry& e = request.loans[i];
        LoanState& s = states[i];

        LoanCalculationResult result;
        result.loanId        = e.id;
        result.loanName      = e.name;
        result.loanType      = e.type;
        result.principal     = e.balance;
        result.interestRate  = s.effectiveAPR;
        result.monthlyPayment = s.originalMinimum;
        result.minimumPayment = s.originalMinimum;
        result.totalInterest = s.totalInterest;
        result.totalPaid     = s.totalPaid;
        result.totalPMI      = 0.0;
        result.totalEscrow   = 0.0;
        result.vehicleValue  = 0.0;
        result.equityPercent = 0.0;

        // Count actual months this loan was active (last event with non-zero payment)
        int loanMonths = 0;
        for (int m = static_cast<int>(s.events.size()) - 1; m >= 0; --m) {
            if (s.events[m].payment > EPSILON || s.events[m].startBalance > EPSILON) {
                loanMonths = m + 1;
                break;
            }
        }
        result.totalMonths = loanMonths;
        result.events      = std::move(s.events);

        response.totalPrincipal += e.balance;
        response.totalInterest  += result.totalInterest;
        response.totalPaid      += result.totalPaid;
        if (result.totalMonths > response.totalMonths)
            response.totalMonths = result.totalMonths;

        response.loans.push_back(std::move(result));
    }

    return response;
}

} // namespace loan
