import React, { useState, useMemo, useEffect } from 'react';
import {
  LoanType,
  LoanEntry,
  AllLoans,
  LOAN_TYPES,
  CreditCardEntry,
  PersonalLoanEntry,
  AutoLoanEntry,
  MortgageEntry,
  StudentLoanEntry,
  LoanInputMode,
} from '../types/loan';
import { PayoffStrategyType } from '../types/payoffStrategy';
import { monthlyInterestForLoan, paymentForTerm } from '../utils/amortization';
import { InfoTooltip, FIELD_DEFINITIONS } from './InfoTooltip';

type StudentLoanMode = 'auto' | 'specify';

interface LoanInputProps {
  onCalculate: (loans: LoanEntry[], budget: number, strategy: PayoffStrategyType, mode: 'auto' | 'specify') => void;
  isLoading: boolean;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

const STORAGE_KEY = 'loanscope_form';

const loadSavedForm = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
};

const EMPTY_LOANS: AllLoans = {
  'credit-card': [],
  'personal-loan': [],
  'auto-loan': [],
  'mortgage': [],
  'student-loan': [],
};

// Sample data for each loan type - realistic scenarios
const SAMPLE_DATA = {
  // Federal student loans — realistic disbursement amounts & current fixed rates
  'student-loan': (): StudentLoanEntry[] => [
    { id: generateId(), name: '1-01 Direct Unsubsidized', type: 'student-loan', balance: 2466.11, interestRate: 2.750, monthlyPayment: 0 },
    { id: generateId(), name: '1-02 Direct Subsidized',   type: 'student-loan', balance: 1336.32, interestRate: 2.750, monthlyPayment: 0 },
    { id: generateId(), name: '1-03 Direct Unsubsidized', type: 'student-loan', balance: 1146.21, interestRate: 2.750, monthlyPayment: 0 },
    { id: generateId(), name: '1-04 Direct Subsidized',   type: 'student-loan', balance: 2014.15, interestRate: 3.730, monthlyPayment: 0 },
    { id: generateId(), name: '1-05 Direct Unsubsidized', type: 'student-loan', balance: 933.94,  interestRate: 3.730, monthlyPayment: 0 },
    { id: generateId(), name: '1-06 Direct Subsidized',   type: 'student-loan', balance: 2014.15, interestRate: 3.730, monthlyPayment: 0 },
    { id: generateId(), name: '1-07 Direct Unsubsidized', type: 'student-loan', balance: 933.94,  interestRate: 3.730, monthlyPayment: 0 },
    { id: generateId(), name: '1-08 Direct Subsidized',   type: 'student-loan', balance: 2479.52, interestRate: 4.990, monthlyPayment: 0 },
    { id: generateId(), name: '1-09 Direct Unsubsidized', type: 'student-loan', balance: 950.43,  interestRate: 4.990, monthlyPayment: 0 },
    { id: generateId(), name: '1-10 Direct Subsidized',   type: 'student-loan', balance: 2479.52, interestRate: 4.990, monthlyPayment: 0 },
    { id: generateId(), name: '1-11 Direct Unsubsidized', type: 'student-loan', balance: 953.44,  interestRate: 4.990, monthlyPayment: 0 },
    { id: generateId(), name: '1-12 Direct Subsidized',   type: 'student-loan', balance: 2487.22, interestRate: 5.500, monthlyPayment: 0 },
    { id: generateId(), name: '1-13 Direct Unsubsidized', type: 'student-loan', balance: 957.70,  interestRate: 5.500, monthlyPayment: 0 },
    { id: generateId(), name: '1-14 Direct Subsidized',   type: 'student-loan', balance: 2487.22, interestRate: 5.500, monthlyPayment: 0 },
    { id: generateId(), name: '1-15 Direct Unsubsidized', type: 'student-loan', balance: 932.55,  interestRate: 5.500, monthlyPayment: 0 },
  ],

  // Credit cards — avg US household carries ~$6,200 across 3-4 cards (2024)
  // APRs reflect current high-rate environment (Fed funds rate peak 2023-24)
  'credit-card': (): CreditCardEntry[] => [
    {
      id: generateId(), name: 'Chase Freedom Flex', type: 'credit-card',
      balance: 3420, interestRate: 24.49, apr: 24.49, monthlyPayment: 0,
      creditLimit: 8500, minimumPaymentPercent: 2, minimumPaymentFloor: 25,
    },
    {
      id: generateId(), name: 'Capital One Quicksilver', type: 'credit-card',
      balance: 1850, interestRate: 29.99, apr: 29.99, monthlyPayment: 0,
      creditLimit: 5500, minimumPaymentPercent: 2, minimumPaymentFloor: 25,
    },
    {
      id: generateId(), name: 'Discover it Cash Back', type: 'credit-card',
      balance: 940, interestRate: 21.99, apr: 21.99, monthlyPayment: 0,
      creditLimit: 3200, minimumPaymentPercent: 2, minimumPaymentFloor: 25,
    },
  ],

  // Personal loan — most common use: debt consolidation ($10-15k, 11-13% for good credit)
  'personal-loan': (): PersonalLoanEntry[] => [
    {
      id: generateId(), name: 'Debt Consolidation', type: 'personal-loan',
      balance: 11500, interestRate: 11.99, monthlyPayment: 0,
      termMonths: 48, originationFeePercent: 2.0,
      hasPrepaymentPenalty: false, prepaymentPenaltyPercent: 2,
    },
  ],

  // Auto loan — one entry with both modes pre-filled
  // Existing: ~2 yrs into a 60-mo loan on a 2022 Camry (balance $18,650 @ 6.99%)
  // Future:   2025 Honda CR-V EX — balance = 36,000 + 7% tax + $895 fees − $4k down = $35,415
  'auto-loan': (): AutoLoanEntry[] => [
    {
      id: generateId(), name: 'Auto Loan', type: 'auto-loan',
      inputMode: 'existing',
      // Existing mode fields
      balance: 18650, interestRate: 6.99, monthlyPayment: 488, termMonths: 60,
      // Future mode fields (pre-filled so switching modes shows sample data)
      vehiclePrice: 36000, downPayment: 4000, tradeInValue: 0, tradeInPayoff: 0,
      salesTaxPercent: 7.0, docAndRegFees: 895,
      vehicleYear: 2025, isUsed: false,
    },
  ],

  // Mortgage — one entry with both modes pre-filled
  // Existing: 2021 refi at historically low rates (~3.125%), ~4 yrs in on a $310k original loan
  // Future:   US median home ($417k, NAR 2024), 20% down, current 30-yr rate ~6.875%
  'mortgage': (): MortgageEntry[] => [
    {
      id: generateId(), name: 'Mortgage', type: 'mortgage',
      inputMode: 'existing',
      // Existing mode fields
      balance: 287500, interestRate: 3.125, monthlyPayment: 1231, termYears: 30,
      // Future mode fields (pre-filled so switching modes shows sample data)
      homePrice: 417000, downPayment: 83400, downPaymentPercent: 20,
      propertyTaxAnnual: 0, homeInsuranceAnnual: 0, pmiRate: 0.5,
      hoaMonthly: 0, includeEscrow: false,
    },
  ],
};

const createEmptyLoan = (type: LoanType): LoanEntry => {
  const base = {
    id: generateId(),
    name: '',
    balance: 0,
    interestRate: 0,
    monthlyPayment: 0,
  };

  switch (type) {
    case 'credit-card':
      return {
        ...base,
        type: 'credit-card',
        apr: 0,
        creditLimit: 0,
        minimumPaymentPercent: 2,
        minimumPaymentFloor: 25,
      } as CreditCardEntry;
    case 'personal-loan':
      return {
        ...base,
        type: 'personal-loan',
        termMonths: 36,
        originationFeePercent: 0,
        hasPrepaymentPenalty: false,
        prepaymentPenaltyPercent: 2,
      } as PersonalLoanEntry;
    case 'auto-loan':
      return {
        ...base,
        type: 'auto-loan',
        inputMode: 'future',
        termMonths: 60,
        vehiclePrice: 0,
        downPayment: 0,
        tradeInValue: 0,
        tradeInPayoff: 0,
        vehicleYear: new Date().getFullYear(),
        isUsed: false,
        salesTaxPercent: 0,
        docAndRegFees: 0,
      } as AutoLoanEntry;
    case 'mortgage':
      return {
        ...base,
        type: 'mortgage',
        inputMode: 'future',
        termYears: 30,
        homePrice: 0,
        downPayment: 0,
        downPaymentPercent: 20,
        propertyTaxAnnual: 0,
        homeInsuranceAnnual: 0,
        pmiRate: 0.5,
        hoaMonthly: 0,
        includeEscrow: true,
      } as MortgageEntry;
    case 'student-loan':
      return {
        ...base,
        type: 'student-loan',
      } as StudentLoanEntry;
  }
};

export const LoanInput: React.FC<LoanInputProps> = ({ onCalculate, isLoading }) => {
  const [activeTab, setActiveTab] = useState<LoanType>(() => loadSavedForm()?.activeTab ?? 'student-loan');
  const [loans, setLoans] = useState<AllLoans>(() => loadSavedForm()?.loans ?? EMPTY_LOANS);

  // Generic allocation state — applies to whichever loan type is active
  const [allocationMode, setAllocationMode] = useState<StudentLoanMode>(() => loadSavedForm()?.allocationMode ?? 'auto');
  const [allocationBudget, setAllocationBudget] = useState<number>(() => loadSavedForm()?.allocationBudget ?? 0);
  const [allocationStrategy, setAllocationStrategy] = useState<PayoffStrategyType>(() => loadSavedForm()?.allocationStrategy ?? 'avalanche');
  const [showAllocation, setShowAllocation] = useState<boolean>(() => loadSavedForm()?.showAllocation ?? false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Persist form state to localStorage on every change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      activeTab, loans, allocationMode, allocationBudget, allocationStrategy, showAllocation,
    }));
  }, [activeTab, loans, allocationMode, allocationBudget, allocationStrategy, showAllocation]);

  // Inline editing state for loan names
  const [editingLoanId, setEditingLoanId] = useState<string | null>(null);

  // Which loan type is currently in use (the type that has loans, or null if none).
  // Enforces single-type constraint: once one type has loans, other tabs are locked.
  const lockedType: LoanType | null =
    (Object.keys(loans) as LoanType[]).find(type => loans[type].length > 0) ?? null;

  const addLoan = (type: LoanType) => {
    // Enforce single loan type — no mixing allowed
    if (lockedType !== null && type !== lockedType) return;
    setLoans(prev => {
      const newLoan = createEmptyLoan(type);
      const newIndex = prev[type].length + 1;
      newLoan.name = `Loan ${newIndex}`;
      return {
        ...prev,
        [type]: [...prev[type], newLoan],
      };
    });
  };

  const removeLoan = (type: LoanType, id: string) => {
    setLoans(prev => {
      const updated = prev[type].filter(loan => loan.id !== id);
      // Reset allocation state when the last loan of this type is removed
      if (updated.length === 0) {
        setShowAllocation(false);
        setAllocationBudget(0);
      }
      return { ...prev, [type]: updated };
    });
  };

  const loadSampleData = (type: LoanType) => {
    const generator = SAMPLE_DATA[type as keyof typeof SAMPLE_DATA];
    if (!generator) return;

    const sampleLoans = (generator as () => LoanEntry[])();
    setLoans(prev => ({ ...prev, [type]: sampleLoans }));

    if (type === 'student-loan') {
      // Default budget = sum of Standard Repayment minimums (120 months)
      const totalMin = (sampleLoans as StudentLoanEntry[]).reduce((sum, loan) =>
        sum + paymentForTerm(loan.balance, loan.interestRate, 120), 0);
      setAllocationBudget(Math.ceil(totalMin));
      setShowAllocation(false);
    } else if (type === 'credit-card') {
      // Budget = sum of effective minimums: max(policy min, interest floor + $0.01)
      // Must use interest-floor-aware formula — for high-APR cards the 2% minimum
      // can fall below monthly interest, which would never pay off the balance.
      const totalMin = (sampleLoans as CreditCardEntry[]).reduce((sum, loan) => {
        const cc = loan as CreditCardEntry;
        const policyMin = Math.max(cc.balance * (cc.minimumPaymentPercent / 100), cc.minimumPaymentFloor);
        const interestFloor = monthlyInterestForLoan(cc.balance, cc.apr, 'credit-card') + 0.01;
        return sum + Math.max(policyMin, interestFloor);
      }, 0);
      setAllocationBudget(Math.ceil(totalMin));
      setShowAllocation(false);
    } else if (type === 'personal-loan') {
      const totalMin = (sampleLoans as PersonalLoanEntry[]).reduce((sum, loan) =>
        sum + paymentForTerm(loan.balance, loan.interestRate, loan.termMonths || 48, 'personal-loan'), 0);
      setAllocationBudget(Math.ceil(totalMin));
      setShowAllocation(false);
    } else if (type === 'auto-loan') {
      // Single merged entry — use the existing mode payment as the budget baseline
      const totalMin = (sampleLoans as AutoLoanEntry[]).reduce((sum, loan) =>
        sum + (loan.monthlyPayment > 0 ? loan.monthlyPayment : paymentForTerm(loan.balance, loan.interestRate, loan.termMonths || 60, 'auto-loan')), 0);
      setAllocationBudget(Math.ceil(totalMin));
      setShowAllocation(false);
    } else if (type === 'mortgage') {
      // Single merged entry — use the existing mode payment as the budget baseline
      const totalMin = (sampleLoans as MortgageEntry[]).reduce((sum, loan) =>
        sum + (loan.monthlyPayment > 0 ? loan.monthlyPayment : paymentForTerm(loan.balance, loan.interestRate, (loan.termYears || 30) * 12, 'mortgage')), 0);
      setAllocationBudget(Math.ceil(totalMin));
      setShowAllocation(false);
    }
  };

  const updateLoan = (type: LoanType, id: string, field: string, value: string | number | boolean) => {
    setLoans(prev => ({
      ...prev,
      [type]: prev[type].map(loan =>
        loan.id === id ? { ...loan, [field]: value } : loan
      ),
    }));
  };

  // Returns the effective annual interest rate for any loan type.
  // Credit cards store their rate in `apr`; all others use `interestRate`.
  const getEffectiveRate = (loan: LoanEntry): number =>
    loan.type === 'credit-card' ? (loan as CreditCardEntry).apr : loan.interestRate;

  // Compute effective APR including origination fee via binary search (IRR).
  const computeEffectiveAPR = (balance: number, feePercent: number, termMonths: number, statedAPR: number): number | null => {
    if (feePercent <= 0 || balance <= 0 || termMonths <= 0) return null;
    const r = statedAPR / 100 / 12;
    const pmt = r > 0 ? balance * r / (1 - Math.pow(1 + r, -termMonths)) : balance / termMonths;
    const netProceeds = balance * (1 - feePercent / 100);
    let lo = r * 0.5, hi = Math.max(r * 5, 0.05);
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      if (mid <= 0) break;
      const pv = pmt / mid * (1 - Math.pow(1 + mid, -termMonths));
      if (pv > netProceeds) lo = mid; else hi = mid;
    }
    return ((lo + hi) / 2) * 12 * 100;
  };

  // Generic minimum payment for any loan type.
  // Used for both the allocation algorithm and the manual-mode sliders.
  const computeLoanMinimum = (loan: LoanEntry): number => {
    switch (loan.type) {
      case 'credit-card': {
        const cc = loan as CreditCardEntry;
        const policyMinimum = Math.max(loan.balance * (cc.minimumPaymentPercent / 100), cc.minimumPaymentFloor);
        const interestFloor = monthlyInterestForLoan(loan.balance, cc.apr, loan.type) + 0.01;
        return Math.max(policyMinimum, interestFloor);
      }
      case 'personal-loan':
        return paymentForTerm(loan.balance, loan.interestRate, (loan as PersonalLoanEntry).termMonths || 60, 'personal-loan');
      case 'auto-loan': {
        const autoLoan = loan as AutoLoanEntry;
        if (autoLoan.monthlyPayment > 0) return autoLoan.monthlyPayment;
        return paymentForTerm(loan.balance, loan.interestRate, autoLoan.termMonths || 60, 'auto-loan');
      }
      case 'mortgage': {
        const mortgage = loan as MortgageEntry;
        if (mortgage.monthlyPayment > 0) return mortgage.monthlyPayment;
        const termMonths = (mortgage.termYears || 30) * 12;
        return paymentForTerm(loan.balance, loan.interestRate, termMonths, 'mortgage');
      }
      case 'student-loan':
      default:
        return paymentForTerm(loan.balance, loan.interestRate, 120, 'student-loan');
    }
  };

  // Auto-allocate a monthly budget across multiple loans of the same type.
  // Algorithm: minimums to all first, then extra directed by strategy (avalanche/snowball/equal).
  const getAutoAllocatedLoans = (type: LoanType): LoanEntry[] => {
    const activeLoansOfType = loans[type].filter(loan => loan.balance > 0);
    if (activeLoansOfType.length === 0 || allocationBudget <= 0) return activeLoansOfType;

    // Sort by strategy
    const sortedLoans = [...activeLoansOfType];
    if (allocationStrategy === 'avalanche') {
      sortedLoans.sort((a, b) => getEffectiveRate(b) - getEffectiveRate(a));
    } else if (allocationStrategy === 'snowball') {
      sortedLoans.sort((a, b) => a.balance - b.balance);
    }

    const loansWithMinimums = sortedLoans.map(loan => ({
      ...loan,
      calculatedMinPayment: Math.min(computeLoanMinimum(loan), loan.balance),
    }));

    // Max payable in one month (prevents overpaying beyond balance + accrued interest).
    // Credit cards use APR/365×30 (daily accrual); installment loans use APR/12.
    const maxPayoff = (loan: LoanEntry) => {
      const rate = getEffectiveRate(loan) / 100;
      const monthlyRate = loan.type === 'credit-card' ? rate / 365 * 30 : rate / 12;
      return loan.balance * (1 + monthlyRate);
    };
    const allocatedPayments = new Map<string, number>();

    if (allocationStrategy === 'standard') {
      let remainingBudget = allocationBudget;
      const active = loansWithMinimums.filter(l => l.balance > 0);

      // Step 1: minimums to all — never underpay (avoids negative amortization)
      for (const loan of active) {
        const min = Math.min(loan.calculatedMinPayment, remainingBudget, loan.balance);
        allocatedPayments.set(loan.id, min);
        remainingBudget -= min;
      }
      // Step 2: distribute remaining extra evenly
      if (remainingBudget > 0 && active.length > 0) {
        let adjustable = [...active];
        while (remainingBudget > 0.01 && adjustable.length > 0) {
          const extraPerLoan = remainingBudget / adjustable.length;
          let distributed = 0;
          const nextAdjustable: typeof adjustable = [];

          for (const loan of adjustable) {
            const current = allocatedPayments.get(loan.id) ?? 0;
            const maxExtra = Math.max(0, maxPayoff(loan) - current);
            if (maxExtra <= 0.01) continue;

            const extra = Math.min(extraPerLoan, maxExtra);
            allocatedPayments.set(loan.id, current + extra);
            distributed += extra;

            if (maxExtra - extra > 0.01) {
              nextAdjustable.push(loan);
            }
          }

          if (distributed <= 0.01) break;
          remainingBudget -= distributed;
          adjustable = nextAdjustable;
        }
      }
    } else {
      // Avalanche or Snowball: minimums to all, then extra to priority loan(s) in order
      let remainingBudget = allocationBudget;
      for (const loan of loansWithMinimums) {
        const min = Math.min(loan.calculatedMinPayment, remainingBudget, loan.balance);
        allocatedPayments.set(loan.id, min);
        remainingBudget -= min;
      }
      for (const loan of loansWithMinimums) {
        if (remainingBudget <= 0) break;
        const current = allocatedPayments.get(loan.id) || 0;
        const extra = Math.min(remainingBudget, Math.max(0, maxPayoff(loan) - current));
        allocatedPayments.set(loan.id, current + extra);
        remainingBudget -= extra;
      }
    }

    return activeLoansOfType.map(loan => ({
      ...loan,
      monthlyPayment: Math.round((allocatedPayments.get(loan.id) || 0) * 100) / 100,
    }));
  };

  // Memoized allocated loans for the active tab
  const autoAllocatedLoans = useMemo(() => {
    if (allocationMode !== 'auto') return [] as LoanEntry[];
    return getAutoAllocatedLoans(activeTab);
  }, [loans, allocationBudget, allocationStrategy, allocationMode, activeTab]);

  const getAllLoans = (): LoanEntry[] => {
    if (lockedType === null) return [];
    const validCount = loans[lockedType].filter(l => l.balance > 0).length;
    // Use allocation for multi-loan auto mode; otherwise use raw entries
    const processedLoans = allocationMode === 'auto' && validCount > 1
      ? getAutoAllocatedLoans(lockedType)
      : loans[lockedType];
    return processedLoans.filter(loan => loan.balance > 0);
  };

  const getTotalLoans = () => {
    return Object.values(loans).reduce((sum, arr) => sum + arr.length, 0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const invalidAutoLoans = loans['auto-loan'].filter((loan) => {
      if (loan.balance <= 0) return false;
      const mode = loan.inputMode ?? 'future';
      if (mode === 'existing') {
        return loan.interestRate <= 0 || loan.interestRate > 100 || loan.monthlyPayment <= 0;
      }
      return (
        loan.vehiclePrice <= 0 ||
        loan.interestRate <= 0 ||
        loan.interestRate > 100 ||
        loan.termMonths <= 0 ||
        loan.downPayment < 0 ||
        loan.tradeInValue < 0 ||
        loan.tradeInPayoff < 0
      );
    });

    if (invalidAutoLoans.length > 0) {
      setSubmitError(
        'Auto loans require: balance > 0, APR between 0 and 100, and monthly payment > 0 in existing mode. For future purchase: vehicle price > 0 and valid term.'
      );
      return;
    }

    const invalidMortgages = loans.mortgage.filter((loan) => {
      if (loan.balance <= 0) return false;
      const mode = loan.inputMode ?? 'future';

      if (mode === 'existing') {
        return loan.interestRate <= 0 || loan.interestRate > 100 || loan.monthlyPayment <= 0;
      }

      return (
        loan.homePrice <= 0 ||
        loan.interestRate <= 0 ||
        loan.interestRate > 100 ||
        loan.termYears <= 0 ||
        loan.propertyTaxAnnual < 0 ||
        loan.homeInsuranceAnnual < 0 ||
        loan.pmiRate < 0 ||
        loan.hoaMonthly < 0 ||
        loan.downPayment < 0 ||
        loan.downPayment > loan.homePrice
      );
    });

    if (invalidMortgages.length > 0) {
      setSubmitError(
        'Mortgages require: balance > 0, APR between 0 and 100, and monthly P&I payment > 0 in existing mode. For future purchase: home price > 0, valid term, and valid down payment.'
      );
      return;
    }

    const invalidCreditCards = loans['credit-card'].filter((loan) => {
      if (loan.balance <= 0) return false;
      return loan.apr < 0 || loan.apr > 100;
    });
    if (invalidCreditCards.length > 0) {
      setSubmitError('Credit cards require APR between 0 and 100%.');
      return;
    }

    const invalidStudentLoans = loans['student-loan'].filter((loan) => {
      if (loan.balance <= 0) return false;
      return loan.interestRate < 0 || loan.interestRate > 20;
    });
    if (invalidStudentLoans.length > 0) {
      setSubmitError('Student loans require an interest rate between 0 and 20%.');
      return;
    }

    const invalidPersonalLoans = loans['personal-loan'].filter((loan) => {
      if (loan.balance <= 0) return false;
      return loan.interestRate < 0 || loan.interestRate > 100 || loan.termMonths <= 0;
    });
    if (invalidPersonalLoans.length > 0) {
      setSubmitError('Personal loans require APR between 0 and 100% and a valid term.');
      return;
    }

    setSubmitError(null);
    const allLoans = loans[lockedType!].filter(l => l.balance > 0);
    if (allLoans.length === 0) return;
    if (allLoans.length > 50) {
      setSubmitError('Maximum 50 loans allowed per simulation.');
      return;
    }

    if (allocationMode === 'auto' && allLoans.length > 1 && activeTab !== 'mortgage') {
      onCalculate(allLoans, allocationBudget, allocationStrategy, 'auto');
    } else {
      // Specify mode or single loan or mortgage: use independent calculations
      onCalculate(getAllLoans(), 0, 'avalanche', 'specify');
    }
  };

  const activeLoans = loans[activeTab];
  const activeTypeInfo = LOAN_TYPES.find(t => t.id === activeTab)!;

  // Render fields specific to each loan type
  const renderLoanFields = (loan: LoanEntry) => {
    switch (loan.type) {
      case 'credit-card':
        return renderCreditCardFields(loan as CreditCardEntry);
      case 'personal-loan':
        return renderPersonalLoanFields(loan as PersonalLoanEntry);
      case 'auto-loan':
        return renderAutoLoanFields(loan as AutoLoanEntry);
      case 'mortgage':
        return renderMortgageFields(loan as MortgageEntry);
      case 'student-loan':
        return renderStudentLoanFields(loan as StudentLoanEntry);
    }
  };

  const renderCreditCardFields = (loan: CreditCardEntry) => {
    // Hide individual payment field when multiple loans exist — the allocation section controls it
    const showPaymentField = loans['credit-card'].filter(l => l.balance > 0).length <= 1;
    return (
      <div className="loan-entry__fields">
        <div className="form-group">
          <div className="label-with-tooltip">
            <label>Current Balance</label>
            <InfoTooltip {...FIELD_DEFINITIONS.balance} />
          </div>
          <div className="input-wrapper">
            <span className="input-prefix">$</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={loan.balance || ''}
              onChange={(e) => updateLoan('credit-card', loan.id, 'balance', parseFloat(e.target.value) || 0)}
              placeholder="0.00"
            />
          </div>
        </div>
        <div className="form-group">
          <div className="label-with-tooltip">
            <label>APR</label>
            <InfoTooltip {...FIELD_DEFINITIONS.apr} />
          </div>
          <div className="input-wrapper">
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={loan.apr || ''}
              onChange={(e) => updateLoan('credit-card', loan.id, 'apr', parseFloat(e.target.value) || 0)}
              placeholder="0.00"
            />
            <span className="input-suffix">%</span>
          </div>
        </div>
        {showPaymentField && (
          <div className="form-group">
            <div className="label-with-tooltip">
              <label>Monthly Payment</label>
              <InfoTooltip {...FIELD_DEFINITIONS.monthlyPayment} />
            </div>
            <div className="input-wrapper">
              <span className="input-prefix">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={loan.monthlyPayment || ''}
                onChange={(e) => updateLoan('credit-card', loan.id, 'monthlyPayment', parseFloat(e.target.value) || 0)}
                placeholder="0.00"
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderPersonalLoanFields = (loan: PersonalLoanEntry) => {
    // Hide individual payment field when multiple loans exist — allocation section controls it
    const showPaymentField = loans['personal-loan'].filter(l => l.balance > 0).length <= 1;
    return (
    <>
      <div className="loan-entry__fields">
        <div className="form-group">
          <div className="label-with-tooltip">
            <label>Loan Balance</label>
            <InfoTooltip {...FIELD_DEFINITIONS.balance} />
          </div>
          <div className="input-wrapper">
            <span className="input-prefix">$</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={loan.balance || ''}
              onChange={(e) => updateLoan('personal-loan', loan.id, 'balance', parseFloat(e.target.value) || 0)}
              placeholder="0.00"
            />
          </div>
        </div>
        <div className="form-group">
          <div className="label-with-tooltip">
            <label>APR</label>
            <InfoTooltip {...FIELD_DEFINITIONS.apr} />
          </div>
          <div className="input-wrapper">
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={loan.interestRate || ''}
              onChange={(e) => updateLoan('personal-loan', loan.id, 'interestRate', parseFloat(e.target.value) || 0)}
              placeholder="0.00"
            />
            <span className="input-suffix">%</span>
          </div>
        </div>
        <div className="form-group">
          <div className="label-with-tooltip">
            <label>Term</label>
            <InfoTooltip {...FIELD_DEFINITIONS.termMonths} />
          </div>
          <div className="input-wrapper">
            <select
              value={loan.termMonths}
              onChange={(e) => updateLoan('personal-loan', loan.id, 'termMonths', parseInt(e.target.value, 10) || 36)}
              className="form-select"
            >
              <option value={12}>12 months</option>
              <option value={24}>24 months</option>
              <option value={36}>36 months</option>
              <option value={48}>48 months</option>
              <option value={60}>60 months</option>
              <option value={72}>72 months</option>
              <option value={84}>84 months</option>
            </select>
          </div>
        </div>
      </div>
      <div className="loan-entry__fields loan-entry__fields--secondary">
        {showPaymentField && (
          <div className="form-group">
            <div className="label-with-tooltip">
              <label>Monthly Payment</label>
              <InfoTooltip {...FIELD_DEFINITIONS.monthlyPayment} />
            </div>
            <div className="input-wrapper">
              <span className="input-prefix">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={loan.monthlyPayment || ''}
                onChange={(e) => updateLoan('personal-loan', loan.id, 'monthlyPayment', parseFloat(e.target.value) || 0)}
                placeholder="Auto-calculated"
              />
            </div>
          </div>
        )}
        <div className="form-group">
          <div className="label-with-tooltip">
            <label>Origination Fee</label>
            <InfoTooltip {...FIELD_DEFINITIONS.originationFee} />
          </div>
          <div className="input-wrapper">
            <input
              type="number"
              step="0.1"
              min="0"
              max="10"
              value={loan.originationFeePercent || ''}
              onChange={(e) => updateLoan('personal-loan', loan.id, 'originationFeePercent', parseFloat(e.target.value) || 0)}
              placeholder="0"
            />
            <span className="input-suffix">%</span>
          </div>
        </div>
        {(loan.originationFeePercent || 0) > 0 && loan.balance > 0 && loan.termMonths > 0 && (() => {
          const effectiveAPR = computeEffectiveAPR(loan.balance, loan.originationFeePercent || 0, loan.termMonths, loan.interestRate || 0);
          return effectiveAPR !== null ? (
            <div className="form-group">
              <label>Effective APR</label>
              <div className="input-wrapper input-wrapper--readonly">
                <input
                  type="text"
                  value={`${effectiveAPR.toFixed(2)}%`}
                  readOnly
                  className="input--readonly input--info"
                />
              </div>
              <span className="form-hint">True cost including origination fee</span>
            </div>
          ) : null;
        })()}
      </div>
      <div className="loan-entry__fields loan-entry__fields--tertiary">
        <div className="form-group form-group--checkbox">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={loan.hasPrepaymentPenalty || false}
              onChange={(e) => updateLoan('personal-loan', loan.id, 'hasPrepaymentPenalty', e.target.checked)}
            />
            <span>Prepayment penalty</span>
            <InfoTooltip {...FIELD_DEFINITIONS.prepaymentPenalty} />
          </label>
        </div>
        {loan.hasPrepaymentPenalty && (
          <div className="form-group">
            <label>Penalty Rate</label>
            <div className="input-wrapper">
              <input
                type="number"
                step="0.5"
                min="0"
                max="10"
                value={loan.prepaymentPenaltyPercent ?? 2}
                onChange={(e) => updateLoan('personal-loan', loan.id, 'prepaymentPenaltyPercent', parseFloat(e.target.value) || 0)}
                placeholder="2"
              />
              <span className="input-suffix">% of balance</span>
            </div>
          </div>
        )}
      </div>
    </>
    );
  };

  const renderInputModeToggle = (
    type: 'auto-loan' | 'mortgage',
    loan: AutoLoanEntry | MortgageEntry
  ) => {
    const inputMode: LoanInputMode = loan.inputMode ?? 'future';

    const futureIcon = type === 'auto-loan' ? (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="12" x2="15" y2="14"/>
        <path d="M5 3L3 5M19 3l2 2M5 21l-2-2M19 21l2-2" strokeWidth="1.5"/>
      </svg>
    ) : (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    );

    const existingIcon = (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
      </svg>
    );

    const futureDesc  = type === 'auto-loan' ? 'Calculate from purchase price'   : 'Calculate from purchase price';
    const existingDesc = type === 'auto-loan' ? 'Enter current balance & payment' : 'Enter current balance & payment';

    return (
      <div className="loan-mode-selector">
        <button
          type="button"
          className={`loan-mode-card ${inputMode === 'future' ? 'loan-mode-card--active' : ''}`}
          onClick={() => updateLoan(type, loan.id, 'inputMode', 'future')}
        >
          <span className="loan-mode-card__icon">{futureIcon}</span>
          <span className="loan-mode-card__body">
            <span className="loan-mode-card__label">Future Purchase</span>
            <span className="loan-mode-card__desc">{futureDesc}</span>
          </span>
          <span className="loan-mode-card__check">
            <svg viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="8" opacity="0.15"/><circle cx="8" cy="8" r="4"/></svg>
          </span>
        </button>
        <button
          type="button"
          className={`loan-mode-card ${inputMode === 'existing' ? 'loan-mode-card--active' : ''}`}
          onClick={() => updateLoan(type, loan.id, 'inputMode', 'existing')}
        >
          <span className="loan-mode-card__icon">{existingIcon}</span>
          <span className="loan-mode-card__body">
            <span className="loan-mode-card__label">Existing Loan</span>
            <span className="loan-mode-card__desc">{existingDesc}</span>
          </span>
          <span className="loan-mode-card__check">
            <svg viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="8" opacity="0.15"/><circle cx="8" cy="8" r="4"/></svg>
          </span>
        </button>
      </div>
    );
  };

  const renderAutoLoanFields = (loan: AutoLoanEntry) => {
    const inputMode: LoanInputMode = loan.inputMode ?? 'future';

    if (inputMode === 'existing') {
      return (
        <>
          {renderInputModeToggle('auto-loan', loan)}
          <div className="loan-entry__fields">
            <div className="form-group">
              <div className="label-with-tooltip">
                <label>Current Balance</label>
                <InfoTooltip {...FIELD_DEFINITIONS.balance} />
              </div>
              <div className="input-wrapper">
                <span className="input-prefix">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={loan.balance || ''}
                  onChange={(e) => updateLoan('auto-loan', loan.id, 'balance', parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="form-group">
              <div className="label-with-tooltip">
                <label>APR</label>
                <InfoTooltip {...FIELD_DEFINITIONS.apr} />
              </div>
              <div className="input-wrapper">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="30"
                  value={loan.interestRate || ''}
                  onChange={(e) => updateLoan('auto-loan', loan.id, 'interestRate', parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
                <span className="input-suffix">%</span>
              </div>
            </div>
            <div className="form-group">
              <div className="label-with-tooltip">
                <label>Monthly Payment</label>
                <InfoTooltip {...FIELD_DEFINITIONS.monthlyPayment} />
              </div>
              <div className="input-wrapper">
                <span className="input-prefix">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={loan.monthlyPayment || ''}
                  onChange={(e) => updateLoan('auto-loan', loan.id, 'monthlyPayment', parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>
        </>
      );
    }

    // Helper: recompute loan amount from all future-mode inputs
    const computeAutoBalance = (
      price: number, tax: number, fees: number,
      down: number, tradeIn: number, tradeInPayoff: number
    ) => Math.max(0, price + price * (tax / 100) + fees - down - tradeIn + tradeInPayoff);

    return (
      <>
        {renderInputModeToggle('auto-loan', loan)}
        <div className="loan-entry__fields">
          <div className="form-group">
            <div className="label-with-tooltip">
              <label>Vehicle Price</label>
              <InfoTooltip {...FIELD_DEFINITIONS.vehiclePrice} />
            </div>
            <div className="input-wrapper">
              <span className="input-prefix">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={loan.vehiclePrice || ''}
                onChange={(e) => {
                  const price = parseFloat(e.target.value) || 0;
                  updateLoan('auto-loan', loan.id, 'vehiclePrice', price);
                  updateLoan('auto-loan', loan.id, 'balance', computeAutoBalance(price, loan.salesTaxPercent || 0, loan.docAndRegFees || 0, loan.downPayment || 0, loan.tradeInValue || 0, loan.tradeInPayoff || 0));
                }}
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="form-group">
            <div className="label-with-tooltip">
              <label>Down Payment</label>
              <InfoTooltip {...FIELD_DEFINITIONS.downPayment} />
            </div>
            <div className="input-wrapper">
              <span className="input-prefix">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={loan.downPayment || ''}
                onChange={(e) => {
                  const down = parseFloat(e.target.value) || 0;
                  updateLoan('auto-loan', loan.id, 'downPayment', down);
                  updateLoan('auto-loan', loan.id, 'balance', computeAutoBalance(loan.vehiclePrice || 0, loan.salesTaxPercent || 0, loan.docAndRegFees || 0, down, loan.tradeInValue || 0, loan.tradeInPayoff || 0));
                }}
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="form-group">
            <div className="label-with-tooltip">
              <label>APR</label>
              <InfoTooltip {...FIELD_DEFINITIONS.apr} />
            </div>
            <div className="input-wrapper">
              <input
                type="number"
                step="0.01"
                min="0"
                max="30"
                value={loan.interestRate || ''}
                onChange={(e) => updateLoan('auto-loan', loan.id, 'interestRate', parseFloat(e.target.value) || 0)}
                placeholder="0.00"
              />
              <span className="input-suffix">%</span>
            </div>
          </div>
        </div>
        <div className="loan-entry__fields loan-entry__fields--secondary">
          <div className="form-group">
            <div className="label-with-tooltip">
              <label>Term</label>
              <InfoTooltip {...FIELD_DEFINITIONS.termMonths} />
            </div>
            <div className="input-wrapper">
              <select
                value={loan.termMonths}
                onChange={(e) => updateLoan('auto-loan', loan.id, 'termMonths', parseInt(e.target.value, 10))}
                className="form-select"
              >
                <option value={36}>36 months</option>
                <option value={48}>48 months</option>
                <option value={60}>60 months</option>
                <option value={72}>72 months</option>
                <option value={84}>84 months</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <div className="label-with-tooltip">
              <label>Sales Tax</label>
              <InfoTooltip {...FIELD_DEFINITIONS.salesTax} />
            </div>
            <div className="input-wrapper">
              <input
                type="number"
                step="0.1"
                min="0"
                max="20"
                value={loan.salesTaxPercent || ''}
                onChange={(e) => {
                  const tax = parseFloat(e.target.value) || 0;
                  updateLoan('auto-loan', loan.id, 'salesTaxPercent', tax);
                  updateLoan('auto-loan', loan.id, 'balance', computeAutoBalance(loan.vehiclePrice || 0, tax, loan.docAndRegFees || 0, loan.downPayment || 0, loan.tradeInValue || 0, loan.tradeInPayoff || 0));
                }}
                placeholder="0.0"
              />
              <span className="input-suffix">%</span>
            </div>
          </div>
          <div className="form-group">
            <div className="label-with-tooltip">
              <label>Doc &amp; Reg Fees</label>
              <InfoTooltip {...FIELD_DEFINITIONS.docAndRegFees} />
            </div>
            <div className="input-wrapper">
              <span className="input-prefix">$</span>
              <input
                type="number"
                step="10"
                min="0"
                value={loan.docAndRegFees || ''}
                onChange={(e) => {
                  const fees = parseFloat(e.target.value) || 0;
                  updateLoan('auto-loan', loan.id, 'docAndRegFees', fees);
                  updateLoan('auto-loan', loan.id, 'balance', computeAutoBalance(loan.vehiclePrice || 0, loan.salesTaxPercent || 0, fees, loan.downPayment || 0, loan.tradeInValue || 0, loan.tradeInPayoff || 0));
                }}
                placeholder="0"
              />
            </div>
          </div>
        </div>
        <div className="loan-entry__fields loan-entry__fields--secondary">
          <div className="form-group">
            <div className="label-with-tooltip">
              <label>Trade-in Value</label>
              <InfoTooltip {...FIELD_DEFINITIONS.tradeInValue} />
            </div>
            <div className="input-wrapper">
              <span className="input-prefix">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={loan.tradeInValue || ''}
                onChange={(e) => {
                  const tradeIn = parseFloat(e.target.value) || 0;
                  updateLoan('auto-loan', loan.id, 'tradeInValue', tradeIn);
                  updateLoan('auto-loan', loan.id, 'balance', computeAutoBalance(loan.vehiclePrice || 0, loan.salesTaxPercent || 0, loan.docAndRegFees || 0, loan.downPayment || 0, tradeIn, loan.tradeInPayoff || 0));
                }}
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="form-group">
            <div className="label-with-tooltip">
              <label>Trade-in Payoff</label>
              <InfoTooltip {...FIELD_DEFINITIONS.tradeInPayoff} />
            </div>
            <div className="input-wrapper">
              <span className="input-prefix">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={loan.tradeInPayoff || ''}
                onChange={(e) => {
                  const payoff = parseFloat(e.target.value) || 0;
                  updateLoan('auto-loan', loan.id, 'tradeInPayoff', payoff);
                  updateLoan('auto-loan', loan.id, 'balance', computeAutoBalance(loan.vehiclePrice || 0, loan.salesTaxPercent || 0, loan.docAndRegFees || 0, loan.downPayment || 0, loan.tradeInValue || 0, payoff));
                }}
                placeholder="0.00"
              />
            </div>
          </div>
          {(() => {
            const minPmt = loan.balance > 0 && loan.interestRate > 0
              ? paymentForTerm(loan.balance, loan.interestRate, loan.termMonths || 60, 'auto-loan')
              : 0;
            return (
              <div className="form-group">
                <div className="label-with-tooltip">
                  <label>Monthly Payment</label>
                  <InfoTooltip {...FIELD_DEFINITIONS.monthlyPayment} />
                </div>
                <div className="input-wrapper">
                  <span className="input-prefix">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={loan.monthlyPayment || ''}
                    onChange={(e) => updateLoan('auto-loan', loan.id, 'monthlyPayment', parseFloat(e.target.value) || 0)}
                    placeholder={minPmt > 0 ? `Min: $${minPmt.toFixed(0)}` : 'Auto-calculated'}
                  />
                </div>
              </div>
            );
          })()}
        </div>
      </>
    );
  };

  const renderMortgageFields = (loan: MortgageEntry) => {
    const inputMode: LoanInputMode = loan.inputMode ?? 'future';
    const futureDownPaymentPercent = loan.homePrice > 0 ? (loan.downPayment / loan.homePrice) * 100 : 0;

    if (inputMode === 'existing') {
      return (
        <>
          {renderInputModeToggle('mortgage', loan)}
          <div className="loan-entry__fields">
            <div className="form-group">
              <div className="label-with-tooltip">
                <label>Current Balance</label>
                <InfoTooltip {...FIELD_DEFINITIONS.balance} />
              </div>
              <div className="input-wrapper">
                <span className="input-prefix">$</span>
                <input
                  type="number"
                  step="1000"
                  min="0"
                  value={loan.balance || ''}
                  onChange={(e) => updateLoan('mortgage', loan.id, 'balance', parseFloat(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="form-group">
              <div className="label-with-tooltip">
                <label>Interest Rate</label>
                <InfoTooltip {...FIELD_DEFINITIONS.interestRate} />
              </div>
              <div className="input-wrapper">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="20"
                  value={loan.interestRate || ''}
                  onChange={(e) => updateLoan('mortgage', loan.id, 'interestRate', parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
                <span className="input-suffix">%</span>
              </div>
            </div>
            <div className="form-group">
              <div className="label-with-tooltip">
                <label>Monthly Payment</label>
                <InfoTooltip {...FIELD_DEFINITIONS.monthlyPayment} />
              </div>
              <div className="input-wrapper">
                <span className="input-prefix">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={loan.monthlyPayment || ''}
                  onChange={(e) => updateLoan('mortgage', loan.id, 'monthlyPayment', parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>
        </>
      );
    }

    return (
      <>
        {renderInputModeToggle('mortgage', loan)}
        <div className="loan-entry__fields">
          <div className="form-group">
            <div className="label-with-tooltip">
              <label>Home Price</label>
              <InfoTooltip {...FIELD_DEFINITIONS.homePrice} />
            </div>
            <div className="input-wrapper">
              <span className="input-prefix">$</span>
              <input
                type="number"
                step="1000"
                min="0"
                value={loan.homePrice || ''}
                onChange={(e) => {
                  const price = parseFloat(e.target.value) || 0;
                  updateLoan('mortgage', loan.id, 'homePrice', price);
                  const balance = price - (loan.downPayment || 0);
                  updateLoan('mortgage', loan.id, 'balance', Math.max(0, balance));
                }}
                placeholder="0"
              />
            </div>
          </div>
          <div className="form-group">
            <div className="label-with-tooltip">
              <label>Down Payment</label>
              <InfoTooltip {...FIELD_DEFINITIONS.downPayment} />
            </div>
            <div className="input-wrapper">
              <span className="input-prefix">$</span>
              <input
                type="number"
                step="1000"
                min="0"
                value={loan.downPayment || ''}
                onChange={(e) => {
                  const down = parseFloat(e.target.value) || 0;
                  updateLoan('mortgage', loan.id, 'downPayment', down);
                  const balance = (loan.homePrice || 0) - down;
                  updateLoan('mortgage', loan.id, 'balance', Math.max(0, balance));
                  if (loan.homePrice > 0) {
                    updateLoan('mortgage', loan.id, 'downPaymentPercent', (down / loan.homePrice) * 100);
                  }
                }}
                placeholder="0"
              />
            </div>
          </div>
          <div className="form-group">
            <div className="label-with-tooltip">
              <label>Interest Rate</label>
              <InfoTooltip {...FIELD_DEFINITIONS.interestRate} />
            </div>
            <div className="input-wrapper">
              <input
                type="number"
                step="0.01"
                min="0"
                max="20"
                value={loan.interestRate || ''}
                onChange={(e) => updateLoan('mortgage', loan.id, 'interestRate', parseFloat(e.target.value) || 0)}
                placeholder="0.00"
              />
              <span className="input-suffix">%</span>
            </div>
          </div>
        </div>
        <div className="loan-entry__fields loan-entry__fields--secondary">
          <div className="form-group">
            <div className="label-with-tooltip">
              <label>Term</label>
              <InfoTooltip {...FIELD_DEFINITIONS.mortgageTerm} />
            </div>
            <div className="input-wrapper">
              <select
                value={loan.termYears}
                onChange={(e) => updateLoan('mortgage', loan.id, 'termYears', parseInt(e.target.value, 10))}
                className="form-select"
              >
                <option value={15}>15 years</option>
                <option value={20}>20 years</option>
                <option value={30}>30 years</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <div className="label-with-tooltip">
              <label>Down Payment %</label>
              <InfoTooltip {...FIELD_DEFINITIONS.downPaymentPercent} />
            </div>
            <div className="input-wrapper input-wrapper--readonly">
              <input
                type="text"
                value={`${futureDownPaymentPercent.toFixed(1)}%`}
                readOnly
                className="input--readonly"
              />
            </div>
          </div>
          {(() => {
            const termMonths = (loan.termYears || 30) * 12;
            const minPmt = loan.balance > 0 && loan.interestRate > 0
              ? paymentForTerm(loan.balance, loan.interestRate, termMonths, 'mortgage')
              : 0;
            return (
              <div className="form-group">
                <div className="label-with-tooltip">
                  <label>Monthly Payment</label>
                  <InfoTooltip {...FIELD_DEFINITIONS.monthlyPayment} />
                </div>
                <div className="input-wrapper">
                  <span className="input-prefix">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={loan.monthlyPayment || ''}
                    onChange={(e) => updateLoan('mortgage', loan.id, 'monthlyPayment', parseFloat(e.target.value) || 0)}
                    placeholder={minPmt > 0 ? `Min: ${minPmt.toFixed(0)}` : 'Auto-calculated'}
                  />
                </div>
              </div>
            );
          })()}
        </div>
      </>
    );
  };

  const renderStudentLoanFields = (loan: StudentLoanEntry) => {
    return (
      <div className="loan-entry__fields">
        <div className="form-group">
          <div className="label-with-tooltip">
            <label>Balance</label>
            <InfoTooltip {...FIELD_DEFINITIONS.balance} />
          </div>
          <div className="input-wrapper">
            <span className="input-prefix">$</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={loan.balance || ''}
              onChange={(e) => updateLoan('student-loan', loan.id, 'balance', parseFloat(e.target.value) || 0)}
              placeholder="0.00"
            />
          </div>
        </div>
        <div className="form-group">
          <div className="label-with-tooltip">
            <label>Interest Rate</label>
            <InfoTooltip {...FIELD_DEFINITIONS.interestRate} />
          </div>
          <div className="input-wrapper">
            <input
              type="number"
              step="0.01"
              min="0"
              max="20"
              value={loan.interestRate || ''}
              onChange={(e) => updateLoan('student-loan', loan.id, 'interestRate', parseFloat(e.target.value) || 0)}
              placeholder="0.00"
            />
            <span className="input-suffix">%</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="loan-input">
      <div className="loan-input__header">
        <h2>Add Your Debts</h2>
        <p>Select a loan type and add your accounts. Each loan type has specialized fields.</p>
      </div>

      {/* Loan Type Tabs */}
      {lockedType && (
        <p className="loan-type-lock-notice">
          Remove all {LOAN_TYPES.find(t => t.id === lockedType)?.label}s to switch to a different loan type.
        </p>
      )}
      <div className="loan-tabs">
        {LOAN_TYPES.map(type => {
          const count = loans[type.id].length;
          const isLocked = lockedType !== null && type.id !== lockedType;
          return (
            <button
              key={type.id}
              className={`loan-tab ${activeTab === type.id ? 'loan-tab--active' : ''} ${isLocked ? 'loan-tab--locked' : ''}`}
              onClick={() => { if (!isLocked) setActiveTab(type.id); }}
              type="button"
              disabled={isLocked}
              title={isLocked ? `Remove all ${LOAN_TYPES.find(t => t.id === lockedType)?.label?.toLowerCase()}s to switch types` : undefined}
            >
              <span className="loan-tab__icon">{type.icon}</span>
              <span className="loan-tab__label">{type.label}</span>
              {count > 0 && <span className="loan-tab__count">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Active Tab Content */}
      <div className="loan-input__content">
        <div className="loan-input__type-header">
          <div>
            <h3>{activeTypeInfo.icon} {activeTypeInfo.label}</h3>
            <p>{activeTypeInfo.description}</p>
          </div>
          <button
            type="button"
            className="btn btn--secondary btn--add"
            onClick={() => addLoan(activeTab)}
          >
            + Add {activeTypeInfo.label}
          </button>
        </div>

        {activeLoans.length === 0 ? (
          <div className="loan-input__empty">
            <p>No {activeTypeInfo.label.toLowerCase()}s added yet.</p>
            <div className="loan-input__empty-actions">
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => addLoan(activeTab)}
              >
                + Add Your First {activeTypeInfo.label}
              </button>
              {(activeTab as string) in SAMPLE_DATA && (
                <>
                  <span className="empty-divider">or</span>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sample"
                    onClick={() => loadSampleData(activeTab)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                      <path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.64 5.64l2.12 2.12m8.48 8.48l2.12 2.12M5.64 18.36l2.12-2.12m8.48-8.48l2.12-2.12" />
                    </svg>
                    Load Sample Data
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="loan-entries">
            {activeLoans.map((loan, index) => (
              <div key={loan.id} className="loan-entry">
                <div className="loan-entry__header">
                  {editingLoanId === loan.id ? (
                    <input
                      type="text"
                      className="loan-entry__name-input"
                      value={loan.name}
                      onChange={(e) => updateLoan(activeTab, loan.id, 'name', e.target.value)}
                      onBlur={() => setEditingLoanId(null)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') setEditingLoanId(null);
                        if (e.key === 'Escape') setEditingLoanId(null);
                      }}
                      autoFocus
                      placeholder={`Loan ${index + 1}`}
                    />
                  ) : (
                    <span
                      className="loan-entry__number loan-entry__number--editable"
                      onClick={() => setEditingLoanId(loan.id)}
                      title="Click to rename"
                    >
                      {loan.name || `Loan ${index + 1}`}
                      <svg className="loan-entry__edit-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </span>
                  )}
                  <button
                    type="button"
                    className="loan-entry__remove"
                    onClick={() => removeLoan(activeTab, loan.id)}
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
                {renderLoanFields(loan)}
              </div>
            ))}
          </div>
        )}

        {/* Payment Options — shown for all loan types except mortgage */}
        {activeTab !== 'mortgage' && activeLoans.length > 0 && (() => {
          const validLoans = activeLoans.filter(l => l.balance > 0 && getEffectiveRate(l) > 0);
          const totalMinPayment = validLoans.reduce((sum, l) => sum + computeLoanMinimum(l), 0);
          const hasValidLoans = validLoans.length > 0;

          if (!hasValidLoans) return null;

          // Min label and tooltip adapt to loan type
          const minTooltipTitle =
            activeTab === 'credit-card' ? '2% Minimum' :
            activeTab === 'student-loan' ? 'Standard Repayment Plan' :
            'Loan Term Payment';
          const minTooltipBody =
            activeTab === 'credit-card'
              ? 'Credit card minimum is 2% of the current balance (floor $25). This decreases as you pay off the balance.'
              : activeTab === 'student-loan'
              ? 'Minimum is based on the federal 10-year fixed payment plan — the default repayment schedule for federal student loans.'
              : 'Minimum is the standard amortization payment calculated from your loan balance, rate, and term.';

          return (
            <div className="student-loan-payment-section">
              <div className="payment-section-header">
                <h4>Payment Method</h4>
              </div>

              <div className="payment-mode-toggle">
                <div className="payment-mode-option">
                  <button
                    type="button"
                    className={`payment-mode-btn ${allocationMode === 'auto' ? 'payment-mode-btn--active' : ''}`}
                    onClick={() => setAllocationMode('auto')}
                  >
                    Auto-allocate
                  </button>
                  <div className="payment-mode-tooltip">
                    Enter your total monthly budget and we'll automatically split it across your loans using your chosen strategy.
                  </div>
                </div>
                <div className="payment-mode-option">
                  <button
                    type="button"
                    className={`payment-mode-btn ${allocationMode === 'specify' ? 'payment-mode-btn--active' : ''}`}
                    onClick={() => setAllocationMode('specify')}
                  >
                    Manual
                  </button>
                  <div className="payment-mode-tooltip">
                    Set your own payment amount for each loan individually.
                  </div>
                </div>
              </div>

              {allocationMode === 'auto' && (
                <div className="split-budget-form">
                  <div className="budget-input-row">
                    <div className="budget-field">
                      <label>Monthly Budget</label>
                      <div className="input-wrapper">
                        <span className="input-prefix">$</span>
                        <input
                          type="number"
                          step="10"
                          min="0"
                          value={allocationBudget || ''}
                          onChange={(e) => {
                            setAllocationBudget(parseFloat(e.target.value) || 0);
                            setShowAllocation(false);
                          }}
                          placeholder={Math.round(totalMinPayment).toString()}
                        />
                      </div>
                      <div className="budget-minimum-wrap">
                        <span className="budget-minimum">
                          Min. ${Math.round(totalMinPayment).toLocaleString()}/mo
                        </span>
                        <div className="budget-minimum-tooltip">
                          <span className="budget-minimum-info">ⓘ</span>
                          <div className="budget-minimum-tooltip-content">
                            <strong>{minTooltipTitle}</strong>
                            <p>{minTooltipBody}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {validLoans.length > 1 && (
                      <div className="strategy-field">
                        <label>Strategy</label>
                        <div className="strategy-select-buttons">
                          <div className="strategy-btn-wrap">
                            <button
                              type="button"
                              className={`strategy-select-btn ${allocationStrategy === 'avalanche' ? 'strategy-select-btn--active' : ''}`}
                              onClick={() => setAllocationStrategy('avalanche')}
                            >
                              <span className="strategy-icon">⛰️</span>
                              <span className="strategy-name">Avalanche</span>
                              <span className="strategy-desc">Highest rate first</span>
                            </button>
                            <div className="strategy-hover-tooltip">
                              <strong>Avalanche Method</strong>
                              <p>Pay minimums on all loans, put extra toward the highest interest rate first. Saves you the most money over time.</p>
                            </div>
                          </div>
                          <div className="strategy-btn-wrap">
                            <button
                              type="button"
                              className={`strategy-select-btn ${allocationStrategy === 'snowball' ? 'strategy-select-btn--active' : ''}`}
                              onClick={() => setAllocationStrategy('snowball')}
                            >
                              <span className="strategy-icon">❄️</span>
                              <span className="strategy-name">Snowball</span>
                              <span className="strategy-desc">Smallest balance first</span>
                            </button>
                            <div className="strategy-hover-tooltip">
                              <strong>Snowball Method</strong>
                              <p>Pay minimums on all loans, put extra toward the smallest balance first. Quick wins keep you motivated.</p>
                            </div>
                          </div>
                          <div className="strategy-btn-wrap">
                            <button
                              type="button"
                              className={`strategy-select-btn ${allocationStrategy === 'standard' ? 'strategy-select-btn--active' : ''}`}
                              onClick={() => setAllocationStrategy('standard')}
                            >
                              <span className="strategy-icon">📊</span>
                              <span className="strategy-name">Equal</span>
                              <span className="strategy-desc">Split evenly</span>
                            </button>
                            <div className="strategy-hover-tooltip">
                              <strong>Equal Split</strong>
                              <p>Divide your budget equally across all loans. Simple and easy to track.</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Allocation Preview */}
                  {showAllocation && allocationBudget > 0 && (
                    <div className="allocation-preview">
                      <div className="allocation-header">
                        <h5>Payment Allocation</h5>
                        <span className="allocation-strategy">
                          {allocationStrategy === 'avalanche' && '⛰️ Avalanche'}
                          {allocationStrategy === 'snowball' && '❄️ Snowball'}
                          {allocationStrategy === 'standard' && '📊 Equal Split'}
                        </span>
                      </div>
                      <div className="allocation-list">
                        {autoAllocatedLoans
                          .filter(loan => loan.balance > 0)
                          .map((loan, index) => {
                            const percentage = (loan.monthlyPayment / allocationBudget) * 100;
                            const originalIndex = loans[activeTab].findIndex(l => l.id === loan.id);
                            const displayName = loan.name || `Loan ${originalIndex >= 0 ? originalIndex + 1 : index + 1}`;
                            return (
                              <div key={loan.id} className="allocation-item">
                                <div className="allocation-item__info">
                                  <span className="allocation-item__name">{displayName}</span>
                                  <span className="allocation-item__details">
                                    ${loan.balance.toLocaleString()} @ {getEffectiveRate(loan)}%
                                  </span>
                                </div>
                                <div className="allocation-item__bar-container">
                                  <div
                                    className="allocation-item__bar"
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                                <div className="allocation-item__amount">
                                  <strong>${loan.monthlyPayment.toFixed(0)}</strong>
                                  <span>/mo</span>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                      <div className="allocation-total">
                        <span>Total Monthly Payment</span>
                        <strong>${allocationBudget.toLocaleString()}</strong>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {allocationMode === 'specify' && (
                <div className="manual-allocation">
                  <div className="allocation-header">
                    <h5>Set Your Payments</h5>
                    <span className="allocation-strategy">🎚️ Manual</span>
                  </div>
                  <div className="allocation-list">
                    {validLoans.map((loan, index) => {
                      const minPayment = computeLoanMinimum(loan);
                      const maxPayment = loan.balance;
                      const currentPayment = loan.monthlyPayment || minPayment;
                      const range = maxPayment - minPayment;
                      const percentage = range > 0 ? ((currentPayment - minPayment) / range) * 100 : 0;
                      const originalIndex = loans[activeTab].findIndex(l => l.id === loan.id);
                      const displayName = loan.name || `Loan ${originalIndex >= 0 ? originalIndex + 1 : index + 1}`;

                      return (
                        <div key={loan.id} className="allocation-item allocation-item--slider">
                          <div className="allocation-item__info">
                            <span className="allocation-item__name">{displayName}</span>
                            <span className="allocation-item__details">
                              ${loan.balance.toLocaleString()} @ {getEffectiveRate(loan)}%
                            </span>
                            <span className="allocation-item__min">
                              Min: ${Math.round(minPayment)}/mo
                            </span>
                          </div>
                          <div className="allocation-item__slider-wrap">
                            <input
                              type="range"
                              min={Math.round(minPayment)}
                              max={Math.round(maxPayment)}
                              step="10"
                              value={currentPayment}
                              onChange={(e) => updateLoan(activeTab, loan.id, 'monthlyPayment', parseFloat(e.target.value))}
                              className="allocation-slider"
                            />
                            <div
                              className="allocation-item__bar allocation-item__bar--slider"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <div className="allocation-item__amount allocation-item__amount--editable">
                            <span className="amount-prefix">$</span>
                            <input
                              type="number"
                              min={Math.round(minPayment)}
                              max={Math.round(maxPayment)}
                              step="10"
                              value={Math.round(currentPayment)}
                              onChange={(e) => updateLoan(activeTab, loan.id, 'monthlyPayment', parseFloat(e.target.value) || minPayment)}
                              className="amount-input"
                            />
                            <span>/mo</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="allocation-total">
                    <span>Total Monthly Payment</span>
                    <strong>
                      ${validLoans.reduce((sum, l) => sum + (l.monthlyPayment || computeLoanMinimum(l)), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </strong>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Action Buttons */}
      <div className="loan-input__footer">
        <div className="loan-input__summary">
          {getTotalLoans() > 0 && (
            <span>{getTotalLoans()} loan{getTotalLoans() !== 1 ? 's' : ''} added</span>
          )}
          {submitError && (
            <span className="error-message" style={{ display: 'block', marginTop: 8 }}>
              {submitError}
            </span>
          )}
        </div>
        {(() => {
          const validCount = lockedType ? loans[lockedType].filter(l => l.balance > 0).length : 0;
          const needsAllocation = allocationMode === 'auto' && validCount > 1 && !showAllocation && activeTab !== 'mortgage';
          const hasValidLoans = getAllLoans().length > 0;

          return (
            <button
              type="button"
              className={`btn btn--primary btn--simulate ${needsAllocation ? 'btn--allocate-step' : ''}`}
              disabled={isLoading || !hasValidLoans}
              onClick={(e) => {
                if (needsAllocation) {
                  e.preventDefault();
                  setShowAllocation(true);
                } else {
                  handleSubmit(e);
                }
              }}
            >
              {isLoading ? (
                <>
                  <span className="spinner" />
                  Simulating...
                </>
              ) : needsAllocation ? (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                  See Allocation
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                    <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
                  </svg>
                  Simulate Future
                </>
              )}
            </button>
          );
        })()}
      </div>
    </div>
  );
};
