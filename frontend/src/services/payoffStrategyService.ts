import { CombinedLoanResult } from '../types/loan';
import {
  PayoffStrategyType,
  LoanSnapshot,
  StrategyResult,
  StrategyComparison,
  StrategyMonthEvent,
  PayoffOrderItem
} from '../types/payoffStrategy';
import { monthlyInterestForLoan, paymentForTerm } from '../utils/amortization';

// ============================================================
// STRATEGY SIMULATION — CALCULATION ASSUMPTIONS
// ============================================================
//
// MINIMUM PAYMENTS
//   Each loan's minimum payment is the floor — every strategy
//   guarantees at least the minimum is paid to every active loan
//   each month. Extra payment is then routed based on strategy.
//
//   Credit card: max(balance × minPercent, minFloor) — recalculated
//     each month on the current balance so it declines over time.
//   Installment loans (personal, auto, student): full amortization
//     payment for the loan's original term.
//   Mortgage: P&I payment only — escrow (taxes/insurance/HOA) and
//     PMI are pass-through costs that don't reduce the loan balance
//     and are excluded from the strategy simulation.
//
// FREED PAYMENTS (SNOWBALL EFFECT)
//   When a loan is paid off, its minimum payment is added to the
//   available extra for all subsequent months. This is the core
//   mechanic that makes avalanche and snowball accelerate over time.
//
// BASELINE
//   "Interest saved" and "months saved" are computed relative to
//   paying only minimums with no extra payment (avalanche with
//   extraPayment=0, which is equivalent to minimum-only since there
//   is nothing extra to target). This answers: "how much does adding
//   extra payment save you vs. just making minimums?"
//
// STRATEGIES
//   Avalanche: pay highest APR first (minimizes total interest — optimal)
//   Snowball:  pay smallest current balance first (fastest loan eliminations)
//   Standard:  minimums to all, extra split evenly across all active loans
//
// ============================================================

/**
 * Compute the correct minimum payment for a loan in the strategy simulation.
 * Key distinction: mortgage uses P&I only (not PITI) and credit card
 * minimum recalculates on the current balance each month.
 */
function computeMinimumPayment(
  loan: {
    loanType: string;
    apr: number;
    minimumPayment: number;
    principal?: number;
    totalMonths?: number;
    monthlyPayment?: number;
  },
  currentBalance?: number
): number {
  if (loan.loanType === 'mortgage') {
    // Mortgages: backend sets minimumPayment=0 and monthlyPayment=PITI.
    // We only want P&I — escrow and PMI go to third parties, not the loan.
    const term = (loan.totalMonths ?? 0) > 0 ? loan.totalMonths! : 360;
    return paymentForTerm(loan.principal ?? 0, loan.apr, term, 'mortgage');
  }

  if (loan.loanType === 'credit-card' && currentBalance !== undefined) {
    // Credit cards: minimum is percentage-based, so it shrinks as balance does.
    // Backend uses 2% floor of $25. We re-apply the same logic on current balance.
    const MIN_PERCENT = 0.02;
    const MIN_FLOOR = 25;
    const percentBased = currentBalance * MIN_PERCENT;
    const interestFloor = monthlyInterestForLoan(currentBalance, loan.apr, 'credit-card') + 0.01;
    return Math.max(percentBased, MIN_FLOOR, interestFloor);
  }

  // All other installment loans: use backend-provided payment as the minimum floor.
  return loan.minimumPayment || loan.monthlyPayment || 0;
}

/**
 * Convert backend loan results to strategy input snapshots.
 *
 * We use loan.monthlyPayment (what you're actually paying right now) as the
 * floor for each loan in the simulation. This means:
 * - The cascading simulation starts from your real current payments
 * - The "extra payment" slider adds truly extra money on top
 * - When a loan pays off, the freed payment is what was actually going to it
 *
 * Mortgage exception: monthlyPayment = PITI (includes escrow/PMI which don't
 * reduce the balance), so we recompute P&I only for mortgages.
 */
export function createLoanSnapshots(loanData: CombinedLoanResult): LoanSnapshot[] {
  return loanData.loans.map(loan => {
    let minimumPayment: number;

    if (loan.loanType === 'mortgage') {
      // Use P&I only — escrow and PMI are pass-through costs, not loan payments
      const term = loan.totalMonths > 0 ? loan.totalMonths : 360;
      minimumPayment = paymentForTerm(loan.principal, loan.apr, term, 'mortgage');
    } else {
      // Use the actual payment from the backend — reflects whatever the user
      // configured (auto-allocation, manual entry, or backend-calculated minimum)
      minimumPayment = loan.monthlyPayment
        || paymentForTerm(loan.principal, loan.apr, loan.totalMonths || 120, loan.loanType);
    }

    return {
      id: loan.loanId,
      name: loan.loanName,
      balance: loan.principal,
      apr: loan.apr,
      minimumPayment,
      loanType: loan.loanType,
      totalMonths: loan.totalMonths,
    };
  });
}

/**
 * Get the priority order for loans based on strategy, using current balances.
 * Avalanche: highest APR first (optimal for total interest).
 * Snowball: smallest CURRENT balance first (fastest eliminations).
 */
function getLoanPriority(
  loans: LoanSnapshot[],
  strategy: PayoffStrategyType,
  currentBalances: Map<string, number>
): LoanSnapshot[] {
  const sortedLoans = [...loans];

  switch (strategy) {
    case 'avalanche':
      // Highest APR first — each dollar saves the most future interest.
      // Tiebreaker: smaller current balance (eliminates loan sooner, frees minimum faster).
      sortedLoans.sort((a, b) => {
        if (b.apr !== a.apr) return b.apr - a.apr;
        const balA = currentBalances.get(a.id) ?? a.balance;
        const balB = currentBalances.get(b.id) ?? b.balance;
        return balA - balB;
      });
      break;

    case 'snowball':
      // Smallest CURRENT balance first — quickest psychological wins.
      // Tiebreaker: highest APR.
      sortedLoans.sort((a, b) => {
        const balA = currentBalances.get(a.id) ?? a.balance;
        const balB = currentBalances.get(b.id) ?? b.balance;
        if (Math.abs(balA - balB) > 0.01) return balA - balB;
        return b.apr - a.apr;
      });
      break;

    case 'standard':
      // No priority ordering needed for standard.
      break;
  }

  return sortedLoans;
}

/**
 * Simulate a single payoff strategy with a given extra monthly payment.
 */
export function simulateStrategy(
  loans: LoanSnapshot[],
  extraPayment: number,
  strategy: PayoffStrategyType
): StrategyResult {
  const activeLoanBalances = new Map<string, number>();
  const loanInterestPaid = new Map<string, number>();
  const loanTotalPaid = new Map<string, number>();

  loans.forEach(loan => {
    activeLoanBalances.set(loan.id, loan.balance);
    loanInterestPaid.set(loan.id, 0);
    loanTotalPaid.set(loan.id, 0);
  });

  const monthlyEvents: StrategyMonthEvent[] = [];
  const payoffOrder: PayoffOrderItem[] = [];
  let month = 0;
  const maxMonths = 1200;

  // Freed minimums from paid-off loans roll into available extra each month.
  let freedMinPayments = 0;

  while (month < maxMonths) {
    if (Array.from(activeLoanBalances.values()).every(b => b <= 0.01)) break;

    month++;

    const activeLoans = loans.filter(loan =>
      (activeLoanBalances.get(loan.id) ?? 0) > 0.01
    );
    if (activeLoans.length === 0) break;

    const totalExtra = extraPayment + freedMinPayments;
    const loanPayments = new Map<string, number>();

    if (strategy === 'standard') {
      // Pay minimum to each loan first, then split any extra evenly.
      // This guarantees no loan is underpaid regardless of portfolio composition.
      let minimumOverflow = 0;
      activeLoans.forEach(loan => {
        const balance = activeLoanBalances.get(loan.id) ?? 0;
        const interest = monthlyInterestForLoan(balance, loan.apr, loan.loanType);
        const maxPayoff = balance + interest;
        const minimum = loan.loanType === 'credit-card'
          ? computeMinimumPayment(loan, balance)
          : loan.minimumPayment;
        const cappedMinimum = Math.min(minimum, maxPayoff);
        minimumOverflow += (minimum - cappedMinimum);
        loanPayments.set(loan.id, cappedMinimum);
      });

      let remainingExtra = totalExtra + minimumOverflow;
      let adjustable = [...activeLoans];
      while (remainingExtra > 0.01 && adjustable.length > 0) {
        const extraPerLoan = remainingExtra / adjustable.length;
        let distributed = 0;
        const nextAdjustable: LoanSnapshot[] = [];

        for (const loan of adjustable) {
          const balance = activeLoanBalances.get(loan.id) ?? 0;
          const interest = monthlyInterestForLoan(balance, loan.apr, loan.loanType);
          const currentPayment = loanPayments.get(loan.id) ?? 0;
          const maxExtra = Math.max(0, (balance + interest) - currentPayment);
          if (maxExtra <= 0.01) continue;

          const extraToApply = Math.min(extraPerLoan, maxExtra);
          loanPayments.set(loan.id, currentPayment + extraToApply);
          distributed += extraToApply;

          if (maxExtra - extraToApply > 0.01) {
            nextAdjustable.push(loan);
          }
        }

        if (distributed <= 0.01) break;
        remainingExtra -= distributed;
        adjustable = nextAdjustable;
      }

    } else {
      // Avalanche or Snowball: minimums to all, extra to priority loan(s) in order.
      const priorityLoans = getLoanPriority(activeLoans, strategy, activeLoanBalances);
      let minimumOverflow = 0;

      // Step 1: assign minimums to all active loans
      activeLoans.forEach(loan => {
        const balance = activeLoanBalances.get(loan.id) ?? 0;
        const interest = monthlyInterestForLoan(balance, loan.apr, loan.loanType);
        const maxPayoff = balance + interest;
        const minimum = loan.loanType === 'credit-card'
          ? computeMinimumPayment(loan, balance)
          : loan.minimumPayment;
        const cappedMinimum = Math.min(minimum, maxPayoff);
        minimumOverflow += (minimum - cappedMinimum);
        loanPayments.set(loan.id, cappedMinimum);
      });

      let remainingExtra = totalExtra + minimumOverflow;

      // Step 2: apply remaining extra to priority loans in order
      for (const loan of priorityLoans) {
        if (remainingExtra <= 0.01) break;

        const balance = activeLoanBalances.get(loan.id) ?? 0;
        const interest = monthlyInterestForLoan(balance, loan.apr, loan.loanType);
        const currentPayment = loanPayments.get(loan.id) ?? 0;
        const maxPayoff = balance + interest;
        const maxExtra = maxPayoff - currentPayment;

        if (maxExtra > 0.01) {
          const extraToApply = Math.min(remainingExtra, maxExtra);
          loanPayments.set(loan.id, currentPayment + extraToApply);
          remainingExtra -= extraToApply;
        }
      }
    }

    // Apply payments, accrue interest, update balances
    const monthEvent: StrategyMonthEvent = {
      month,
      loans: [],
      totalPayment: 0,
      totalBalance: 0
    };

    for (const loan of loans) {
      const startBalance = activeLoanBalances.get(loan.id) ?? 0;

      if (startBalance <= 0.01) {
        monthEvent.loans.push({
          loanId: loan.id,
          loanName: loan.name,
          startBalance: 0,
          payment: 0,
          interest: 0,
          endBalance: 0,
          isPaidOff: true
        });
        continue;
      }

      const requestedPayment = loanPayments.get(loan.id) ?? 0;
      const interest = monthlyInterestForLoan(startBalance, loan.apr, loan.loanType);
      // Payment is capped at full payoff — never overshoot the balance
      const payment = Math.min(requestedPayment, startBalance + interest);
      const endBalance = Math.max(0, startBalance + interest - payment);
      const isPaidOff = endBalance <= 0.01;

      activeLoanBalances.set(loan.id, endBalance);
      loanInterestPaid.set(loan.id, (loanInterestPaid.get(loan.id) ?? 0) + interest);
      loanTotalPaid.set(loan.id, (loanTotalPaid.get(loan.id) ?? 0) + payment);

      if (isPaidOff && !payoffOrder.find(p => p.loanId === loan.id)) {
        payoffOrder.push({
          loanId: loan.id,
          loanName: loan.name,
          payoffMonth: month,
          totalInterestPaid: loanInterestPaid.get(loan.id) ?? 0,
          totalPaid: loanTotalPaid.get(loan.id) ?? 0
        });
        // Freed minimum rolls into available extra for all future months.
        // Use the snapshot minimum — calling computeMinimumPayment with balance=0
        // would return the $25 floor for credit cards, not the actual freed amount.
        freedMinPayments += loan.minimumPayment;
      }

      monthEvent.loans.push({
        loanId: loan.id,
        loanName: loan.name,
        startBalance,
        payment,
        interest,
        endBalance,
        isPaidOff
      });

      monthEvent.totalPayment += payment;
      monthEvent.totalBalance += endBalance;
    }

    monthlyEvents.push(monthEvent);
  }

  const totalInterest = Array.from(loanInterestPaid.values()).reduce((sum, v) => sum + v, 0);
  const totalPaid = Array.from(loanTotalPaid.values()).reduce((sum, v) => sum + v, 0);

  return {
    strategy,
    totalMonths: month,
    totalInterest,
    totalPaid,
    interestSaved: 0,
    monthsSaved: 0,
    payoffOrder,
    monthlyEvents
  };
}

/**
 * Compare all three strategies against the user's configured budget as the baseline.
 *
 * extraPayment = additional amount ABOVE the configured monthly budget.
 *
 * "Interest saved" and "months saved" are vs. paying exactly the configured
 * budget with avalanche ordering (the default behaviour without any extra).
 */
export function compareStrategies(
  loanData: CombinedLoanResult,
  extraPayment: number
): StrategyComparison {
  const loans = createLoanSnapshots(loanData);

  // Budget surplus: how much the configured total exceeds per-loan minimums.
  // This is the amount that gets directed to the priority loan each month.
  const sumMins = loans.reduce((s, l) => s + l.minimumPayment, 0);
  const budgetExtra = Math.max(0, loanData.totalMonthlyPayment - sumMins);

  // Baseline: the configured budget, avalanche ordering, no additional extra.
  const baseline = simulateStrategy(loans, budgetExtra, 'avalanche');

  const totalExtra = budgetExtra + extraPayment;
  const avalanche = simulateStrategy(loans, totalExtra, 'avalanche');
  const snowball  = simulateStrategy(loans, totalExtra, 'snowball');
  const standard  = simulateStrategy(loans, totalExtra, 'standard');

  avalanche.interestSaved = baseline.totalInterest - avalanche.totalInterest;
  avalanche.monthsSaved   = baseline.totalMonths   - avalanche.totalMonths;

  snowball.interestSaved  = baseline.totalInterest - snowball.totalInterest;
  snowball.monthsSaved    = baseline.totalMonths   - snowball.totalMonths;

  standard.interestSaved  = baseline.totalInterest - standard.totalInterest;
  standard.monthsSaved    = baseline.totalMonths   - standard.totalMonths;

  return {
    extraPayment,
    strategies: { avalanche, snowball, standard }
  };
}

/**
 * Format currency for display
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

/**
 * Format months as years and months
 */
export function formatMonths(months: number): string {
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;

  if (years === 0) {
    return `${remainingMonths} month${remainingMonths !== 1 ? 's' : ''}`;
  } else if (remainingMonths === 0) {
    return `${years} year${years !== 1 ? 's' : ''}`;
  } else {
    return `${years}y ${remainingMonths}m`;
  }
}
