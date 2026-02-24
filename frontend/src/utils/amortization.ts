import { MonthlyEvent } from '../types/loan';

const DAYS_IN_YEAR = 365;
const DEFAULT_DAYS_IN_CYCLE = 30;
const DEFAULT_MAX_MONTHS = 1200;

interface SimulateParams {
  principal: number;
  apr: number;
  monthlyPayment: number;
  maxMonths?: number;
  daysInCycle?: number;
}

interface SimulationResult {
  months: number;
  totalInterest: number;
  events: MonthlyEvent[];
}

export function cycleRateFromApr(apr: number, daysInCycle: number = DEFAULT_DAYS_IN_CYCLE): number {
  return (apr / 100 / DAYS_IN_YEAR) * daysInCycle;
}

export function monthlyInterestFromApr(
  balance: number,
  apr: number,
  daysInCycle: number = DEFAULT_DAYS_IN_CYCLE
): number {
  return balance * cycleRateFromApr(apr, daysInCycle);
}

export function paymentForTerm(
  principal: number,
  apr: number,
  termMonths: number,
  daysInCycle: number = DEFAULT_DAYS_IN_CYCLE
): number {
  if (principal <= 0) return 0;
  if (termMonths <= 0) return principal;

  const rate = cycleRateFromApr(apr, daysInCycle);
  if (rate === 0) {
    return principal / termMonths;
  }

  const payment = principal * (rate * Math.pow(1 + rate, termMonths))
    / (Math.pow(1 + rate, termMonths) - 1);
  return Math.min(payment, principal);
}

export function simulateSimpleAmortization({
  principal,
  apr,
  monthlyPayment,
  maxMonths = DEFAULT_MAX_MONTHS,
  daysInCycle = DEFAULT_DAYS_IN_CYCLE
}: SimulateParams): SimulationResult {
  const events: MonthlyEvent[] = [];
  if (principal <= 0 || monthlyPayment <= 0 || maxMonths <= 0) {
    return { months: 0, totalInterest: 0, events };
  }

  let balance = principal;
  let totalInterest = 0;
  let months = 0;

  while (balance > 0.01 && months < maxMonths) {
    months++;
    const startBalance = balance;
    const interest = monthlyInterestFromApr(startBalance, apr, daysInCycle);
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
