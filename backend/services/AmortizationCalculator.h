#pragma once

#include "../models/LoanModels.h"
#include <string>

namespace loan {

// ============================================================
// INTEREST RATE MODELS
// ============================================================
//
// Two distinct models are used depending on loan type:
//
// 1. CREDIT CARD  →  Daily Accrual Model  (APR / 365 × days)
//    Credit cards charge interest every day on the outstanding
//    balance. The daily periodic rate is APR/365. Over a 30-day
//    billing cycle: monthly interest = balance × (APR/365) × 30.
//    This matches how card issuers legally compute finance charges.
//
// 2. INSTALLMENT LOANS  →  Actuarial Monthly Model  (APR / 12)
//    Personal loans, auto loans, mortgages, and student loans use
//    the actuarial method defined by Regulation Z (TILA). The
//    monthly periodic rate is simply APR/12. The amortization
//    payment formula is derived from this rate to produce a fixed
//    payment that exactly zeros the balance at the end of the term.
//    This is what every bank and lender uses for these products.
//
// PAYMENT ORDER (same for all loan types):
//    1. Interest accrues on the current balance at start of period
//    2. Payment is applied
//    3. Payment covers interest first
//    4. Remainder reduces principal
//    5. New balance = old balance + interest - payment
//
// ============================================================

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

    // Cascade calculator: fixed total budget distributed by strategy each month.
    // When a loan pays off, its freed portion automatically rolls to remaining loans.
    MultiLoanResponse calculateCascade(const CascadeRequest& request);

private:
    // ----------------------------------------------------------
    // RATE HELPERS
    // ----------------------------------------------------------

    // Credit card: daily accrual model (APR / 365 × days_in_cycle)
    // Default 30-day cycle matches standard billing period assumption.
    double creditCardMonthlyRate(double apr, int daysInCycle = 30) const {
        return (apr / 100.0 / 365.0) * daysInCycle;
    }

    // Installment loans: actuarial monthly model (APR / 12)
    // Used for personal loans, auto loans, mortgages, student loans.
    double installmentMonthlyRate(double apr) const {
        return apr / 100.0 / 12.0;
    }

    // ----------------------------------------------------------
    // CORE CALCULATION HELPERS
    // ----------------------------------------------------------

    // Standard amortization payment formula.
    // monthlyRate must already be computed with the correct model
    // (creditCardMonthlyRate or installmentMonthlyRate) before calling.
    double calculateAmortizationPayment(double principal, double monthlyRate, int months) const;

    // Shared monthly amortization engine used by all loan types.
    // monthlyRate is pre-computed by the caller using the correct model —
    // this function does not know or care which loan type it is serving.
    // Interest order: interest accrues first, then payment is applied.
    void buildSimpleSchedule(
        double principal,
        double monthlyRate,
        double scheduledPayment,
        int maxMonths,
        std::vector<MonthlyEvent>& events,
        double& totalInterest,
        double& totalPaid,
        int& totalMonths
    ) const;

    // Compute the minimum required payment for a loan in the cascade simulation.
    // Credit cards: recalculated monthly on current balance.
    // Installment loans: fixed amortization payment computed from original principal.
    double computeCascadeMinimum(const LoanEntry& entry, double currentBalance) const;

    // Validate input parameters
    bool validateInput(const LoanRequest& request, std::string& error);
};

} // namespace loan
