// Payoff Strategy Types

export type PayoffStrategyType = 'avalanche' | 'snowball' | 'standard';

export interface LoanSnapshot {
  id: string;
  name: string;
  balance: number;
  apr: number;
  minimumPayment: number;
  loanType: string;
}

export interface PayoffOrderItem {
  loanId: string;
  loanName: string;
  payoffMonth: number;
  totalInterestPaid: number;
  totalPaid: number;
}

export interface StrategyMonthEvent {
  month: number;
  loans: {
    loanId: string;
    loanName: string;
    startBalance: number;
    payment: number;
    interest: number;
    endBalance: number;
    isPaidOff: boolean;
  }[];
  totalPayment: number;
  totalBalance: number;
}

export interface StrategyResult {
  strategy: PayoffStrategyType;
  totalMonths: number;
  totalInterest: number;
  totalPaid: number;
  interestSaved: number;  // vs standard
  monthsSaved: number;    // vs standard
  payoffOrder: PayoffOrderItem[];
  monthlyEvents: StrategyMonthEvent[];
}

export interface StrategyComparison {
  extraPayment: number;
  strategies: {
    avalanche: StrategyResult;
    snowball: StrategyResult;
    standard: StrategyResult;
  };
}

export const STRATEGY_INFO: Record<PayoffStrategyType, { label: string; description: string }> = {
  avalanche: {
    label: 'Avalanche',
    description: 'Pay highest interest rate first - saves the most money'
  },
  snowball: {
    label: 'Snowball',
    description: 'Pay smallest balance first - quick wins for motivation'
  },
  standard: {
    label: 'Standard',
    description: 'Equal distribution - same payment to each loan'
  }
};
