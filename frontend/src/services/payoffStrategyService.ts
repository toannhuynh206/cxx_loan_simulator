import { CombinedLoanResult } from '../types/loan';
import {
  PayoffStrategyType,
  LoanSnapshot,
  StrategyResult,
  StrategyComparison,
  StrategyMonthEvent,
  PayoffOrderItem
} from '../types/payoffStrategy';

/**
 * Calculate a minimum payment based on standard amortization
 * Used as fallback if no payment is provided
 */
function calculateFallbackMinimum(balance: number, apr: number, termMonths: number = 120): number {
  if (balance <= 0) return 0;

  const monthlyRate = apr / 100 / 12;

  // Handle 0% interest edge case
  if (monthlyRate === 0) {
    return balance / termMonths;
  }

  // Standard amortization formula
  const payment = balance * (monthlyRate * Math.pow(1 + monthlyRate, termMonths))
                / (Math.pow(1 + monthlyRate, termMonths) - 1);

  return Math.min(payment, balance);
}

/**
 * Convert backend loan results to strategy input snapshots
 */
export function createLoanSnapshots(loanData: CombinedLoanResult): LoanSnapshot[] {
  return loanData.loans.map(loan => {
    // Use the actual payment from the backend, or calculate a fallback
    // The fallback uses the loan's total months if available, otherwise defaults to 10 years
    let minimumPayment = loan.minimumPayment || loan.monthlyPayment;

    // If no payment is set, calculate based on the loan's actual payoff time
    if (!minimumPayment || minimumPayment <= 0) {
      const termMonths = loan.totalMonths || 120;
      minimumPayment = calculateFallbackMinimum(loan.principal, loan.apr, termMonths);
    }

    return {
      id: loan.loanId,
      name: loan.loanName,
      balance: loan.principal,
      apr: loan.apr,
      minimumPayment,
      loanType: loan.loanType
    };
  });
}

/**
 * Get the priority order for loans based on strategy
 */
function getLoanPriority(
  loans: LoanSnapshot[],
  strategy: PayoffStrategyType
): LoanSnapshot[] {
  const sortedLoans = [...loans];

  switch (strategy) {
    case 'avalanche':
      // Highest APR first, then smallest balance as tiebreaker
      sortedLoans.sort((a, b) => {
        if (b.apr !== a.apr) return b.apr - a.apr;
        return a.balance - b.balance;
      });
      break;
    case 'snowball':
      // Smallest balance first, then highest APR as tiebreaker
      sortedLoans.sort((a, b) => {
        if (a.balance !== b.balance) return a.balance - b.balance;
        return b.apr - a.apr;
      });
      break;
    case 'standard':
      // No specific priority for standard - keep original order
      break;
  }

  return sortedLoans;
}

/**
 * Simulate a single strategy with given extra payment
 */
export function simulateStrategy(
  loans: LoanSnapshot[],
  extraPayment: number,
  strategy: PayoffStrategyType
): StrategyResult {
  // Deep clone loans to track balances
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
  const maxMonths = 1200; // 100 years max

  // Track freed up minimum payments from paid-off loans
  let freedMinPayments = 0;

  while (month < maxMonths) {
    // Check if all loans are paid off
    const remainingBalances = Array.from(activeLoanBalances.values());
    if (remainingBalances.every(b => b <= 0.01)) break;

    month++;

    // Get active loans (balance > 0.01)
    const activeLoans = loans.filter(loan =>
      (activeLoanBalances.get(loan.id) || 0) > 0.01
    );

    if (activeLoans.length === 0) break;

    // Calculate total available extra payment (original extra + freed minimums)
    const totalExtra = extraPayment + freedMinPayments;

    // Distribute payments based on strategy
    const loanPayments = new Map<string, number>();

    if (strategy === 'standard') {
      // Even distribution: total budget split equally across all active loans
      // Total budget = sum of all minimum payments + extra payment + freed minimums
      const totalMinimums = activeLoans.reduce((sum, loan) => sum + loan.minimumPayment, 0);
      const totalBudget = totalMinimums + totalExtra;
      const paymentPerLoan = totalBudget / activeLoans.length;

      activeLoans.forEach(loan => {
        const balance = activeLoanBalances.get(loan.id) || 0;
        const payment = Math.min(paymentPerLoan, balance);
        loanPayments.set(loan.id, payment);
      });
    } else {
      // Avalanche or Snowball: minimums on all, extra to priority loan
      const priorityLoans = getLoanPriority(activeLoans, strategy);

      // First, assign minimum payments to all active loans
      let remainingExtra = totalExtra;

      activeLoans.forEach(loan => {
        const balance = activeLoanBalances.get(loan.id) || 0;
        const payment = Math.min(loan.minimumPayment, balance);
        loanPayments.set(loan.id, payment);
      });

      // Then apply extra to priority loans in order
      for (const loan of priorityLoans) {
        if (remainingExtra <= 0) break;

        const balance = activeLoanBalances.get(loan.id) || 0;
        const currentPayment = loanPayments.get(loan.id) || 0;
        const maxExtra = balance - currentPayment;

        if (maxExtra > 0) {
          const extraToApply = Math.min(remainingExtra, maxExtra);
          loanPayments.set(loan.id, currentPayment + extraToApply);
          remainingExtra -= extraToApply;
        }
      }
    }

    // Apply payments and calculate interest
    const monthEvent: StrategyMonthEvent = {
      month,
      loans: [],
      totalPayment: 0,
      totalBalance: 0
    };

    for (const loan of loans) {
      const startBalance = activeLoanBalances.get(loan.id) || 0;

      if (startBalance <= 0.01) {
        // Loan already paid off
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

      const payment = loanPayments.get(loan.id) || 0;
      const monthlyRate = loan.apr / 100 / 12;

      // Standard amortization: interest calculated on starting balance
      // 1. Calculate interest on the starting balance
      // 2. Subtract payment from balance
      // 3. Add interest to get ending balance
      const interest = startBalance * monthlyRate;
      const endBalance = Math.max(0, startBalance - payment + interest);
      const isPaidOff = endBalance <= 0.01;

      // Update tracking
      activeLoanBalances.set(loan.id, endBalance);
      loanInterestPaid.set(loan.id, (loanInterestPaid.get(loan.id) || 0) + interest);
      loanTotalPaid.set(loan.id, (loanTotalPaid.get(loan.id) || 0) + payment);

      // Record payoff
      if (isPaidOff && !payoffOrder.find(p => p.loanId === loan.id)) {
        payoffOrder.push({
          loanId: loan.id,
          loanName: loan.name,
          payoffMonth: month,
          totalInterestPaid: loanInterestPaid.get(loan.id) || 0,
          totalPaid: loanTotalPaid.get(loan.id) || 0
        });
        // Add this loan's minimum payment to freed payments
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

  // Calculate totals
  const totalInterest = Array.from(loanInterestPaid.values()).reduce((sum, v) => sum + v, 0);
  const totalPaid = Array.from(loanTotalPaid.values()).reduce((sum, v) => sum + v, 0);

  return {
    strategy,
    totalMonths: month,
    totalInterest,
    totalPaid,
    interestSaved: 0, // Will be calculated in comparison
    monthsSaved: 0,   // Will be calculated in comparison
    payoffOrder,
    monthlyEvents
  };
}

/**
 * Compare all three strategies
 */
export function compareStrategies(
  loanData: CombinedLoanResult,
  extraPayment: number
): StrategyComparison {
  const loans = createLoanSnapshots(loanData);

  // First, run baseline simulation with NO extra payment to get the original payoff time
  const baseline = simulateStrategy(loans, 0, 'standard');

  // Run all three simulations with the extra payment
  const avalanche = simulateStrategy(loans, extraPayment, 'avalanche');
  const snowball = simulateStrategy(loans, extraPayment, 'snowball');
  const standard = simulateStrategy(loans, extraPayment, 'standard');

  // Calculate savings vs baseline (no extra payment)
  // This shows how much time/interest you save by adding extra payment
  avalanche.interestSaved = baseline.totalInterest - avalanche.totalInterest;
  avalanche.monthsSaved = baseline.totalMonths - avalanche.totalMonths;

  snowball.interestSaved = baseline.totalInterest - snowball.totalInterest;
  snowball.monthsSaved = baseline.totalMonths - snowball.totalMonths;

  standard.interestSaved = baseline.totalInterest - standard.totalInterest;
  standard.monthsSaved = baseline.totalMonths - standard.totalMonths;

  return {
    extraPayment,
    strategies: {
      avalanche,
      snowball,
      standard
    }
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
