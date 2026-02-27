// ============================================================
// AMORTIZATION UTILITY — CALCULATION ASSUMPTIONS
// ============================================================
//
// TWO RATE MODELS ARE USED DEPENDING ON LOAN TYPE:
//
//   Credit Card       →  APR / 365 × 30  (daily accrual model)
//     Credit cards charge interest daily on the outstanding balance.
//     Daily periodic rate = APR / 365. Over a 30-day billing cycle:
//       monthly interest = balance × (APR / 365) × 30
//
//   Installment Loans →  APR / 12  (actuarial monthly model)
//     Personal loans, auto loans, mortgages, and student loans use
//     the actuarial method per Regulation Z (TILA). Monthly rate = APR / 12.
//     Applies to: personal-loan, auto-loan, mortgage, student-loan.
//
// PAYMENT ORDER (same for all loan types):
//   1. Interest accrues on the balance at the start of the period
//   2. Payment is applied at the end of the period
//   3. Payment covers interest first
//   4. Remainder reduces principal
//   5. New balance = old balance + interest - payment
//
// AMORTIZATION PAYMENT FORMULA:
//   M = P × [r(1+r)^n] / [(1+r)^n - 1]
//   where P = principal, r = monthly rate, n = term in months
//   Produces a fixed payment that exactly zeros the balance at end of term.
//
// ============================================================

import { MonthlyEvent } from '../types/loan';

const DAYS_IN_YEAR = 365;
const DEFAULT_DAYS_IN_CYCLE = 30;
const DEFAULT_MAX_MONTHS = 1200;

// ----------------------------------------------------------
// RATE HELPERS
// ----------------------------------------------------------

// Credit card: daily accrual model — APR / 365 × days_in_cycle
export function creditCardCycleRate(apr: number, daysInCycle: number = DEFAULT_DAYS_IN_CYCLE): number {
  return (apr / 100 / DAYS_IN_YEAR) * daysInCycle;
}

// Installment loans: actuarial monthly model — APR / 12
// Use for: personal-loan, auto-loan, mortgage, student-loan
export function installmentMonthlyRate(apr: number): number {
  return apr / 100 / 12;
}

// Returns the correct monthly rate for a given loan type
export function monthlyRateForLoanType(apr: number, loanType: string): number {
  if (loanType === 'credit-card') {
    return creditCardCycleRate(apr);
  }
  return installmentMonthlyRate(apr);
}

// Monthly interest in dollars for a specific loan type
export function monthlyInterestForLoan(
  balance: number,
  apr: number,
  loanType: string
): number {
  return balance * monthlyRateForLoanType(apr, loanType);
}

// ----------------------------------------------------------
// PAYMENT FORMULA
// ----------------------------------------------------------

// Calculate the fixed monthly payment to pay off a loan in termMonths.
// Uses the correct rate model for the given loan type.
// M = P × [r(1+r)^n] / [(1+r)^n - 1]
export function paymentForTerm(
  principal: number,
  apr: number,
  termMonths: number,
  loanType: string = 'personal-loan'
): number {
  if (principal <= 0) return 0;
  if (termMonths <= 0) return principal;

  const rate = monthlyRateForLoanType(apr, loanType);
  if (rate === 0) {
    return principal / termMonths;
  }

  return principal * (rate * Math.pow(1 + rate, termMonths))
    / (Math.pow(1 + rate, termMonths) - 1);
}

// ----------------------------------------------------------
// SCHEDULE SIMULATION
// ----------------------------------------------------------

interface SimulateParams {
  principal: number;
  apr: number;
  monthlyPayment: number;
  maxMonths?: number;
  loanType?: string; // defaults to 'personal-loan' (APR/12)
}

interface SimulationResult {
  months: number;
  totalInterest: number;
  events: MonthlyEvent[];
}

// Simulates a full amortization schedule month by month.
// Interest accrues at the START of each period; payment is applied at the END.
// loanType determines which rate model is used (credit-card vs installment).
export function simulateSimpleAmortization({
  principal,
  apr,
  monthlyPayment,
  maxMonths = DEFAULT_MAX_MONTHS,
  loanType = 'personal-loan'
}: SimulateParams): SimulationResult {
  const events: MonthlyEvent[] = [];
  if (principal <= 0 || monthlyPayment <= 0 || maxMonths <= 0) {
    return { months: 0, totalInterest: 0, events };
  }

  const rate = monthlyRateForLoanType(apr, loanType);
  let balance = principal;
  let totalInterest = 0;
  let months = 0;

  while (balance > 0.01 && months < maxMonths) {
    months++;
    const startBalance = balance;

    // Step 1: interest accrues on the current balance
    const interest = startBalance * rate;

    // Step 2: payment covers interest first, remainder reduces principal
    const payment = Math.min(monthlyPayment, startBalance + interest);
    const principalPaid = Math.max(0, payment - interest);
    balance = startBalance + interest - payment;

    totalInterest += interest;
    events.push({
      month: months,
      startBalance,
      interest,
      payment,
      principalPaid,
      endBalance: Math.max(0, balance)
    });
  }

  return { months, totalInterest, events };
}

// ----------------------------------------------------------
// BACKWARD COMPATIBILITY
// ----------------------------------------------------------

// Kept for any callers that used the old daily-accrual function name.
// For new code, prefer monthlyInterestForLoan(balance, apr, loanType).
export function cycleRateFromApr(apr: number, daysInCycle: number = DEFAULT_DAYS_IN_CYCLE): number {
  return creditCardCycleRate(apr, daysInCycle);
}

export function monthlyInterestFromApr(
  balance: number,
  apr: number,
  daysInCycle: number = DEFAULT_DAYS_IN_CYCLE
): number {
  return balance * creditCardCycleRate(apr, daysInCycle);
}
