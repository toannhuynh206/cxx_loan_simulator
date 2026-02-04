import React from 'react';
import { StrategyResult } from '../types/payoffStrategy';
import { LoanCalculationResult } from '../types/loan';
import { formatCurrency, formatMonths } from '../services/payoffStrategyService';

interface PayoffOrderListProps {
  result: StrategyResult;
  originalLoans: LoanCalculationResult[];
}

export const PayoffOrderList: React.FC<PayoffOrderListProps> = ({ result, originalLoans }) => {
  if (result.payoffOrder.length === 0 || result.monthlyEvents.length === 0) {
    return null;
  }

  // Get the display name for a loan
  const getLoanDisplayName = (loanId: string): string => {
    const index = originalLoans.findIndex(loan => loan.loanId === loanId);
    if (index >= 0) {
      const loan = originalLoans[index];
      return loan.loanName || `Loan ${index + 1}`;
    }
    return 'Loan';
  };

  // Get loan details
  const getLoanDetails = (loanId: string) => {
    return originalLoans.find(loan => loan.loanId === loanId);
  };

  // Get initial payment allocation from first month
  const getInitialPayment = (loanId: string): number => {
    const firstMonth = result.monthlyEvents[0];
    const loanEvent = firstMonth?.loans.find(l => l.loanId === loanId);
    return loanEvent?.payment || 0;
  };

  // Calculate total monthly payment
  const totalMonthlyPayment = result.monthlyEvents[0]?.totalPayment || 0;

  // Build loan data with payment allocations, sorted by payment amount (highest first)
  // This shows which loan is receiving the most money in the current allocation
  const orderedLoans = result.payoffOrder
    .map(item => ({
      ...item,
      details: getLoanDetails(item.loanId),
      displayName: getLoanDisplayName(item.loanId),
      initialPayment: getInitialPayment(item.loanId),
    }))
    .sort((a, b) => b.initialPayment - a.initialPayment);

  return (
    <div className="payoff-allocation">
      <h4>Payment Allocation</h4>
      <p className="payoff-allocation__subtitle">
        How your monthly payment of <strong>{formatCurrency(totalMonthlyPayment)}</strong> is distributed
      </p>

      <div className="allocation-cards">
        {orderedLoans.map((loan, index) => {
          const percentage = totalMonthlyPayment > 0
            ? (loan.initialPayment / totalMonthlyPayment) * 100
            : 0;

          return (
            <div key={loan.loanId} className="allocation-card">
              <div className="allocation-card__rank">
                <span className="rank-badge">{index + 1}</span>
                <span className="rank-label">Priority</span>
              </div>

              <div className="allocation-card__main">
                <div className="allocation-card__header">
                  <span className="allocation-card__name">{loan.displayName}</span>
                  <span className="allocation-card__balance">
                    {formatCurrency(loan.details?.principal || 0)} @ {loan.details?.apr || 0}%
                  </span>
                </div>

                <div className="allocation-card__bar-wrap">
                  <div
                    className="allocation-card__bar"
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                </div>

                <div className="allocation-card__payment">
                  <span className="payment-amount">{formatCurrency(loan.initialPayment)}</span>
                  <span className="payment-percent">{percentage.toFixed(0)}% of payment</span>
                </div>
              </div>

              <div className="allocation-card__result">
                <div className="result-item">
                  <span className="result-label">Paid off</span>
                  <span className="result-value">{formatMonths(loan.payoffMonth)}</span>
                </div>
                <div className="result-item">
                  <span className="result-label">Interest</span>
                  <span className="result-value">{formatCurrency(loan.totalInterestPaid)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="payoff-total-summary">
        <div className="summary-row">
          <span className="summary-label">Total Monthly Payment</span>
          <span className="summary-value">{formatCurrency(totalMonthlyPayment)}</span>
        </div>
        <div className="summary-row">
          <span className="summary-label">All Debt Free In</span>
          <span className="summary-value summary-value--highlight">{formatMonths(result.totalMonths)}</span>
        </div>
        <div className="summary-row">
          <span className="summary-label">Total Interest</span>
          <span className="summary-value">{formatCurrency(result.totalInterest)}</span>
        </div>
      </div>
    </div>
  );
};
