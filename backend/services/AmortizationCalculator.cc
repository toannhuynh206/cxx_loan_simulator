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

    // Check if payment covers at least the first month's interest
    double firstMonthInterest = request.principal * monthlyRate(request.apr);
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

    double balance = request.principal;
    double rate = monthlyRate(request.apr);
    int month = 0;

    const int MAX_MONTHS = 1200;

    while (balance > 0.01 && month < MAX_MONTHS) {
        month++;

        MonthlyEvent event;
        event.month = month;
        event.startBalance = balance;
        event.pmiPayment = 0.0;
        event.escrowPayment = 0.0;

        // Apply payment first
        event.payment = std::min(request.monthlyPayment, balance);
        balance -= event.payment;

        // Then calculate interest on reduced balance
        event.interest = balance * rate;
        response.totalInterest += event.interest;
        balance += event.interest;

        event.principalPaid = event.payment;
        event.endBalance = std::max(0.0, balance);
        event.totalPayment = event.payment;
        response.totalPaid += event.totalPayment;
        response.events.push_back(event);
    }

    response.totalMonths = month;
    return response;
}

// ============================================
// CREDIT CARD CALCULATOR
// Daily compounding with average daily balance method
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

    double balance = entry.balance;
    double dailyRateVal = dailyRate(entry.apr);
    int month = 0;
    const int MAX_MONTHS = 1200;
    const int DAYS_PER_MONTH = 30;

    while (balance > 0.01 && month < MAX_MONTHS) {
        month++;

        MonthlyEvent event;
        event.month = month;
        event.startBalance = balance;
        event.pmiPayment = 0.0;
        event.escrowPayment = 0.0;

        // Credit cards compound daily on average daily balance
        // Simplified: compound daily for 30 days
        double monthlyInterest = 0.0;
        double dailyBalance = balance;

        for (int day = 0; day < DAYS_PER_MONTH; day++) {
            double dayInterest = dailyBalance * dailyRateVal;
            monthlyInterest += dayInterest;
            dailyBalance += dayInterest;
        }

        event.interest = monthlyInterest;
        result.totalInterest += event.interest;

        // Apply payment after interest compounds
        balance = dailyBalance;
        event.payment = std::min(payment, balance);
        balance -= event.payment;

        event.principalPaid = event.payment - event.interest;
        event.endBalance = std::max(0.0, balance);
        event.totalPayment = event.payment;
        result.totalPaid += event.totalPayment;
        result.events.push_back(event);
    }

    result.totalMonths = month;
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

    double rate = monthlyRate(entry.interestRate);

    // Calculate amortization payment if not provided
    double payment = entry.monthlyPayment;
    if (payment <= 0 && entry.termMonths > 0) {
        payment = calculateAmortizationPayment(entry.balance, rate, entry.termMonths);
    }
    result.monthlyPayment = payment;

    double balance = entry.balance;
    int month = 0;
    const int MAX_MONTHS = entry.termMonths > 0 ? entry.termMonths : 1200;

    while (balance > 0.01 && month < MAX_MONTHS) {
        month++;

        MonthlyEvent event;
        event.month = month;
        event.startBalance = balance;
        event.pmiPayment = 0.0;
        event.escrowPayment = 0.0;

        // Calculate interest first (simple interest)
        event.interest = balance * rate;
        result.totalInterest += event.interest;

        // Calculate payment (may be less in final month)
        event.payment = std::min(payment, balance + event.interest);

        // Principal paid is payment minus interest
        event.principalPaid = event.payment - event.interest;
        balance -= event.principalPaid;

        event.endBalance = std::max(0.0, balance);
        event.totalPayment = event.payment;
        result.totalPaid += event.totalPayment;
        result.events.push_back(event);
    }

    result.totalMonths = month;
    return result;
}

// ============================================
// AUTO LOAN CALCULATOR
// Simple interest amortization with depreciation tracking
// ============================================
LoanCalculationResult AmortizationCalculator::calculateAutoLoan(const AutoLoanEntry& entry) {
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

    double rate = monthlyRate(entry.interestRate);

    // Calculate amortization payment
    double payment = calculateAmortizationPayment(entry.balance, rate, entry.termMonths);
    result.monthlyPayment = payment;

    // Vehicle depreciation rates (annual)
    // New cars: ~20% year 1, ~15% year 2-3, ~10% year 4-5
    // Used cars: ~15% year 1, ~10% thereafter
    double vehicleValue = entry.vehiclePrice;
    double annualDepreciation = entry.isUsed ? 0.10 : 0.15;
    double firstYearBonus = entry.isUsed ? 0.05 : 0.10;  // Extra depreciation year 1

    double balance = entry.balance;
    int month = 0;

    while (balance > 0.01 && month < entry.termMonths) {
        month++;

        MonthlyEvent event;
        event.month = month;
        event.startBalance = balance;
        event.pmiPayment = 0.0;
        event.escrowPayment = 0.0;

        // Calculate depreciation
        double monthlyDepreciation;
        if (month <= 12) {
            // First year: higher depreciation
            monthlyDepreciation = vehicleValue * (annualDepreciation + firstYearBonus) / 12.0;
        } else {
            monthlyDepreciation = vehicleValue * annualDepreciation / 12.0;
        }
        vehicleValue = std::max(0.0, vehicleValue - monthlyDepreciation);

        // Calculate interest (simple interest)
        event.interest = balance * rate;
        result.totalInterest += event.interest;

        // Calculate payment
        event.payment = std::min(payment, balance + event.interest);
        event.principalPaid = event.payment - event.interest;
        balance -= event.principalPaid;

        event.endBalance = std::max(0.0, balance);
        event.totalPayment = event.payment;
        result.totalPaid += event.totalPayment;
        result.events.push_back(event);
    }

    result.totalMonths = month;
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

    double rate = monthlyRate(entry.interestRate);
    int termMonths = entry.termYears * 12;

    // Calculate P&I payment
    double piPayment = calculateAmortizationPayment(entry.balance, rate, termMonths);

    // Monthly escrow (taxes + insurance)
    double monthlyTax = entry.propertyTaxAnnual / 12.0;
    double monthlyInsurance = entry.homeInsuranceAnnual / 12.0;
    double escrowPayment = monthlyTax + monthlyInsurance + entry.hoaMonthly;

    // PMI calculation (required if LTV > 80%)
    double originalLTV = entry.balance / entry.homePrice;
    double monthlyPMI = 0.0;
    if (originalLTV > 0.80 && entry.pmiRate > 0) {
        monthlyPMI = (entry.balance * entry.pmiRate / 100.0) / 12.0;
    }

    result.monthlyPayment = piPayment + escrowPayment + monthlyPMI;

    double balance = entry.balance;
    int month = 0;

    while (balance > 0.01 && month < termMonths) {
        month++;

        MonthlyEvent event;
        event.month = month;
        event.startBalance = balance;

        // Calculate interest
        event.interest = balance * rate;
        result.totalInterest += event.interest;

        // Calculate principal portion of P&I
        event.payment = std::min(piPayment, balance + event.interest);
        event.principalPaid = event.payment - event.interest;
        balance -= event.principalPaid;

        // Calculate current LTV for PMI
        double currentLTV = balance / entry.homePrice;
        if (currentLTV <= 0.78) {
            // PMI automatically cancels at 78% LTV
            event.pmiPayment = 0.0;
        } else if (currentLTV <= 0.80 && month > 24) {
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
        event.endBalance = std::max(0.0, balance);
        result.totalPaid += event.totalPayment;
        result.events.push_back(event);
    }

    result.totalMonths = month;
    result.equityPercent = ((entry.homePrice - balance) / entry.homePrice) * 100.0;
    return result;
}

// ============================================
// STUDENT LOAN CALCULATOR
// Simple interest with various repayment plans
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

    double rate = monthlyRate(entry.interestRate);

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

    // Calculate base payment
    double payment = entry.monthlyPayment;
    if (payment <= 0) {
        payment = calculateAmortizationPayment(entry.balance, rate, termMonths);
    }
    result.monthlyPayment = payment;

    double balance = entry.balance;
    int month = 0;
    const int MAX_MONTHS = termMonths + 60;  // Allow some buffer

    // Graduated repayment increases payment every 2 years
    double graduatedPayment = payment * 0.75;  // Start lower
    double graduatedIncrease = payment * 0.50 / 5.0;  // Increase over 5 periods

    while (balance > 0.01 && month < MAX_MONTHS) {
        month++;

        MonthlyEvent event;
        event.month = month;
        event.startBalance = balance;
        event.pmiPayment = 0.0;
        event.escrowPayment = 0.0;

        // Calculate interest (simple interest, not compound)
        event.interest = balance * rate;
        result.totalInterest += event.interest;

        // Determine payment based on plan
        double currentPayment = payment;
        if (entry.repaymentPlan == "graduated") {
            int period = (month - 1) / 24;  // 2-year periods
            currentPayment = graduatedPayment + (graduatedIncrease * period);
            currentPayment = std::min(currentPayment, payment * 1.5);  // Cap at 150% of standard
        }

        // Calculate payment
        event.payment = std::min(currentPayment, balance + event.interest);
        event.principalPaid = event.payment - event.interest;

        // Prevent negative principal (interest-only scenario)
        if (event.principalPaid < 0) {
            event.principalPaid = 0;
            balance += (event.interest - event.payment);  // Negative amortization
        } else {
            balance -= event.principalPaid;
        }

        event.endBalance = std::max(0.0, balance);
        event.totalPayment = event.payment;
        result.totalPaid += event.totalPayment;
        result.events.push_back(event);
    }

    result.totalMonths = month;
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

    double balance = entry.balance;
    double rate = monthlyRate(entry.interestRate);
    int month = 0;
    const int MAX_MONTHS = 1200;

    while (balance > 0.01 && month < MAX_MONTHS) {
        month++;

        MonthlyEvent event;
        event.month = month;
        event.startBalance = balance;
        event.pmiPayment = 0.0;
        event.escrowPayment = 0.0;

        event.interest = balance * rate;
        result.totalInterest += event.interest;

        event.payment = std::min(entry.monthlyPayment, balance + event.interest);
        event.principalPaid = event.payment - event.interest;
        balance -= event.principalPaid;

        event.endBalance = std::max(0.0, balance);
        event.totalPayment = event.payment;
        result.totalPaid += event.totalPayment;
        result.events.push_back(event);
    }

    result.totalMonths = month;
    return result;
}

} // namespace loan
