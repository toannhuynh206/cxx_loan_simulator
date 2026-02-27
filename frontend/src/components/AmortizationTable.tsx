import React, { useState, useMemo, useEffect } from 'react';
import { LoanResponse, CombinedLoanResult, MonthlyEvent } from '../types/loan';

const LOAN_COLORS = [
  '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899',
  '#14b8a6', '#f97316', '#06b6d4', '#84cc16',
];

interface AmortizationTableProps {
  data: LoanResponse;
  multiLoanData?: CombinedLoanResult | null;
  viewMode: 'combined' | 'per-loan';
  onViewModeChange: (mode: 'combined' | 'per-loan') => void;
}

interface ProcessedEvent extends MonthlyEvent {
  displayPayment: number;
  cumulativeInterest: number;
  paidOffPercent: number;
  principalPaid: number;
  netProgress: number;
  milestone: number | null;
}

const ROWS_PER_PAGE = 12;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(value);

function processEvents(events: MonthlyEvent[], principal: number): ProcessedEvent[] {
  const milestoneTargets = [25, 50, 75];
  const milestoneMonths: Record<number, number> = {};
  let targetIndex = 0;

  for (const event of events) {
    const paidOffPercent = ((principal - event.endBalance) / principal) * 100;
    while (targetIndex < milestoneTargets.length && paidOffPercent >= milestoneTargets[targetIndex]) {
      milestoneMonths[milestoneTargets[targetIndex]] = event.month;
      targetIndex++;
    }
  }

  let cumulativeInterest = 0;
  return events.map((event) => {
    cumulativeInterest += event.interest;
    const paidOffPercent = ((principal - event.endBalance) / principal) * 100;
    const displayPayment = event.totalPayment ?? event.payment;
    let milestone: number | null = null;
    for (const target of milestoneTargets) {
      if (milestoneMonths[target] === event.month) { milestone = target; break; }
    }
    return {
      ...event,
      displayPayment,
      cumulativeInterest,
      paidOffPercent,
      principalPaid: event.principalPaid ?? Math.max(0, event.payment - event.interest),
      netProgress: event.payment - event.interest,
      milestone,
    };
  });
}

// ── SINGLE LOAN TABLE ──────────────────────────────────────────
interface LoanTableProps {
  events: MonthlyEvent[];
  principal: number;
  totalInterest: number;
  accentColor?: string;
}

const LoanTableView: React.FC<LoanTableProps> = ({ events, principal, totalInterest, accentColor }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const processed = useMemo(() => processEvents(events, principal), [events, principal]);
  const totalPages = Math.ceil(processed.length / ROWS_PER_PAGE);
  const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
  const visible = processed.slice(startIndex, startIndex + ROWS_PER_PAGE);
  const totalPayments = events.reduce((sum, e) => sum + (e.totalPayment ?? e.payment), 0);
  const avgMonthlyInterest = totalInterest / (events.length || 1);

  const borderColor = accentColor ? `1px solid ${accentColor}33` : undefined;

  return (
    <div className="loan-table-view" style={borderColor ? { borderTop: `3px solid ${accentColor}` } : {}}>
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
            {visible.map((event) => {
              const milestoneClass = event.milestone ? `milestone-row milestone-${event.milestone}` : '';
              const finalClass = event.endBalance < 0.01 ? 'final-row' : '';
              return (
                <tr key={event.month} className={`${milestoneClass} ${finalClass}`}>
                  <td className="month-col">
                    {event.month}
                    {event.milestone && (
                      <span className={`milestone-badge milestone-${event.milestone}`}>{event.milestone}%</span>
                    )}
                  </td>
                  <td>{formatCurrency(event.startBalance)}</td>
                  <td className="payment-col">{formatCurrency(event.displayPayment)}</td>
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

      {totalPages > 1 && (
        <div className="table-pagination">
          <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} title="First">««</button>
          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} title="Prev">«</button>
          <span className="page-info">
            Page {currentPage} of {totalPages}
            <span className="page-months">(Months {startIndex + 1}–{Math.min(startIndex + ROWS_PER_PAGE, events.length)})</span>
          </span>
          <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} title="Next">»</button>
          <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} title="Last">»»</button>
        </div>
      )}

      <div className="table-summary">
        <div className="summary-item">
          <span className="label">Principal:</span>
          <span className="value principal">{formatCurrency(principal)}</span>
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

// ── MAIN COMPONENT ─────────────────────────────────────────────
export const AmortizationTable: React.FC<AmortizationTableProps> = ({ data, multiLoanData, viewMode, onViewModeChange }) => {
  const hasMultipleLoans = !!multiLoanData && multiLoanData.loans.length > 1;
  const [selectedLoanId, setSelectedLoanId] = useState<string>('');

  // Select first loan when data arrives
  useEffect(() => {
    if (multiLoanData && multiLoanData.loans.length > 0 && !selectedLoanId) {
      setSelectedLoanId(multiLoanData.loans[0].loanId);
    }
  }, [multiLoanData, selectedLoanId]);

  const selectedLoan = useMemo(() =>
    multiLoanData?.loans.find(l => l.loanId === selectedLoanId),
    [multiLoanData, selectedLoanId]
  );

  const selectedLoanIndex = useMemo(() =>
    multiLoanData?.loans.findIndex(l => l.loanId === selectedLoanId) ?? 0,
    [multiLoanData, selectedLoanId]
  );

  // ── Combined mode data ───────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const processedCombined = useMemo(() => processEvents(data.events, data.principal), [data]);
  const totalPages = Math.ceil(processedCombined.length / ROWS_PER_PAGE);
  const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
  const visibleCombined = processedCombined.slice(startIndex, startIndex + ROWS_PER_PAGE);
  const totalPaymentsCombined = data.events.reduce((sum, e) => sum + (e.totalPayment ?? e.payment), 0);
  const avgMonthlyInterest = data.totalInterest / (data.events.length || 1);

  return (
    <div className="amortization-table-container">
      <div className="table-header">
        <h3>Amortization Schedule</h3>

        {hasMultipleLoans && (
          <div className="view-mode-toggle">
            <button
              className={`view-mode-btn ${viewMode === 'combined' ? 'active' : ''}`}
              onClick={() => onViewModeChange('combined')}
            >
              Combined
            </button>
            <button
              className={`view-mode-btn ${viewMode === 'per-loan' ? 'active' : ''}`}
              onClick={() => onViewModeChange('per-loan')}
            >
              Per Loan
            </button>
          </div>
        )}
      </div>

      {/* ── PER-LOAN MODE ── */}
      {viewMode === 'per-loan' && multiLoanData && (
        <div className="per-loan-table-view">
          {/* Loan tab strip */}
          <div className="loan-tabs" role="tablist">
            {multiLoanData.loans.map((loan, i) => {
              const color = LOAN_COLORS[i % LOAN_COLORS.length];
              const isActive = loan.loanId === selectedLoanId;
              return (
                <button
                  key={loan.loanId}
                  role="tab"
                  aria-selected={isActive}
                  className={`loan-tab ${isActive ? 'active' : ''}`}
                  style={{
                    '--tab-color': color,
                    borderBottomColor: isActive ? color : 'transparent',
                    color: isActive ? color : undefined,
                  } as React.CSSProperties}
                  onClick={() => setSelectedLoanId(loan.loanId)}
                >
                  <span className="loan-tab-dot" style={{ background: color }}></span>
                  <span className="loan-tab-name">{loan.loanName}</span>
                  <span className="loan-tab-meta">{loan.totalMonths}mo</span>
                </button>
              );
            })}
          </div>

          {/* Selected loan stats bar */}
          {selectedLoan && (
            <div className="loan-tab-stats">
              <div className="loan-tab-stat">
                <span className="stat-label">Balance</span>
                <span className="stat-value">{formatCurrency(selectedLoan.principal)}</span>
              </div>
              <div className="loan-tab-stat">
                <span className="stat-label">Rate</span>
                <span className="stat-value">{selectedLoan.apr.toFixed(2)}%</span>
              </div>
              <div className="loan-tab-stat">
                <span className="stat-label">Total Interest</span>
                <span className="stat-value interest">{formatCurrency(selectedLoan.totalInterest ?? 0)}</span>
              </div>
              <div className="loan-tab-stat">
                <span className="stat-label">Payoff</span>
                <span className="stat-value" style={{ color: LOAN_COLORS[selectedLoanIndex % LOAN_COLORS.length] }}>
                  Month {selectedLoan.totalMonths}
                </span>
              </div>
            </div>
          )}

          {/* Selected loan table */}
          {selectedLoan && (
            <LoanTableView
              events={selectedLoan.events}
              principal={selectedLoan.principal}
              totalInterest={selectedLoan.totalInterest ?? 0}
              accentColor={LOAN_COLORS[selectedLoanIndex % LOAN_COLORS.length]}
            />
          )}
        </div>
      )}

      {/* ── COMBINED MODE ── */}
      {viewMode === 'combined' && (
        <>
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
                {visibleCombined.map((event) => {
                  const milestoneClass = event.milestone ? `milestone-row milestone-${event.milestone}` : '';
                  const finalClass = event.endBalance < 0.01 ? 'final-row' : '';
                  return (
                    <tr key={event.month} className={`${milestoneClass} ${finalClass}`}>
                      <td className="month-col">
                        {event.month}
                        {event.milestone && (
                          <span className={`milestone-badge milestone-${event.milestone}`}>{event.milestone}%</span>
                        )}
                      </td>
                      <td>{formatCurrency(event.startBalance)}</td>
                      <td className="payment-col">{formatCurrency(event.displayPayment)}</td>
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

          {totalPages > 1 && (
            <div className="table-pagination">
              <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} title="First">««</button>
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} title="Prev">«</button>
              <span className="page-info">
                Page {currentPage} of {totalPages}
                <span className="page-months">(Months {startIndex + 1}–{Math.min(startIndex + ROWS_PER_PAGE, data.events.length)})</span>
              </span>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} title="Next">»</button>
              <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} title="Last">»»</button>
            </div>
          )}

          <div className="table-summary">
            <div className="summary-item">
              <span className="label">Principal:</span>
              <span className="value principal">{formatCurrency(data.principal)}</span>
            </div>
            <div className="summary-item">
              <span className="label">Total Interest:</span>
              <span className="value interest">{formatCurrency(data.totalInterest)}</span>
            </div>
            <div className="summary-item">
              <span className="label">Total Paid:</span>
              <span className="value">{formatCurrency(totalPaymentsCombined)}</span>
            </div>
            <div className="summary-item">
              <span className="label">Avg Monthly Interest:</span>
              <span className="value interest">{formatCurrency(avgMonthlyInterest)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
