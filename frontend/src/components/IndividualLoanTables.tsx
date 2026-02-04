import React, { useState } from 'react';
import { StrategyResult } from '../types/payoffStrategy';
import { LoanCalculationResult } from '../types/loan';
import { formatCurrency } from '../services/payoffStrategyService';

interface IndividualLoanTablesProps {
  result: StrategyResult;
  originalLoans: LoanCalculationResult[];
}

export const IndividualLoanTables: React.FC<IndividualLoanTablesProps> = ({ result, originalLoans }) => {
  const [expandedLoan, setExpandedLoan] = useState<string | null>(null);

  // Get display name for a loan
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

  // Extract individual loan data from monthly events
  const getLoanAmortization = (loanId: string) => {
    return result.monthlyEvents
      .map(event => {
        const loanEvent = event.loans.find(l => l.loanId === loanId);
        if (!loanEvent || loanEvent.startBalance <= 0.01) return null;
        return {
          month: event.month,
          startBalance: loanEvent.startBalance,
          payment: loanEvent.payment,
          interest: loanEvent.interest,
          principal: loanEvent.payment - loanEvent.interest,
          endBalance: loanEvent.endBalance,
        };
      })
      .filter(Boolean);
  };

  // Get unique loan IDs
  const loanIds = result.monthlyEvents[0]?.loans.map(l => l.loanId) || [];

  if (loanIds.length === 0) return null;

  return (
    <div className="individual-loan-tables">
      <h4>Individual Loan Amortization</h4>
      <p className="individual-loan-tables__subtitle">
        Click on a loan to view its detailed payment schedule
      </p>

      <div className="loan-table-accordions">
        {loanIds.map(loanId => {
          const isExpanded = expandedLoan === loanId;
          const loanDetails = getLoanDetails(loanId);
          const amortization = getLoanAmortization(loanId);
          const displayName = getLoanDisplayName(loanId);

          // Calculate totals
          const totalPayments = amortization.reduce((sum, row) => sum + (row?.payment || 0), 0);
          const totalInterest = amortization.reduce((sum, row) => sum + (row?.interest || 0), 0);

          return (
            <div key={loanId} className={`loan-accordion ${isExpanded ? 'loan-accordion--expanded' : ''}`}>
              <button
                type="button"
                className="loan-accordion__header"
                onClick={() => setExpandedLoan(isExpanded ? null : loanId)}
              >
                <div className="loan-accordion__info">
                  <span className="loan-accordion__name">{displayName}</span>
                  <span className="loan-accordion__meta">
                    {formatCurrency(loanDetails?.principal || 0)} @ {loanDetails?.apr || 0}%
                  </span>
                </div>
                <div className="loan-accordion__summary">
                  <span className="loan-accordion__stat">
                    <span className="stat-label">Payments:</span>
                    <span className="stat-value">{amortization.length} months</span>
                  </span>
                  <span className="loan-accordion__stat">
                    <span className="stat-label">Total Interest:</span>
                    <span className="stat-value">{formatCurrency(totalInterest)}</span>
                  </span>
                </div>
                <span className="loan-accordion__toggle">
                  {isExpanded ? '−' : '+'}
                </span>
              </button>

              {isExpanded && (
                <div className="loan-accordion__content">
                  <div className="loan-table-wrapper">
                    <table className="loan-table">
                      <thead>
                        <tr>
                          <th>Month</th>
                          <th>Starting Balance</th>
                          <th>Payment</th>
                          <th>Principal</th>
                          <th>Interest</th>
                          <th>Ending Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {amortization.map((row, index) => row && (
                          <tr key={row.month}>
                            <td>{row.month}</td>
                            <td>{formatCurrency(row.startBalance)}</td>
                            <td>{formatCurrency(row.payment)}</td>
                            <td>{formatCurrency(row.principal)}</td>
                            <td>{formatCurrency(row.interest)}</td>
                            <td>{formatCurrency(row.endBalance)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td><strong>Total</strong></td>
                          <td></td>
                          <td><strong>{formatCurrency(totalPayments)}</strong></td>
                          <td><strong>{formatCurrency(loanDetails?.principal || 0)}</strong></td>
                          <td><strong>{formatCurrency(totalInterest)}</strong></td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
