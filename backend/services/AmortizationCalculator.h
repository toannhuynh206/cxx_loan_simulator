#pragma once

#include "../models/LoanModels.h"
#include <string>

namespace loan {

class AmortizationCalculator {
public:
    // Calculate complete amortization schedule (legacy)
    LoanResponse calculate(const LoanRequest& request);

    // Specialized calculators for each loan type
    LoanCalculationResult calculateCreditCard(const CreditCardEntry& entry);
    LoanCalculationResult calculatePersonalLoan(const PersonalLoanEntry& entry);
    LoanCalculationResult calculateAutoLoan(const AutoLoanEntry& entry);
    LoanCalculationResult calculateMortgage(const MortgageEntry& entry);
    LoanCalculationResult calculateStudentLoan(const StudentLoanEntry& entry);

    // Generic calculator that dispatches to specialized methods
    LoanCalculationResult calculateLoan(const LoanEntry& entry);

private:
    // Calculate monthly interest rate from APR
    double monthlyRate(double apr) const {
        return apr / 100.0 / 12.0;
    }

    // Calculate daily interest rate from APR
    double dailyRate(double apr) const {
        return apr / 100.0 / 365.0;
    }

    // Calculate standard amortization payment
    double calculateAmortizationPayment(double principal, double monthlyRate, int months) const;

    // Validate input parameters
    bool validateInput(const LoanRequest& request, std::string& error);
};

} // namespace loan
