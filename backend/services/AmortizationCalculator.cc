#include "AmortizationCalculator.h"
#include <cmath>
#include <stdexcept>
#include <algorithm>

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

    // Check if payment covers at least the first billing cycle's accrued interest
    double firstMonthInterest = monthlyAccruedInterest(request.principal, request.apr);
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

void AmortizationCalculator::buildSimpleSchedule(
    double principal,
    double annualRate,
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

        event.interest = monthlyAccruedInterest(balance, annualRate);
        totalInterest += event.interest;

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

// Legacy calculate method for backward compatibility
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
        request.apr,
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
// CREDIT CARD CALCULATOR
// Daily APR accrual over monthly cycle, then payment at cycle end
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

    // Calculate minimum payment
    double minPaymentByPercent = entry.balance * (entry.minimumPaymentPercent / 100.0);
    result.minimumPayment = std::max(minPaymentByPercent, entry.minimumPaymentFloor);

    // Use provided payment or minimum if not specified
    double payment = entry.monthlyPayment > 0 ? entry.monthlyPayment : result.minimumPayment;
    result.monthlyPayment = payment;

    buildSimpleSchedule(
        entry.balance,
        entry.apr,
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
// PERSONAL LOAN CALCULATOR
// Simple interest amortization with fixed term
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

    // Calculate amortization payment if not provided
    double payment = entry.monthlyPayment;
    if (payment <= 0 && entry.termMonths > 0) {
        payment = calculateAmortizationPayment(entry.balance, cycleRate(entry.interestRate), entry.termMonths);
    }
    result.monthlyPayment = payment;
    buildSimpleSchedule(
        entry.balance,
        entry.interestRate,
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
// AUTO LOAN CALCULATOR
// Simple interest amortization with depreciation tracking
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

    // Calculate amortization payment
    double payment = calculateAmortizationPayment(entry.balance, cycleRate(entry.interestRate), entry.termMonths);
    result.monthlyPayment = payment;

    // Vehicle depreciation rates (annual)
    // New cars: ~20% year 1, ~15% year 2-3, ~10% year 4-5
    // Used cars: ~15% year 1, ~10% thereafter
    double vehicleValue = entry.vehiclePrice;
    double annualDepreciation = entry.isUsed ? 0.10 : 0.15;
    double firstYearBonus = entry.isUsed ? 0.05 : 0.10;  // Extra depreciation year 1

    buildSimpleSchedule(
        entry.balance,
        entry.interestRate,
        payment,
        entry.termMonths,
        result.events,
        result.totalInterest,
        result.totalPaid,
        result.totalMonths
    );

    for (int month = 1; month <= result.totalMonths; month++) {
        // Calculate depreciation
        double monthlyDepreciation;
        if (month <= 12) {
            // First year: higher depreciation
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
// MORTGAGE CALCULATOR
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

    // Calculate P&I payment
    double piPayment = calculateAmortizationPayment(entry.balance, cycleRate(entry.interestRate), termMonths);

    // Monthly escrow (taxes + insurance)
    double monthlyTax = entry.propertyTaxAnnual / 12.0;
    double monthlyInsurance = entry.homeInsuranceAnnual / 12.0;
    double escrowPayment = entry.includeEscrow ? (monthlyTax + monthlyInsurance + entry.hoaMonthly) : 0.0;

    // PMI calculation (required if LTV > 80%)
    double originalLTV = entry.balance / entry.homePrice;
    double monthlyPMI = 0.0;
    if (originalLTV > 0.80 && entry.pmiRate > 0) {
        monthlyPMI = (entry.balance * entry.pmiRate / 100.0) / 12.0;
    }

    result.monthlyPayment = piPayment + escrowPayment + monthlyPMI;

    buildSimpleSchedule(
        entry.balance,
        entry.interestRate,
        piPayment,
        termMonths,
        result.events,
        result.totalInterest,
        result.totalPaid,
        result.totalMonths
    );

    for (auto& event : result.events) {
        // Calculate current LTV for PMI using end-of-month balance
        double currentLTV = event.endBalance / entry.homePrice;
        if (currentLTV <= 0.78) {
            // PMI automatically cancels at 78% LTV
            event.pmiPayment = 0.0;
        } else if (currentLTV <= 0.80 && event.month > 24) {
            // Can request PMI cancellation at 80% LTV after 2 years
            event.pmiPayment = 0.0;
        } else {
            event.pmiPayment = monthlyPMI;
        }
        result.totalPMI += event.pmiPayment;

        // Escrow payment
        event.escrowPayment = escrowPayment;
        result.totalEscrow += event.escrowPayment;

        // Total monthly payment
        event.totalPayment = event.payment + event.pmiPayment + event.escrowPayment;
        result.totalPaid += (event.pmiPayment + event.escrowPayment);
    }

    double endingBalance = result.events.empty() ? entry.balance : result.events.back().endBalance;
    result.equityPercent = ((entry.homePrice - endingBalance) / entry.homePrice) * 100.0;
    return result;
}

// ============================================
// STUDENT LOAN CALCULATOR
// Daily APR accrual over monthly cycle, payment applied at cycle end
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

    // Determine term based on repayment plan
    int termMonths;
    if (entry.repaymentPlan == "standard") {
        termMonths = 120;  // 10 years
    } else if (entry.repaymentPlan == "extended") {
        termMonths = 300;  // 25 years
    } else if (entry.repaymentPlan == "graduated") {
        termMonths = 120;  // 10 years, but payments increase
    } else {
        termMonths = 300;  // Income-driven: up to 25 years
    }

    // Calculate base payment using monthly cycle rate from daily APR
    double payment = entry.monthlyPayment;
    if (payment <= 0) {
        payment = calculateAmortizationPayment(entry.balance, cycleRate(entry.interestRate), termMonths);
    }
    result.monthlyPayment = payment;
    result.minimumPayment = payment;

    buildSimpleSchedule(
        entry.balance,
        entry.interestRate,
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
// Routes to specialized calculator based on loan type
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

    // Fallback to simple amortization
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
        entry.interestRate,
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
