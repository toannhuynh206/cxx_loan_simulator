// Loan Types
export type LoanType = 'credit-card' | 'personal-loan' | 'auto-loan' | 'mortgage' | 'student-loan';

export interface LoanTypeInfo {
  id: LoanType;
  label: string;
  icon: string;
  description: string;
}

export const LOAN_TYPES: LoanTypeInfo[] = [
  {
    id: 'student-loan',
    label: 'Student Loan',
    icon: '🎓',
    description: 'Education debt'
  },
  {
    id: 'credit-card',
    label: 'Credit Card',
    icon: '💳',
    description: 'Revolving debt with variable payments'
  },
  {
    id: 'personal-loan',
    label: 'Personal Loan',
    icon: '💰',
    description: 'Fixed-term general purpose loans'
  },
  {
    id: 'auto-loan',
    label: 'Auto Loan',
    icon: '🚗',
    description: 'Vehicle financing'
  },
  {
    id: 'mortgage',
    label: 'Mortgage',
    icon: '🏠',
    description: 'Home loans'
  }
];

// Base loan entry interface
export interface BaseLoanEntry {
  id: string;
  name: string;
  balance: number;
  interestRate: number; // Generic interest rate field
  monthlyPayment: number;
}

// Credit Card - Daily compounding, APR-based
export interface CreditCardEntry extends BaseLoanEntry {
  type: 'credit-card';
  apr: number; // Annual Percentage Rate
  creditLimit: number;
  minimumPaymentPercent: number; // Usually 1-3%
  minimumPaymentFloor: number; // Usually $25-35
}

// Personal Loan - Simple interest, fixed term
export interface PersonalLoanEntry extends BaseLoanEntry {
  type: 'personal-loan';
  interestRate: number; // Fixed APR
  termMonths: number; // Loan term in months
  originationFeePercent: number; // 1-8% typical
}

// Auto Loan - Simple interest with depreciation tracking
export interface AutoLoanEntry extends BaseLoanEntry {
  type: 'auto-loan';
  interestRate: number; // Fixed rate
  termMonths: number; // 36, 48, 60, 72, 84 months
  vehiclePrice: number;
  downPayment: number;
  tradeInValue: number;
  tradeInPayoff: number; // Remaining loan on trade-in
  vehicleYear: number; // For depreciation calculation
  isUsed: boolean;
}

// Mortgage - PITI with PMI tracking
export interface MortgageEntry extends BaseLoanEntry {
  type: 'mortgage';
  interestRate: number; // Fixed rate
  termYears: number; // 15, 20, or 30 years
  homePrice: number;
  downPayment: number;
  downPaymentPercent: number;
  propertyTaxAnnual: number;
  homeInsuranceAnnual: number;
  pmiRate: number; // PMI rate if down payment < 20%
  hoaMonthly: number;
  includeEscrow: boolean;
}

// Student Loan - Simple interest amortization
export interface StudentLoanEntry extends BaseLoanEntry {
  type: 'student-loan';
  interestRate: number; // Fixed rate
}

export type LoanEntry = CreditCardEntry | PersonalLoanEntry | AutoLoanEntry | MortgageEntry | StudentLoanEntry;

// All loans state
export interface AllLoans {
  'credit-card': CreditCardEntry[];
  'personal-loan': PersonalLoanEntry[];
  'auto-loan': AutoLoanEntry[];
  'mortgage': MortgageEntry[];
  'student-loan': StudentLoanEntry[];
}

// API types (keeping existing for backend compatibility)
export interface LoanRequest {
  principal: number;
  apr: number;
  monthlyPayment: number;
}

export interface MonthlyEvent {
  month: number;
  startBalance: number;
  interest: number;
  payment: number;
  endBalance: number;
  principalPaid?: number;
  pmiPayment?: number;
  escrowPayment?: number;
  totalPayment?: number;
}

export interface LoanResponse {
  principal: number;
  apr: number;
  monthlyPayment: number;
  events: MonthlyEvent[];
  totalMonths: number;
  totalInterest: number;
}

export interface ChartDataPoint {
  month: number;
  interest: number | null;
  payment: number | null;
}

// Extended response for multiple loans
export interface LoanCalculationResult extends LoanResponse {
  loanId: string;
  loanName: string;
  loanType: LoanType;
  totalPaid?: number;
  totalPMI?: number;
  totalEscrow?: number;
  minimumPayment?: number;
  vehicleValue?: number;
  equityPercent?: number;
}

export interface CombinedLoanResult {
  loans: LoanCalculationResult[];
  totalPrincipal: number;
  totalInterest: number;
  totalMonths: number;
  totalMonthlyPayment: number;
  totalPaid?: number;
}
