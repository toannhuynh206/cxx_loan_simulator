import React, { useState, useMemo, useEffect } from 'react';
import { LoanResponse, CombinedLoanResult, MonthlyEvent } from '../types/loan';
import { useTheme } from '../context/ThemeContext';

const LOAN_COLORS = [
  '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899',
  '#14b8a6', '#f97316', '#06b6d4', '#84cc16',
];

const ROWS = 12;

interface Props {
  data: LoanResponse;
  multiLoanData: CombinedLoanResult | null;
}

interface ProcessedRow {
  month: number;
  startBalance: number;
  payment: number;
  interest: number;
  netProgress: number;
  endBalance: number;
  payoffPct: number;
  cumulativeInterest: number;
  milestone: 25 | 50 | 75 | null;
}

function processEvents(events: MonthlyEvent[], principal: number): ProcessedRow[] {
  const milestoneTargets = [25, 50, 75] as const;
  const milestoneMonths = new Map<number, 25 | 50 | 75>();
  let tIdx = 0;
  for (const e of events) {
    const pct = ((principal - e.endBalance) / principal) * 100;
    while (tIdx < milestoneTargets.length && pct >= milestoneTargets[tIdx]) {
      milestoneMonths.set(e.month, milestoneTargets[tIdx]);
      tIdx++;
    }
  }
  let cumInterest = 0;
  return events.map(e => {
    cumInterest += e.interest;
    return {
      month: e.month,
      startBalance: e.startBalance,
      payment: e.totalPayment ?? e.payment,
      interest: e.interest,
      netProgress: e.payment - e.interest,
      endBalance: e.endBalance,
      payoffPct: ((principal - e.endBalance) / principal) * 100,
      cumulativeInterest: cumInterest,
      milestone: milestoneMonths.get(e.month) ?? null,
    };
  });
}

const fmt = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);


export const MobileAmortizationTable: React.FC<Props> = ({ data, multiLoanData }) => {
  const { theme } = useTheme();
  const hasMulti = !!multiLoanData && multiLoanData.loans.length > 1;

  const [viewMode, setViewMode] = useState<'combined' | 'per-loan'>(hasMulti ? 'per-loan' : 'combined');
  const [activeLoanIdx, setActiveLoanIdx] = useState(0);
  const [page, setPage] = useState(0);

  // Reset page on view change
  useEffect(() => { setPage(0); }, [viewMode, activeLoanIdx]);

  const activeLoan = multiLoanData?.loans[activeLoanIdx];
  const activeColor = LOAN_COLORS[activeLoanIdx % LOAN_COLORS.length];

  const isDark = theme === 'dark';
  const accent = isDark ? '#2dd4bf' : '#0d9488';
  const paymentColor = isDark ? '#34d399' : '#059669';
  const interestColor = isDark ? '#f87171' : '#dc2626';
  const netColor = isDark ? '#a5b4fc' : '#4f46e5';

  const MILESTONE_CFG: Record<number, { glow: string; border: string }> = {
    25: { glow: isDark ? 'rgba(125,211,252,0.06)' : 'rgba(125,211,252,0.14)', border: '#7dd3fc' },
    50: { glow: isDark ? 'rgba(56,189,248,0.07)' : 'rgba(56,189,248,0.14)', border: '#38bdf8' },
    75: { glow: isDark ? 'rgba(2,132,199,0.08)' : 'rgba(2,132,199,0.12)', border: '#0284c7' },
  };

  const allRows = useMemo((): ProcessedRow[] => {
    if (viewMode === 'per-loan' && activeLoan) {
      return processEvents(activeLoan.events, activeLoan.principal);
    }
    return processEvents(data.events, data.principal);
  }, [viewMode, activeLoan, data]);

  const totalPages = Math.ceil(allRows.length / ROWS);
  const pageRows = allRows.slice(page * ROWS, (page + 1) * ROWS);

  const principal = viewMode === 'per-loan' && activeLoan ? activeLoan.principal : data.principal;
  const totalInterest = viewMode === 'per-loan' && activeLoan ? (activeLoan.totalInterest ?? 0) : data.totalInterest;
  const totalPaid = principal + totalInterest;
  const avgMonthlyInterest = totalInterest / (allRows.length || 1);

  return (
    <div className="msat-root">

      {/* ── Title + view toggle ── */}
      <div className="msat-header">
        <h2 className="m-section-title" style={{ marginBottom: 0, fontSize: '1.1rem' }}>
          Amortization Schedule
        </h2>
        {hasMulti && (
          <div className="msat-toggle">
            <button
              className={`msat-toggle-btn ${viewMode === 'combined' ? 'active' : ''}`}
              onClick={() => setViewMode('combined')}
            >
              Combined
            </button>
            <button
              className={`msat-toggle-btn ${viewMode === 'per-loan' ? 'active' : ''}`}
              onClick={() => setViewMode('per-loan')}
            >
              Per Loan
            </button>
          </div>
        )}
      </div>

      {/* ── Loan pill selector ── */}
      {hasMulti && viewMode === 'per-loan' && (
        <div className="msat-loan-pills">
          {multiLoanData!.loans.map((loan, i) => {
            const color = LOAN_COLORS[i % LOAN_COLORS.length];
            const isActive = i === activeLoanIdx;
            return (
              <button
                key={loan.loanId}
                className={`msat-loan-pill ${isActive ? 'active' : ''}`}
                style={{ '--msat-pill-color': color } as React.CSSProperties}
                onClick={() => setActiveLoanIdx(i)}
              >
                <span className="msat-pill-dot" />
                <span className="msat-pill-name">{loan.loanName}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Info strip (per-loan mode) ── */}
      {viewMode === 'per-loan' && activeLoan && (
        <div className="msat-info-strip" style={{ borderLeftColor: activeColor }}>
          <div className="msat-info-cell">
            <span className="msat-info-lbl">Principal</span>
            <span className="msat-info-val">{fmt(activeLoan.principal)}</span>
          </div>
          <div className="msat-info-div" />
          <div className="msat-info-cell">
            <span className="msat-info-lbl">APR</span>
            <span className="msat-info-val">{activeLoan.apr.toFixed(2)}%</span>
          </div>
          <div className="msat-info-div" />
          <div className="msat-info-cell">
            <span className="msat-info-lbl">Interest</span>
            <span className="msat-info-val" style={{ color: interestColor }}>{fmt(activeLoan.totalInterest ?? 0)}</span>
          </div>
          <div className="msat-info-div" />
          <div className="msat-info-cell">
            <span className="msat-info-lbl">Payoff</span>
            <span className="msat-info-val" style={{ color: activeColor }}>Mo {activeLoan.totalMonths}</span>
          </div>
        </div>
      )}

      {/* ── Scrollable table ── */}
      <div className="msat-table-wrap">
        <table className="msat-table">
          <thead>
            <tr>
              <th className="msat-th msat-sticky-col msat-col-mo">Mo</th>
              <th className="msat-th msat-col-start">Start Bal</th>
              <th className="msat-th msat-col-pmt" style={{ color: paymentColor }}>Payment</th>
              <th className="msat-th msat-col-int" style={{ color: interestColor }}>Interest</th>
              <th className="msat-th msat-col-net" style={{ color: netColor }}>Net Prog</th>
              <th className="msat-th msat-col-end">End Bal</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, idx) => {
              const ms = row.milestone ? MILESTONE_CFG[row.milestone] : null;
              const isFinal = row.endBalance < 0.01;
              const barPct = Math.min(100, row.payoffPct);

              return (
                <tr
                  key={row.month}
                  className={`msat-tr ${idx % 2 === 1 ? 'msat-alt' : ''} ${ms ? 'msat-milestone' : ''} ${isFinal ? 'msat-final' : ''}`}
                  style={ms ? { background: ms.glow } : undefined}
                >
                  {/* Sticky month cell */}
                  <td className="msat-td msat-sticky-col msat-col-mo">
                    <div className="msat-month-wrap">
                      {ms && (
                        <div className="msat-month-accent" style={{ background: ms.border }} />
                      )}
                      <span className="msat-month-num">{row.month}</span>
                      {row.milestone && (
                        <span
                          className="msat-ms-badge"
                          style={{ color: ms!.border, background: ms!.border + '22' }}
                        >
                          {row.milestone}%
                        </span>
                      )}
                      <div
                        className="msat-progress-strip"
                        style={{ '--bar-w': `${barPct}%`, '--bar-c': accent } as React.CSSProperties}
                      />
                    </div>
                  </td>

                  <td className="msat-td msat-num msat-col-start">{fmt(row.startBalance)}</td>
                  <td className="msat-td msat-num msat-col-pmt" style={{ color: paymentColor }}>{fmt(row.payment)}</td>
                  <td className="msat-td msat-num msat-col-int" style={{ color: interestColor }}>{fmt(row.interest)}</td>
                  <td className="msat-td msat-num msat-col-net" style={{ color: netColor }}>{fmt(row.netProgress)}</td>
                  <td className={`msat-td msat-num msat-col-end ${isFinal ? 'msat-zero' : 'msat-balance'}`}
                    style={isFinal ? { color: accent } : undefined}
                  >
                    {isFinal ? '$0' : fmt(row.endBalance)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Column legend */}
      <div className="msat-col-legend">
        <span style={{ color: paymentColor }}>● Payment</span>
        <span style={{ color: interestColor }}>● Interest</span>
        <span style={{ color: netColor }}>● Net Progress</span>
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="msat-pagination">
          <button className="msat-pg-btn" onClick={() => setPage(0)} disabled={page === 0}>«</button>
          <button className="msat-pg-btn" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>‹</button>
          <div className="msat-pg-center">
            <span className="msat-pg-num">
              {page + 1}<span className="msat-pg-total"> / {totalPages}</span>
            </span>
            <span className="msat-pg-range">
              Mo {page * ROWS + 1}–{Math.min((page + 1) * ROWS, allRows.length)}
            </span>
          </div>
          <button className="msat-pg-btn" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>›</button>
          <button className="msat-pg-btn" onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}>»</button>
        </div>
      )}

      {/* ── Summary footer ── */}
      <div className="msat-summary">
        <div className="msat-sum-item">
          <span className="msat-sum-lbl">Principal</span>
          <span className="msat-sum-val">{fmt(principal)}</span>
        </div>
        <div className="msat-sum-item">
          <span className="msat-sum-lbl">Total Interest</span>
          <span className="msat-sum-val" style={{ color: interestColor }}>{fmt(totalInterest)}</span>
        </div>
        <div className="msat-sum-item">
          <span className="msat-sum-lbl">Total Paid</span>
          <span className="msat-sum-val" style={{ fontWeight: 700 }}>{fmt(totalPaid)}</span>
        </div>
        <div className="msat-sum-item">
          <span className="msat-sum-lbl">Avg Mo. Interest</span>
          <span className="msat-sum-val" style={{ color: interestColor }}>{fmt(avgMonthlyInterest)}</span>
        </div>
      </div>

    </div>
  );
};
