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

    // Monthly interest accrued from daily APR over a billing cycle.
    double monthlyAccruedInterest(double balance, double apr, int daysInCycle = 30) const {
        return balance * dailyRate(apr) * daysInCycle;
    }

    // Effective monthly cycle rate derived from daily APR accrual.
    double cycleRate(double apr, int daysInCycle = 30) const {
        return dailyRate(apr) * daysInCycle;
    }

    // Calculate standard amortization payment
    double calculateAmortizationPayment(double principal, double monthlyRate, int months) const;

    // Shared monthly amortization engine used by all loan types.
    void buildSimpleSchedule(
        double principal,
        double annualRate,
        double scheduledPayment,
        int maxMonths,
        std::vector<MonthlyEvent>& events,
        double& totalInterest,
        double& totalPaid,
        int& totalMonths
    ) const;

    // Validate input parameters
    bool validateInput(const LoanRequest& request, std::string& error);
};

} // namespace loan
