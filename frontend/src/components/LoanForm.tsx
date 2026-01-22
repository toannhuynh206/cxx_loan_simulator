import React, { useState } from 'react';
import { LoanRequest } from '../types/loan';

interface LoanFormProps {
  onSubmit: (request: LoanRequest) => void;
  isLoading: boolean;
}

export const LoanForm: React.FC<LoanFormProps> = ({ onSubmit, isLoading }) => {
  const [principal, setPrincipal] = useState<string>('10000');
  const [apr, setApr] = useState<string>('18.99');
  const [monthlyPayment, setMonthlyPayment] = useState<string>('250');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    const p = parseFloat(principal);
    const a = parseFloat(apr);
    const m = parseFloat(monthlyPayment);

    if (isNaN(p) || p <= 0) {
      newErrors.principal = 'Principal must be a positive number';
    }
    if (isNaN(a) || a < 0 || a > 100) {
      newErrors.apr = 'APR must be between 0 and 100';
    }
    if (isNaN(m) || m <= 0) {
      newErrors.monthlyPayment = 'Monthly payment must be a positive number';
    }

    // Check if payment covers minimum interest
    if (!newErrors.principal && !newErrors.apr && !newErrors.monthlyPayment) {
      const monthlyInterest = p * (a / 100 / 12);
      if (m <= monthlyInterest) {
        newErrors.monthlyPayment = `Payment must exceed $${monthlyInterest.toFixed(2)} to pay off loan`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit({
        principal: parseFloat(principal),
        apr: parseFloat(apr),
        monthlyPayment: parseFloat(monthlyPayment),
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="loan-form">
      <div className="form-group">
        <label htmlFor="principal">Principal Amount</label>
        <div className="input-wrapper">
          <input
            id="principal"
            type="number"
            step="0.01"
            min="0"
            value={principal}
            onChange={(e) => setPrincipal(e.target.value)}
            disabled={isLoading}
            placeholder="10,000"
          />
          <span className="input-prefix">$</span>
        </div>
        {errors.principal && <span className="error">{errors.principal}</span>}
      </div>

      <div className="form-group">
        <label htmlFor="apr">Annual Percentage Rate (APR)</label>
        <div className="input-wrapper">
          <input
            id="apr"
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={apr}
            onChange={(e) => setApr(e.target.value)}
            disabled={isLoading}
            placeholder="18.99"
            style={{ paddingLeft: '1rem', paddingRight: '2.5rem' }}
          />
          <span className="input-suffix">%</span>
        </div>
        {errors.apr && <span className="error">{errors.apr}</span>}
      </div>

      <div className="form-group">
        <label htmlFor="monthlyPayment">Monthly Payment</label>
        <div className="input-wrapper">
          <input
            id="monthlyPayment"
            type="number"
            step="0.01"
            min="0"
            value={monthlyPayment}
            onChange={(e) => setMonthlyPayment(e.target.value)}
            disabled={isLoading}
            placeholder="250"
          />
          <span className="input-prefix">$</span>
        </div>
        {errors.monthlyPayment && <span className="error">{errors.monthlyPayment}</span>}
      </div>

      <div className="form-actions">
        <button type="submit" disabled={isLoading} className="btn btn--primary">
          {isLoading ? (
            <>
              <span className="spinner" />
              Calculating...
            </>
          ) : (
            'Calculate Amortization'
          )}
        </button>
      </div>
    </form>
  );
};
