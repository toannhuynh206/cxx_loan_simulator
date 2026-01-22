import React, { useState } from 'react';
import { LoanResponse } from '../types/loan';

interface AmortizationTableProps {
  data: LoanResponse;
}

export const AmortizationTable: React.FC<AmortizationTableProps> = ({ data }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 12;

  const totalPages = Math.ceil(data.events.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  // Calculate milestones based on balance reduction
  // 25% paid off = balance is 75% of original, etc.
  let cumulativeInterest = 0;
  const milestoneTargets = [25, 50, 75];
  const milestoneMonths: Record<number, number> = {};

  // First pass: find milestone months based on end balance
  let targetIndex = 0;
  for (const event of data.events) {
    const paidOffPercent = ((data.principal - event.endBalance) / data.principal) * 100;
    while (targetIndex < milestoneTargets.length && paidOffPercent >= milestoneTargets[targetIndex]) {
      milestoneMonths[milestoneTargets[targetIndex]] = event.month;
      targetIndex++;
    }
  }

  // Second pass: build events with cumulative data and milestone info
  const eventsWithCumulative = data.events.map((event) => {
    cumulativeInterest += event.interest;
    const paidOffPercent = ((data.principal - event.endBalance) / data.principal) * 100;

    // Check if this month is a milestone
    let milestone: number | null = null;
    for (const target of milestoneTargets) {
      if (milestoneMonths[target] === event.month) {
        milestone = target;
        break;
      }
    }

    return {
      ...event,
      cumulativeInterest,
      paidOffPercent,
      principalPaid: event.payment,
      netProgress: event.payment - event.interest,
      milestone,
    };
  });

  const currentEventsWithCumulative = eventsWithCumulative.slice(startIndex, endIndex);

  // Calculate totals and stats
  const totalPayments = data.events.reduce((sum, e) => sum + e.payment, 0);
  const totalPrincipal = data.principal;
  const totalInterest = data.totalInterest;
  const avgMonthlyInterest = totalInterest / data.totalMonths;

  return (
    <div className="amortization-table-container">
      <div className="table-header">
        <h3>Amortization Schedule</h3>
      </div>

      <div className="table-wrapper">
        <table className="amortization-table">
          <thead>
            <tr>
              <th>Month</th>
              <th>Start Balance</th>
              <th>Payment</th>
              <th>Interest</th>
              <th>Net Progress</th>
              <th>End Balance</th>
            </tr>
          </thead>
          <tbody>
            {currentEventsWithCumulative.map((event) => {
              const milestoneClass = event.milestone
                ? `milestone-row milestone-${event.milestone}`
                : '';
              const finalClass = event.endBalance < 0.01 ? 'final-row' : '';

              return (
                <tr key={event.month} className={`${milestoneClass} ${finalClass}`}>
                  <td className="month-col">
                    {event.month}
                    {event.milestone && (
                      <span className={`milestone-badge milestone-${event.milestone}`}>
                        {event.milestone}%
                      </span>
                    )}
                  </td>
                  <td>{formatCurrency(event.startBalance)}</td>
                  <td className="payment-col">{formatCurrency(event.payment)}</td>
                  <td className="interest-col">{formatCurrency(event.interest)}</td>
                  <td className="net-progress-col">{formatCurrency(event.netProgress)}</td>
                  <td className={event.endBalance < 0.01 ? 'zero-balance' : ''}>
                    {formatCurrency(event.endBalance)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="table-pagination">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            title="First page"
          >
            ««
          </button>
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            title="Previous page"
          >
            «
          </button>
          <span className="page-info">
            Page {currentPage} of {totalPages}
            <span className="page-months">
              (Months {startIndex + 1}-{Math.min(endIndex, data.events.length)})
            </span>
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            title="Next page"
          >
            »
          </button>
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            title="Last page"
          >
            »»
          </button>
        </div>
      )}

      {/* Summary row */}
      <div className="table-summary">
        <div className="summary-item">
          <span className="label">Principal:</span>
          <span className="value principal">{formatCurrency(totalPrincipal)}</span>
        </div>
        <div className="summary-item">
          <span className="label">Total Interest:</span>
          <span className="value interest">{formatCurrency(totalInterest)}</span>
        </div>
        <div className="summary-item">
          <span className="label">Total Paid:</span>
          <span className="value">{formatCurrency(totalPayments)}</span>
        </div>
        <div className="summary-item">
          <span className="label">Avg Monthly Interest:</span>
          <span className="value interest">{formatCurrency(avgMonthlyInterest)}</span>
        </div>
      </div>
    </div>
  );
};
