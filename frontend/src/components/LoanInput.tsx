import React, { useState, useMemo } from 'react';
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
} from '../types/loan';
import { PayoffStrategyType, STRATEGY_INFO } from '../types/payoffStrategy';
import { InfoTooltip, FIELD_DEFINITIONS } from './InfoTooltip';

type StudentLoanMode = 'auto' | 'specify';

interface LoanInputProps {
  onCalculate: (loans: LoanEntry[]) => void;
  isLoading: boolean;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

// Sample data for each loan type - realistic scenarios
const SAMPLE_DATA = {
  'student-loan': (): StudentLoanEntry[] => [
    {
      id: generateId(),
      name: 'Loan 1',
      type: 'student-loan',
      balance: 5500,
      interestRate: 4.99,
      monthlyPayment: 0,
    },
    {
      id: generateId(),
      name: 'Loan 2',
      type: 'student-loan',
      balance: 3200,
      interestRate: 5.50,
      monthlyPayment: 0,
    },
    {
      id: generateId(),
      name: 'Loan 3',
      type: 'student-loan',
      balance: 4800,
      interestRate: 6.80,
      monthlyPayment: 0,
    },
    {
      id: generateId(),
      name: 'Loan 4',
      type: 'student-loan',
      balance: 2500,
      interestRate: 7.50,
      monthlyPayment: 0,
    },
    {
      id: generateId(),
      name: 'Loan 5',
      type: 'student-loan',
      balance: 4000,
      interestRate: 9.00,
      monthlyPayment: 0,
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
      } as PersonalLoanEntry;
    case 'auto-loan':
      return {
        ...base,
        type: 'auto-loan',
        termMonths: 60,
        vehiclePrice: 0,
        downPayment: 0,
        tradeInValue: 0,
        tradeInPayoff: 0,
        vehicleYear: new Date().getFullYear(),
        isUsed: false,
      } as AutoLoanEntry;
    case 'mortgage':
      return {
        ...base,
        type: 'mortgage',
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
  const [activeTab, setActiveTab] = useState<LoanType>('student-loan');
  const [loans, setLoans] = useState<AllLoans>({
    'credit-card': [],
    'personal-loan': [],
    'auto-loan': [],
    'mortgage': [],
    'student-loan': [],
  });

  // Student loan specific state
  const [studentLoanMode, setStudentLoanMode] = useState<StudentLoanMode>('auto');
  const [studentLoanBudget, setStudentLoanBudget] = useState<number>(500);
  const [studentLoanStrategy, setStudentLoanStrategy] = useState<PayoffStrategyType>('avalanche');
  const [showAllocation, setShowAllocation] = useState<boolean>(false);

  // Inline editing state for loan names
  const [editingLoanId, setEditingLoanId] = useState<string | null>(null);

  const addLoan = (type: LoanType) => {
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
    setLoans(prev => ({
      ...prev,
      [type]: prev[type].filter(loan => loan.id !== id),
    }));
  };

  const loadSampleData = (type: LoanType) => {
    if (type === 'student-loan' && SAMPLE_DATA['student-loan']) {
      const sampleLoans = SAMPLE_DATA['student-loan']();
      setLoans(prev => ({
        ...prev,
        'student-loan': sampleLoans,
      }));

      // Calculate total minimum payment using Standard Repayment Plan
      const totalMin = sampleLoans.reduce((sum, loan) => {
        const monthlyRate = loan.interestRate / 100 / 12;
        const numPayments = 120;
        let minPayment: number;
        if (monthlyRate === 0) {
          minPayment = loan.balance / numPayments;
        } else {
          minPayment = loan.balance * (monthlyRate * Math.pow(1 + monthlyRate, numPayments))
                     / (Math.pow(1 + monthlyRate, numPayments) - 1);
        }
        return sum + minPayment;
      }, 0);

      setStudentLoanBudget(Math.round(totalMin));
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

  // Calculate auto-allocated payments for student loans based on strategy
  const getAutoAllocatedStudentLoans = (): StudentLoanEntry[] => {
    const studentLoans = loans['student-loan'].filter(loan => loan.balance > 0);
    if (studentLoans.length === 0 || studentLoanBudget <= 0) return studentLoans;

    // Sort loans based on strategy
    const sortedLoans = [...studentLoans];
    if (studentLoanStrategy === 'avalanche') {
      // Highest interest rate first
      sortedLoans.sort((a, b) => b.interestRate - a.interestRate);
    } else if (studentLoanStrategy === 'snowball') {
      // Smallest balance first
      sortedLoans.sort((a, b) => a.balance - b.balance);
    }
    // 'standard' keeps original order

    // Calculate minimum payments using Standard Repayment Plan (10-year fixed)
    const loansWithMinimums = sortedLoans.map(loan => {
      const monthlyRate = loan.interestRate / 100 / 12;
      const numPayments = 120; // 10 years

      let minPayment: number;
      if (monthlyRate === 0) {
        minPayment = loan.balance / numPayments;
      } else {
        minPayment = loan.balance * (monthlyRate * Math.pow(1 + monthlyRate, numPayments))
                   / (Math.pow(1 + monthlyRate, numPayments) - 1);
      }

      return { ...loan, calculatedMinPayment: Math.min(minPayment, loan.balance) };
    });

    const allocatedPayments = new Map<string, number>();

    if (studentLoanStrategy === 'standard') {
      // Even distribution: divide budget equally across all loans
      const activeLoans = loansWithMinimums.filter(l => l.balance > 0);
      const evenAmount = studentLoanBudget / activeLoans.length;

      for (const loan of activeLoans) {
        // Cap at the loan balance
        const payment = Math.min(evenAmount, loan.balance);
        allocatedPayments.set(loan.id, payment);
      }
    } else {
      // Avalanche or Snowball: minimums first, then extra to priority
      let remainingBudget = studentLoanBudget;

      // First, assign minimum payments to all loans
      for (const loan of loansWithMinimums) {
        const minPayment = Math.min(loan.calculatedMinPayment, remainingBudget, loan.balance);
        allocatedPayments.set(loan.id, minPayment);
        remainingBudget -= minPayment;
      }

      // Then, apply extra to priority loans in order
      for (const loan of loansWithMinimums) {
        if (remainingBudget <= 0) break;
        const currentPayment = allocatedPayments.get(loan.id) || 0;
        const maxExtra = loan.balance - currentPayment;
        const extra = Math.min(remainingBudget, maxExtra);
        allocatedPayments.set(loan.id, currentPayment + extra);
        remainingBudget -= extra;
      }
    }

    // Return loans with allocated payments
    return studentLoans.map(loan => ({
      ...loan,
      monthlyPayment: Math.round((allocatedPayments.get(loan.id) || 0) * 100) / 100
    }));
  };

  // Memoized auto-allocated student loans for display
  const autoAllocatedStudentLoans = useMemo(() => {
    if (studentLoanMode !== 'auto') return [];
    return getAutoAllocatedStudentLoans();
  }, [loans['student-loan'], studentLoanBudget, studentLoanStrategy, studentLoanMode]);

  const getAllLoans = (): LoanEntry[] => {
    // For student loans in auto mode, use calculated payments
    const processedStudentLoans = studentLoanMode === 'auto'
      ? getAutoAllocatedStudentLoans()
      : loans['student-loan'];

    return [
      ...processedStudentLoans,
      ...loans['credit-card'],
      ...loans['personal-loan'],
      ...loans['auto-loan'],
      ...loans['mortgage'],
    ].filter(loan => loan.balance > 0);
  };

  const getTotalLoans = () => {
    return Object.values(loans).reduce((sum, arr) => sum + arr.length, 0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const allLoans = getAllLoans();
    if (allLoans.length > 0) {
      onCalculate(allLoans);
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

  const renderCreditCardFields = (loan: CreditCardEntry) => (
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
    </div>
  );

  const renderPersonalLoanFields = (loan: PersonalLoanEntry) => (
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
            <label>Interest Rate</label>
            <InfoTooltip {...FIELD_DEFINITIONS.interestRate} />
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
              onChange={(e) => updateLoan('personal-loan', loan.id, 'termMonths', parseInt(e.target.value))}
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
      </div>
    </>
  );

  const renderAutoLoanFields = (loan: AutoLoanEntry) => (
    <>
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
                const balance = price - (loan.downPayment || 0) - (loan.tradeInValue || 0) + (loan.tradeInPayoff || 0);
                updateLoan('auto-loan', loan.id, 'balance', Math.max(0, balance));
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
                const balance = (loan.vehiclePrice || 0) - down - (loan.tradeInValue || 0) + (loan.tradeInPayoff || 0);
                updateLoan('auto-loan', loan.id, 'balance', Math.max(0, balance));
              }}
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
              onChange={(e) => updateLoan('auto-loan', loan.id, 'termMonths', parseInt(e.target.value))}
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
                const balance = (loan.vehiclePrice || 0) - (loan.downPayment || 0) - tradeIn + (loan.tradeInPayoff || 0);
                updateLoan('auto-loan', loan.id, 'balance', Math.max(0, balance));
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
                const balance = (loan.vehiclePrice || 0) - (loan.downPayment || 0) - (loan.tradeInValue || 0) + payoff;
                updateLoan('auto-loan', loan.id, 'balance', Math.max(0, balance));
              }}
              placeholder="0.00"
            />
          </div>
        </div>
      </div>
      <div className="loan-entry__fields loan-entry__fields--tertiary">
        <div className="form-group">
          <label>Loan Amount</label>
          <div className="input-wrapper input-wrapper--readonly">
            <span className="input-prefix">$</span>
            <input
              type="number"
              value={loan.balance || 0}
              readOnly
              className="input--readonly"
            />
          </div>
        </div>
        <div className="form-group">
          <div className="label-with-tooltip">
            <label>Vehicle Year</label>
            <InfoTooltip {...FIELD_DEFINITIONS.vehicleYear} />
          </div>
          <div className="input-wrapper">
            <input
              type="number"
              min="1990"
              max={new Date().getFullYear() + 1}
              value={loan.vehicleYear || ''}
              onChange={(e) => updateLoan('auto-loan', loan.id, 'vehicleYear', parseInt(e.target.value) || new Date().getFullYear())}
              placeholder={new Date().getFullYear().toString()}
            />
          </div>
        </div>
        <div className="form-group">
          <label>Vehicle Type</label>
          <div className="input-wrapper">
            <select
              value={loan.isUsed ? 'used' : 'new'}
              onChange={(e) => updateLoan('auto-loan', loan.id, 'isUsed', e.target.value === 'used')}
              className="form-select"
            >
              <option value="new">New</option>
              <option value="used">Used</option>
            </select>
          </div>
        </div>
      </div>
    </>
  );

  const renderMortgageFields = (loan: MortgageEntry) => {
    const downPaymentPercent = loan.homePrice > 0 ? (loan.downPayment / loan.homePrice) * 100 : 0;
    const needsPMI = downPaymentPercent < 20;

    return (
      <>
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
                onChange={(e) => updateLoan('mortgage', loan.id, 'termYears', parseInt(e.target.value))}
                className="form-select"
              >
                <option value={15}>15 years</option>
                <option value={20}>20 years</option>
                <option value={30}>30 years</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Loan Amount</label>
            <div className="input-wrapper input-wrapper--readonly">
              <span className="input-prefix">$</span>
              <input
                type="number"
                value={loan.balance || 0}
                readOnly
                className="input--readonly"
              />
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
                value={`${downPaymentPercent.toFixed(1)}%`}
                readOnly
                className={`input--readonly ${needsPMI ? 'input--warning' : 'input--success'}`}
              />
            </div>
          </div>
        </div>
        <div className="loan-entry__fields loan-entry__fields--tertiary">
          <div className="form-group">
            <div className="label-with-tooltip">
              <label>Property Tax (Annual)</label>
              <InfoTooltip {...FIELD_DEFINITIONS.propertyTax} />
            </div>
            <div className="input-wrapper">
              <span className="input-prefix">$</span>
              <input
                type="number"
                step="100"
                min="0"
                value={loan.propertyTaxAnnual || ''}
                onChange={(e) => updateLoan('mortgage', loan.id, 'propertyTaxAnnual', parseFloat(e.target.value) || 0)}
                placeholder="0"
              />
            </div>
          </div>
          <div className="form-group">
            <div className="label-with-tooltip">
              <label>Home Insurance (Annual)</label>
              <InfoTooltip {...FIELD_DEFINITIONS.homeInsurance} />
            </div>
            <div className="input-wrapper">
              <span className="input-prefix">$</span>
              <input
                type="number"
                step="100"
                min="0"
                value={loan.homeInsuranceAnnual || ''}
                onChange={(e) => updateLoan('mortgage', loan.id, 'homeInsuranceAnnual', parseFloat(e.target.value) || 0)}
                placeholder="0"
              />
            </div>
          </div>
          <div className="form-group">
            <div className="label-with-tooltip">
              <label>HOA (Monthly)</label>
              <InfoTooltip {...FIELD_DEFINITIONS.hoa} />
            </div>
            <div className="input-wrapper">
              <span className="input-prefix">$</span>
              <input
                type="number"
                step="10"
                min="0"
                value={loan.hoaMonthly || ''}
                onChange={(e) => updateLoan('mortgage', loan.id, 'hoaMonthly', parseFloat(e.target.value) || 0)}
                placeholder="0"
              />
            </div>
          </div>
        </div>
        {needsPMI && (
          <div className="loan-entry__fields loan-entry__fields--pmi">
            <div className="form-group">
              <div className="label-with-tooltip">
                <label>PMI Rate (Annual)</label>
                <InfoTooltip {...FIELD_DEFINITIONS.pmiRate} />
              </div>
              <div className="input-wrapper">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="3"
                  value={loan.pmiRate || ''}
                  onChange={(e) => updateLoan('mortgage', loan.id, 'pmiRate', parseFloat(e.target.value) || 0.5)}
                  placeholder="0.5"
                />
                <span className="input-suffix">%</span>
              </div>
            </div>
            <div className="pmi-notice">
              <span className="pmi-notice__icon">!</span>
              <span>PMI required until you reach 20% equity</span>
            </div>
          </div>
        )}
      </>
    );
  };

  // Calculate minimum payment using Standard Repayment Plan (10-year fixed)
  // Formula: M = P * [r(1+r)^n] / [(1+r)^n - 1]
  const getRecommendedMinimum = (balance: number, interestRate: number): number => {
    if (balance <= 0) return 0;

    const monthlyRate = interestRate / 100 / 12;
    const numPayments = 120; // 10 years = 120 months

    // Handle 0% interest edge case
    if (monthlyRate === 0) {
      return balance / numPayments;
    }

    // Standard amortization formula
    const payment = balance * (monthlyRate * Math.pow(1 + monthlyRate, numPayments))
                  / (Math.pow(1 + monthlyRate, numPayments) - 1);

    return Math.min(payment, balance);
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
      <div className="loan-tabs">
        {LOAN_TYPES.map(type => {
          const count = loans[type.id].length;
          return (
            <button
              key={type.id}
              className={`loan-tab ${activeTab === type.id ? 'loan-tab--active' : ''}`}
              onClick={() => setActiveTab(type.id)}
              type="button"
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
              {activeTab === 'student-loan' && (
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

        {/* Student Loan Payment Options - shown after loans are entered */}
        {activeTab === 'student-loan' && activeLoans.length > 0 && (() => {
          const validLoans = activeLoans.filter((l): l is StudentLoanEntry =>
            l.type === 'student-loan' && l.balance > 0 && l.interestRate > 0
          );
          const totalMinPayment = validLoans.reduce((sum, l) =>
            sum + getRecommendedMinimum(l.balance, l.interestRate), 0
          );
          const hasValidLoans = validLoans.length > 0;

          if (!hasValidLoans) return null;

          return (
            <div className="student-loan-payment-section">
              <div className="payment-section-header">
                <h4>Payment Method</h4>
              </div>

              <div className="payment-mode-toggle">
                <div className="payment-mode-option">
                  <button
                    type="button"
                    className={`payment-mode-btn ${studentLoanMode === 'auto' ? 'payment-mode-btn--active' : ''}`}
                    onClick={() => setStudentLoanMode('auto')}
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
                    className={`payment-mode-btn ${studentLoanMode === 'specify' ? 'payment-mode-btn--active' : ''}`}
                    onClick={() => setStudentLoanMode('specify')}
                  >
                    Manual
                  </button>
                  <div className="payment-mode-tooltip">
                    Set your own payment amount for each loan individually.
                  </div>
                </div>
              </div>

              {studentLoanMode === 'auto' && (
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
                          value={studentLoanBudget || ''}
                          onChange={(e) => {
                            setStudentLoanBudget(parseFloat(e.target.value) || 0);
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
                            <strong>Standard Repayment Plan</strong>
                            <p>Minimum is based on the federal 10-year fixed payment plan — the default repayment schedule for federal student loans.</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="strategy-field">
                      <label>Strategy</label>
                      <div className="strategy-select-buttons">
                        <div className="strategy-btn-wrap">
                          <button
                            type="button"
                            className={`strategy-select-btn ${studentLoanStrategy === 'avalanche' ? 'strategy-select-btn--active' : ''}`}
                            onClick={() => setStudentLoanStrategy('avalanche')}
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
                            className={`strategy-select-btn ${studentLoanStrategy === 'snowball' ? 'strategy-select-btn--active' : ''}`}
                            onClick={() => setStudentLoanStrategy('snowball')}
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
                            className={`strategy-select-btn ${studentLoanStrategy === 'standard' ? 'strategy-select-btn--active' : ''}`}
                            onClick={() => setStudentLoanStrategy('standard')}
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
                  </div>

                  {/* Allocation Preview */}
                  {showAllocation && studentLoanBudget > 0 && (
                    <div className="allocation-preview">
                      <div className="allocation-header">
                        <h5>Payment Allocation</h5>
                        <span className="allocation-strategy">
                          {studentLoanStrategy === 'avalanche' && '⛰️ Avalanche'}
                          {studentLoanStrategy === 'snowball' && '❄️ Snowball'}
                          {studentLoanStrategy === 'standard' && '📊 Equal Split'}
                        </span>
                      </div>
                      <div className="allocation-list">
                        {autoAllocatedStudentLoans
                          .filter(loan => loan.balance > 0)
                          .map((loan, index) => {
                            const percentage = (loan.monthlyPayment / studentLoanBudget) * 100;
                            // Find original index for fallback name
                            const originalIndex = loans['student-loan'].findIndex(l => l.id === loan.id);
                            const displayName = loan.name || `Loan ${originalIndex >= 0 ? originalIndex + 1 : index + 1}`;
                            return (
                              <div key={loan.id} className="allocation-item">
                                <div className="allocation-item__info">
                                  <span className="allocation-item__name">{displayName}</span>
                                  <span className="allocation-item__details">
                                    ${loan.balance.toLocaleString()} @ {loan.interestRate}%
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
                        <strong>${studentLoanBudget.toLocaleString()}</strong>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {studentLoanMode === 'specify' && (
                <div className="manual-allocation">
                  <div className="allocation-header">
                    <h5>Set Your Payments</h5>
                    <span className="allocation-strategy">🎚️ Manual</span>
                  </div>
                  <div className="allocation-list">
                    {validLoans.map((loan, index) => {
                      const minPayment = getRecommendedMinimum(loan.balance, loan.interestRate);
                      const maxPayment = loan.balance;
                      const currentPayment = loan.monthlyPayment || minPayment;
                      const range = maxPayment - minPayment;
                      const percentage = range > 0 ? ((currentPayment - minPayment) / range) * 100 : 0;
                      // Find original index for fallback name
                      const originalIndex = loans['student-loan'].findIndex(l => l.id === loan.id);
                      const displayName = loan.name || `Loan ${originalIndex >= 0 ? originalIndex + 1 : index + 1}`;

                      return (
                        <div key={loan.id} className="allocation-item allocation-item--slider">
                          <div className="allocation-item__info">
                            <span className="allocation-item__name">{displayName}</span>
                            <span className="allocation-item__details">
                              ${loan.balance.toLocaleString()} @ {loan.interestRate}%
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
                              onChange={(e) => updateLoan('student-loan', loan.id, 'monthlyPayment', parseFloat(e.target.value))}
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
                              onChange={(e) => updateLoan('student-loan', loan.id, 'monthlyPayment', parseFloat(e.target.value) || minPayment)}
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
                      ${validLoans.reduce((sum, l) => sum + (l.monthlyPayment || getRecommendedMinimum(l.balance, l.interestRate)), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
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
        </div>
        {(() => {
          const needsAllocation = activeTab === 'student-loan' && studentLoanMode === 'auto' && !showAllocation;
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
