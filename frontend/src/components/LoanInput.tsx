import React, { useState } from 'react';
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
import { InfoTooltip, FIELD_DEFINITIONS } from './InfoTooltip';

interface LoanInputProps {
  onCalculate: (loans: LoanEntry[]) => void;
  isLoading: boolean;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

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
        name: 'Credit Card',
        apr: 0,
        creditLimit: 0,
        minimumPaymentPercent: 2,
        minimumPaymentFloor: 25,
      } as CreditCardEntry;
    case 'personal-loan':
      return {
        ...base,
        type: 'personal-loan',
        name: 'Personal Loan',
        termMonths: 36,
        originationFeePercent: 0,
      } as PersonalLoanEntry;
    case 'auto-loan':
      return {
        ...base,
        type: 'auto-loan',
        name: 'Auto Loan',
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
        name: 'Mortgage',
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
        name: 'Student Loan',
        isFederal: true,
        isSubsidized: false,
        originationFeePercent: 1.057,
        repaymentPlan: 'standard',
        loanServicer: '',
      } as StudentLoanEntry;
  }
};

export const LoanInput: React.FC<LoanInputProps> = ({ onCalculate, isLoading }) => {
  const [activeTab, setActiveTab] = useState<LoanType>('credit-card');
  const [loans, setLoans] = useState<AllLoans>({
    'credit-card': [],
    'personal-loan': [],
    'auto-loan': [],
    'mortgage': [],
    'student-loan': [],
  });

  const addLoan = (type: LoanType) => {
    setLoans(prev => ({
      ...prev,
      [type]: [...prev[type], createEmptyLoan(type)],
    }));
  };

  const removeLoan = (type: LoanType, id: string) => {
    setLoans(prev => ({
      ...prev,
      [type]: prev[type].filter(loan => loan.id !== id),
    }));
  };

  const updateLoan = (type: LoanType, id: string, field: string, value: string | number | boolean) => {
    setLoans(prev => ({
      ...prev,
      [type]: prev[type].map(loan =>
        loan.id === id ? { ...loan, [field]: value } : loan
      ),
    }));
  };

  const getAllLoans = (): LoanEntry[] => {
    return [
      ...loans['credit-card'],
      ...loans['personal-loan'],
      ...loans['auto-loan'],
      ...loans['mortgage'],
      ...loans['student-loan'],
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
    <>
      <div className="loan-entry__fields">
        <div className="form-group">
          <div className="label-with-tooltip">
            <label>💵 Current Balance</label>
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
            <label>📊 APR</label>
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
            <label>🎯 Credit Limit</label>
            <InfoTooltip {...FIELD_DEFINITIONS.creditLimit} />
          </div>
          <div className="input-wrapper">
            <span className="input-prefix">$</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={loan.creditLimit || ''}
              onChange={(e) => updateLoan('credit-card', loan.id, 'creditLimit', parseFloat(e.target.value) || 0)}
              placeholder="0.00"
            />
          </div>
        </div>
      </div>
      <div className="loan-entry__fields loan-entry__fields--secondary">
        <div className="form-group">
          <div className="label-with-tooltip">
            <label>💳 Monthly Payment</label>
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
        <div className="form-group">
          <div className="label-with-tooltip">
            <label>📉 Min Payment %</label>
            <InfoTooltip {...FIELD_DEFINITIONS.minimumPaymentPercent} />
          </div>
          <div className="input-wrapper">
            <input
              type="number"
              step="0.1"
              min="1"
              max="10"
              value={loan.minimumPaymentPercent || ''}
              onChange={(e) => updateLoan('credit-card', loan.id, 'minimumPaymentPercent', parseFloat(e.target.value) || 2)}
              placeholder="2"
            />
            <span className="input-suffix">%</span>
          </div>
        </div>
        <div className="form-group">
          <div className="label-with-tooltip">
            <label>⬇️ Min Payment Floor</label>
            <InfoTooltip {...FIELD_DEFINITIONS.minimumPaymentFloor} />
          </div>
          <div className="input-wrapper">
            <span className="input-prefix">$</span>
            <input
              type="number"
              step="1"
              min="0"
              value={loan.minimumPaymentFloor || ''}
              onChange={(e) => updateLoan('credit-card', loan.id, 'minimumPaymentFloor', parseFloat(e.target.value) || 25)}
              placeholder="25"
            />
          </div>
        </div>
      </div>
    </>
  );

  const renderPersonalLoanFields = (loan: PersonalLoanEntry) => (
    <>
      <div className="loan-entry__fields">
        <div className="form-group">
          <div className="label-with-tooltip">
            <label>💵 Loan Balance</label>
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
            <label>📊 Interest Rate</label>
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
            <label>📅 Term</label>
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
            <label>💳 Monthly Payment</label>
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
            <label>📋 Origination Fee</label>
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
            <label>🚗 Vehicle Price</label>
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
            <label>💵 Down Payment</label>
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
            <label>📊 Interest Rate</label>
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
            <label>📅 Term</label>
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
            <label>🔄 Trade-in Value</label>
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
            <label>📝 Trade-in Payoff</label>
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
          <label>🧮 Loan Amount</label>
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
            <label>📆 Vehicle Year</label>
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
          <label>🆕 Vehicle Type</label>
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
            <label>Home Price</label>
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
            <label>Down Payment</label>
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
            <label>Interest Rate</label>
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
            <label>Term</label>
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
            <label>Down Payment %</label>
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
            <label>Property Tax (Annual)</label>
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
            <label>Home Insurance (Annual)</label>
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
            <label>HOA (Monthly)</label>
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
              <label>PMI Rate (Annual)</label>
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
              <span className="pmi-notice__icon">⚠️</span>
              <span>PMI required until you reach 20% equity</span>
            </div>
          </div>
        )}
      </>
    );
  };

  const renderStudentLoanFields = (loan: StudentLoanEntry) => (
    <>
      <div className="loan-entry__fields">
        <div className="form-group">
          <label>Loan Balance</label>
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
          <label>Interest Rate</label>
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
        <div className="form-group">
          <label>Monthly Payment</label>
          <div className="input-wrapper">
            <span className="input-prefix">$</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={loan.monthlyPayment || ''}
              onChange={(e) => updateLoan('student-loan', loan.id, 'monthlyPayment', parseFloat(e.target.value) || 0)}
              placeholder="0.00"
            />
          </div>
        </div>
      </div>
      <div className="loan-entry__fields loan-entry__fields--secondary">
        <div className="form-group">
          <label>Loan Type</label>
          <div className="input-wrapper">
            <select
              value={loan.isFederal ? 'federal' : 'private'}
              onChange={(e) => {
                const isFederal = e.target.value === 'federal';
                updateLoan('student-loan', loan.id, 'isFederal', isFederal);
                if (!isFederal) {
                  updateLoan('student-loan', loan.id, 'isSubsidized', false);
                  updateLoan('student-loan', loan.id, 'originationFeePercent', 0);
                } else {
                  updateLoan('student-loan', loan.id, 'originationFeePercent', 1.057);
                }
              }}
              className="form-select"
            >
              <option value="federal">Federal</option>
              <option value="private">Private</option>
            </select>
          </div>
        </div>
        {loan.isFederal && (
          <div className="form-group">
            <label>Subsidized?</label>
            <div className="input-wrapper">
              <select
                value={loan.isSubsidized ? 'yes' : 'no'}
                onChange={(e) => updateLoan('student-loan', loan.id, 'isSubsidized', e.target.value === 'yes')}
                className="form-select"
              >
                <option value="no">Unsubsidized</option>
                <option value="yes">Subsidized</option>
              </select>
            </div>
          </div>
        )}
        <div className="form-group">
          <label>Repayment Plan</label>
          <div className="input-wrapper">
            <select
              value={loan.repaymentPlan}
              onChange={(e) => updateLoan('student-loan', loan.id, 'repaymentPlan', e.target.value)}
              className="form-select"
            >
              <option value="standard">Standard (10 years)</option>
              <option value="graduated">Graduated</option>
              <option value="extended">Extended (25 years)</option>
              <option value="income-driven">Income-Driven</option>
            </select>
          </div>
        </div>
      </div>
      <div className="loan-entry__fields loan-entry__fields--tertiary">
        <div className="form-group">
          <label>Loan Servicer</label>
          <div className="input-wrapper">
            <input
              type="text"
              value={loan.loanServicer || ''}
              onChange={(e) => updateLoan('student-loan', loan.id, 'loanServicer', e.target.value)}
              placeholder="e.g., Nelnet, MOHELA"
            />
          </div>
        </div>
        {loan.isFederal && (
          <div className="form-group">
            <label>Origination Fee</label>
            <div className="input-wrapper input-wrapper--readonly">
              <input
                type="text"
                value={`${loan.originationFeePercent}%`}
                readOnly
                className="input--readonly"
              />
            </div>
          </div>
        )}
      </div>
      {loan.isSubsidized && (
        <div className="loan-entry__notice loan-entry__notice--info">
          <span className="notice__icon">ℹ️</span>
          <span>Subsidized: Government pays interest while in school and during grace periods</span>
        </div>
      )}
    </>
  );

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
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => addLoan(activeTab)}
            >
              + Add Your First {activeTypeInfo.label}
            </button>
          </div>
        ) : (
          <div className="loan-entries">
            {activeLoans.map((loan, index) => (
              <div key={loan.id} className="loan-entry">
                <div className="loan-entry__header">
                  <span className="loan-entry__number">#{index + 1}</span>
                  <input
                    type="text"
                    className="loan-entry__name"
                    value={loan.name}
                    onChange={(e) => updateLoan(activeTab, loan.id, 'name', e.target.value)}
                    placeholder={`${activeTypeInfo.label} name`}
                  />
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
      </div>

      {/* Calculate Button */}
      <div className="loan-input__footer">
        <div className="loan-input__summary">
          {getTotalLoans() > 0 && (
            <span>{getTotalLoans()} loan{getTotalLoans() !== 1 ? 's' : ''} added</span>
          )}
        </div>
        <button
          type="submit"
          className="btn btn--primary"
          disabled={isLoading || getAllLoans().length === 0}
          onClick={handleSubmit}
        >
          {isLoading ? (
            <>
              <span className="spinner" />
              Calculating...
            </>
          ) : (
            'Calculate Payoff'
          )}
        </button>
      </div>
    </div>
  );
};
