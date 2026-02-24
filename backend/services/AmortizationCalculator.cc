#include "AmortizationCalculator.h"
#include <cmath>
#include <stdexcept>
#include <algorithm>

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
//   - Graduated/income-driven: defaults to 300-month term.
//   - Payment is calculated via amortization formula if not provided.
//
// ============================================================

namespace loan {

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

    // Check payment covers at least the first month's interest (APR/12 model)
    double firstMonthInterest = request.principal * installmentMonthlyRate(request.apr);
    if (request.monthlyPayment <= firstMonthInterest) {
        error = "Monthly payment must exceed monthly interest ($" +
                std::to_string(std::round(firstMonthInterest * 100) / 100) +
                ") to pay off loan";
        return false;
    }

    return true;
}

double AmortizationCalculator::calculateAmortizationPayment(double principal, double rate, int months) const {
    if (rate == 0) {
        return principal / months;
    }
    return principal * (rate * std::pow(1 + rate, months)) / (std::pow(1 + rate, months) - 1);
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
    result.minimumPayment = std::max(minPaymentByPercent, entry.minimumPaymentFloor);

    double payment = entry.monthlyPayment > 0 ? entry.monthlyPayment : result.minimumPayment;
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
    if (entry.vehiclePrice <= 0) {
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
    double payment = calculateAmortizationPayment(entry.balance, rate, entry.termMonths);
    result.monthlyPayment = payment;

    double vehicleValue = entry.vehiclePrice;
    double annualDepreciation = entry.isUsed ? 0.10 : 0.15;
    double firstYearBonus = entry.isUsed ? 0.05 : 0.10;

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

    for (int month = 1; month <= result.totalMonths; month++) {
        double monthlyDepreciation;
        if (month <= 12) {
            monthlyDepreciation = vehicleValue * (annualDepreciation + firstYearBonus) / 12.0;
        } else {
            monthlyDepreciation = vehicleValue * annualDepreciation / 12.0;
        }
        vehicleValue = std::max(0.0, vehicleValue - monthlyDepreciation);
    }

    result.vehicleValue = vehicleValue;
    return result;
}

// ============================================
// MORTGAGE  —  APR / 12 (actuarial monthly model)
// PITI: Principal, Interest, Taxes, Insurance with PMI tracking
// ============================================
LoanCalculationResult AmortizationCalculator::calculateMortgage(const MortgageEntry& entry) {
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
    double piPayment = calculateAmortizationPayment(entry.balance, rate, termMonths);

    double monthlyTax = entry.propertyTaxAnnual / 12.0;
    double monthlyInsurance = entry.homeInsuranceAnnual / 12.0;
    double escrowPayment = entry.includeEscrow ? (monthlyTax + monthlyInsurance + entry.hoaMonthly) : 0.0;

    double originalLTV = entry.balance / entry.homePrice;
    double monthlyPMI = 0.0;
    if (originalLTV > 0.80 && entry.pmiRate > 0) {
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

    for (auto& event : result.events) {
        double currentLTV = event.endBalance / entry.homePrice;
        if (currentLTV <= 0.78) {
            event.pmiPayment = 0.0;
        } else if (currentLTV <= 0.80 && event.month > 24) {
            event.pmiPayment = 0.0;
        } else {
            event.pmiPayment = monthlyPMI;
        }
        result.totalPMI += event.pmiPayment;

        event.escrowPayment = escrowPayment;
        result.totalEscrow += event.escrowPayment;

        event.totalPayment = event.payment + event.pmiPayment + event.escrowPayment;
        result.totalPaid += (event.pmiPayment + event.escrowPayment);
    }

    double endingBalance = result.events.empty() ? entry.balance : result.events.back().endBalance;
    result.equityPercent = ((entry.homePrice - endingBalance) / entry.homePrice) * 100.0;
    return result;
}

// ============================================
// STUDENT LOAN  —  APR / 12 (actuarial monthly model)
// ============================================
LoanCalculationResult AmortizationCalculator::calculateStudentLoan(const StudentLoanEntry& entry) {
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
        termMonths = 300;
    }

    // Student loans use the actuarial monthly model: APR / 12
    double rate = installmentMonthlyRate(entry.interestRate);

    double payment = entry.monthlyPayment;
    if (payment <= 0) {
        payment = calculateAmortizationPayment(entry.balance, rate, termMonths);
    }
    result.monthlyPayment = payment;
    result.minimumPayment = payment;

    buildSimpleSchedule(
        entry.balance,
        rate,
        payment,
        termMonths + 60,
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

    // Fallback: treat as installment loan (APR / 12)
    LoanCalculationResult result;
    result.loanId = entry.id;
    result.loanName = entry.name;
    result.loanType = entry.type;
    result.principal = entry.balance;
    result.interestRate = entry.interestRate;
    result.monthlyPayment = entry.monthlyPayment;
    result.totalInterest = 0.0;
    result.totalPaid = 0.0;
    result.totalPMI = 0.0;
    result.totalEscrow = 0.0;
    result.minimumPayment = 0.0;
    result.vehicleValue = 0.0;
    result.equityPercent = 0.0;

    buildSimpleSchedule(
        entry.balance,
        installmentMonthlyRate(entry.interestRate),
        entry.monthlyPayment,
        1200,
        result.events,
        result.totalInterest,
        result.totalPaid,
        result.totalMonths
    );
    return result;
}

} // namespace loan
