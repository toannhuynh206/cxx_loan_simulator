import React, { useState, useMemo, useEffect } from 'react';
import { CombinedLoanResult } from '../types/loan';
import { PayoffStrategyType } from '../types/payoffStrategy';
import {
  createLoanSnapshots,
  simulateStrategy,
  compareStrategies,
  formatMonths,
} from '../services/payoffStrategyService';
import { StrategyBalanceChart } from './StrategyBalanceChart';
import { useTheme } from '../context/ThemeContext';

interface Props {
  multiLoanData: CombinedLoanResult;
}

// ── helpers ─────────────────────────────────────────────────────
const fmt = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

function monthsToDate(months: number): string {
  const now = new Date();
  const t = new Date(now.getFullYear(), now.getMonth() + months, 1);
  return t.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function findExtraForTarget(
  snapshots: ReturnType<typeof createLoanSnapshots>,
  sumMinimums: number,
  targetMonths: number
): { totalPayment: number; totalInterest: number } | null {
  const feasibility = simulateStrategy(snapshots, 10_000_000, 'avalanche');
  if (feasibility.totalMonths > targetMonths) return null;
  const totalBalance = snapshots.reduce((s, l) => s + l.balance, 0);
  let lo = 0, hi = Math.ceil(totalBalance) * 2;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    simulateStrategy(snapshots, mid, 'avalanche').totalMonths <= targetMonths ? (hi = mid) : (lo = mid + 1);
  }
  const result = simulateStrategy(snapshots, lo, 'avalanche');
  return { totalPayment: sumMinimums + lo, totalInterest: result.totalInterest };
}

const STRATEGY_META: Record<PayoffStrategyType, { emoji: string; label: string; sub: string }> = {
  avalanche: { emoji: '⛰', label: 'Avalanche', sub: 'Highest rate first' },
  snowball:  { emoji: '❄', label: 'Snowball',  sub: 'Smallest balance first' },
  standard:  { emoji: '⚖', label: 'Standard',  sub: 'Minimums + proportional' },
};

// ── Section wrapper ──────────────────────────────────────────────
const Section: React.FC<{ title: string; sub?: string; children: React.ReactNode }> = ({ title, sub, children }) => (
  <div className="msim-section">
    <div className="msim-section-head">
      <span className="msim-section-title">{title}</span>
      {sub && <span className="msim-section-sub">{sub}</span>}
    </div>
    {children}
  </div>
);

// ── Main component ───────────────────────────────────────────────
export const MobileSimulateTab: React.FC<Props> = ({ multiLoanData }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const hasMulti = multiLoanData.loans.length > 1;

  // ── Scenario state ──────────────────────────────────────────
  const snapshots = useMemo(() => createLoanSnapshots(multiLoanData), [multiLoanData]);
  const sumMinimums = useMemo(() => snapshots.reduce((s, l) => s + l.minimumPayment, 0), [snapshots]);
  const currentTotal = Math.round(multiLoanData.totalMonthlyPayment);
  const step = currentTotal <= 300 ? 25 : currentTotal <= 600 ? 50 : 100;
  const [centerOffset, setCenterOffset] = useState(0);

  useEffect(() => { setCenterOffset(0); }, [multiLoanData]);

  const centerPayment = currentTotal + centerOffset * step;
  const minPayment = Math.ceil(sumMinimums);
  const canGoDown = centerPayment - 4 * step >= minPayment;

  const scenarioAmounts = useMemo(() => {
    const amounts: number[] = [];
    for (let i = -3; i <= 3; i++) {
      const a = centerPayment + i * step;
      if (a > 0) amounts.push(a);
    }
    return amounts;
  }, [centerPayment, step]);

  const scenarios = useMemo(() =>
    scenarioAmounts.map(payment => {
      const extra = Math.max(0, payment - sumMinimums);
      const result = simulateStrategy(snapshots, extra, 'avalanche');
      return { payment, months: result.totalMonths, totalInterest: result.totalInterest };
    }),
    [scenarioAmounts, snapshots, sumMinimums]
  );

  // Normalize interest for bar widths
  const maxInterest = Math.max(...scenarios.map(s => s.totalInterest), 1);
  const minInterest = Math.min(...scenarios.map(s => s.totalInterest));

  // ── Goal timeline ───────────────────────────────────────────
  const targetTimelines = useMemo(() =>
    [2, 3, 4, 5].map(years => {
      const found = findExtraForTarget(snapshots, sumMinimums, years * 12);
      return { years, ...found };
    }),
    [snapshots, sumMinimums]
  );

  // ── Strategy state (multi-loan only) ────────────────────────
  const [extraPayment, setExtraPayment] = useState(0);
  const [selectedStrategy, setSelectedStrategy] = useState<PayoffStrategyType>('avalanche');

  const comparison = useMemo(() =>
    hasMulti ? compareStrategies(multiLoanData, extraPayment) : null,
    [multiLoanData, extraPayment, hasMulti]
  );
  const selectedResult = comparison?.strategies[selectedStrategy];

  const configuredBudget = Math.round(multiLoanData.totalMonthlyPayment);
  const quickAmounts = Array.from(new Set([50, 100, 200, Math.round(configuredBudget * 0.25)])).sort((a, b) => a - b);

  // ── Theme tokens ────────────────────────────────────────────
  const accent = isDark ? '#2dd4bf' : '#0d9488';
  const interestColor = isDark ? '#f87171' : '#dc2626';
  const savingsColor = isDark ? '#34d399' : '#059669';

  // ── Allocation data ─────────────────────────────────────────
  const allocationData = useMemo(() => {
    if (!selectedResult || !hasMulti) return [];
    const firstMonth = selectedResult.monthlyEvents[0];
    const totalPmt = firstMonth?.totalPayment || 0;
    return selectedResult.payoffOrder.map(item => {
      const loan = multiLoanData.loans.find(l => l.loanId === item.loanId);
      const evt = firstMonth?.loans.find(l => l.loanId === item.loanId);
      const pmt = evt?.payment ?? 0;
      return {
        id: item.loanId,
        name: loan?.loanName || 'Loan',
        principal: loan?.principal ?? 0,
        apr: loan?.apr ?? 0,
        payment: pmt,
        pct: totalPmt > 0 ? (pmt / totalPmt) * 100 : 0,
        payoffMonth: item.payoffMonth,
        interest: item.totalInterestPaid,
      };
    }).sort((a, b) => b.payment - a.payment);
  }, [selectedResult, multiLoanData, hasMulti]);

  return (
    <div className="msim-root">

      {/* ══ Section 1: What If Scenarios ══ */}
      <Section
        title="What If I Pay More?"
        sub={`${snapshots.length} loan${snapshots.length !== 1 ? 's' : ''} · avalanche strategy`}
      >
        <div className="msim-scenario-nav">
          <button
            className="msim-nav-btn"
            onClick={() => setCenterOffset(p => p - 1)}
            disabled={!canGoDown}
            aria-label="Lower payments"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            Lower
          </button>
          <span className="msim-nav-hint">Scroll through payment amounts</span>
          <button
            className="msim-nav-btn"
            onClick={() => setCenterOffset(p => p + 1)}
            aria-label="Higher payments"
          >
            Higher
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" /></svg>
          </button>
        </div>

        {/* Column headers */}
        <div className="msim-col-headers">
          <span>Monthly Payment</span>
          <span>Paid Off By</span>
          <span>Total Interest</span>
        </div>

        <div className="msim-scenario-list">
          {scenarios.map(({ payment, months, totalInterest }) => {
            const isCurrent = payment === currentTotal;
            const isMin = Math.abs(payment - minPayment) < step / 2;
            const barPct = maxInterest > minInterest
              ? ((totalInterest - minInterest) / (maxInterest - minInterest)) * 100
              : 50;

            return (
              <div
                key={payment}
                className={`msim-scenario-row ${isCurrent ? 'msim-scenario-current' : ''}`}
                style={isCurrent ? { borderLeftColor: accent } : undefined}
              >
                <div className="msim-scenario-left">
                  <span className="msim-scenario-amount" style={isCurrent ? { color: accent } : undefined}>
                    {fmt(payment)}
                    <span className="msim-scenario-mo">/mo</span>
                  </span>
                  {isCurrent && !isMin && (
                    <span className="msim-scenario-badge msim-badge-current">current</span>
                  )}
                  {isMin && (
                    <span className="msim-scenario-badge msim-badge-min">min</span>
                  )}
                </div>
                <div className="msim-scenario-right">
                  <div className="msim-scenario-right-cell">
                    <span className="msim-val-label">Debt-free by</span>
                    <span className="msim-scenario-date">{monthsToDate(months)}</span>
                  </div>
                  <div className="msim-scenario-right-cell">
                    <span className="msim-val-label">Total interest</span>
                    <span className="msim-scenario-interest" style={{ color: interestColor }}>
                      {fmt(totalInterest)}
                    </span>
                  </div>
                </div>
                {/* Relative interest bar */}
                <div className="msim-scenario-bar-wrap">
                  <div
                    className="msim-scenario-bar"
                    style={{
                      width: `${barPct}%`,
                      background: isCurrent ? accent : interestColor,
                      opacity: isCurrent ? 0.6 : 0.35,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="msim-scenario-legend">
          <span>← Less interest paid</span>
          <span>More interest paid →</span>
        </div>
      </Section>

      {/* ══ Section 2: Payoff Goals ══ */}
      <Section title="Payoff Goals" sub="Required monthly payment to hit each target">
        {/* Column headers */}
        <div className="msim-col-headers msim-col-headers-goal">
          <span>Target</span>
          <span>Payment Needed</span>
          <span>Interest Cost</span>
          <span>vs. Now</span>
        </div>
        <div className="msim-goal-list">
          {targetTimelines.map(({ years, totalPayment, totalInterest }) => {
            const achievable = totalPayment != null;
            return (
              <div key={years} className={`msim-goal-row ${!achievable ? 'msim-goal-na' : ''}`}>
                <div className="msim-goal-years">
                  <span className="msim-goal-num">{years}</span>
                  <span className="msim-goal-label">yr</span>
                </div>
                <div className="msim-goal-divider" />
                <div className="msim-goal-details">
                  {achievable ? (
                    <>
                      <span className="msim-goal-payment" style={{ color: accent }}>
                        {fmt(totalPayment!)}<span className="msim-goal-mo">/mo needed</span>
                      </span>
                      <span className="msim-goal-interest" style={{ color: interestColor }}>
                        {fmt(totalInterest!)} total interest
                      </span>
                    </>
                  ) : (
                    <span className="msim-goal-na-text">Not achievable</span>
                  )}
                </div>
                {achievable && (
                  <div className="msim-goal-vs">
                    {totalPayment! > currentTotal ? (
                      <>
                        <span className="msim-goal-delta-label">extra needed</span>
                        <span className="msim-goal-delta" style={{ color: interestColor }}>
                          +{fmt(totalPayment! - currentTotal)}/mo
                        </span>
                      </>
                    ) : totalPayment! < currentTotal ? (
                      <>
                        <span className="msim-goal-delta-label">can reduce by</span>
                        <span className="msim-goal-delta" style={{ color: savingsColor }}>
                          −{fmt(currentTotal - totalPayment!)}/mo
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="msim-goal-delta-label">no change</span>
                        <span className="msim-goal-delta" style={{ color: accent }}>on track</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      {/* ══ Multi-loan sections ══ */}
      {hasMulti && comparison && selectedResult && (
        <>
          {/* ── Extra Payment ── */}
          <Section title="Extra Monthly Budget" sub={`Above your $${configuredBudget.toLocaleString()}/mo`}>
            <div className="msim-extra-wrap">
              <div className="msim-extra-input-row">
                <span className="msim-extra-prefix">$</span>
                <input
                  className="msim-extra-input"
                  type="number"
                  min="0"
                  step="10"
                  value={extraPayment || ''}
                  onChange={e => setExtraPayment(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder="0"
                />
                {extraPayment > 0 && (
                  <button className="msim-extra-clear" onClick={() => setExtraPayment(0)}>✕</button>
                )}
              </div>
              <div className="msim-quick-pills">
                {quickAmounts.map(a => (
                  <button
                    key={a}
                    className={`msim-quick-pill ${extraPayment === a ? 'active' : ''}`}
                    style={extraPayment === a ? { borderColor: accent, color: accent } : undefined}
                    onClick={() => setExtraPayment(extraPayment === a ? 0 : a)}
                  >
                    +${a}
                  </button>
                ))}
              </div>
              {extraPayment > 0 && (
                <p className="msim-extra-total">
                  Total: <strong style={{ color: accent }}>{fmt(configuredBudget + extraPayment)}/mo</strong>
                </p>
              )}
            </div>
          </Section>

          {/* ── Strategy Cards ── */}
          <Section
            title="Strategy Comparison"
            sub={extraPayment > 0 ? `+${fmt(extraPayment)}/mo extra` : undefined}
          >
            <div className="msim-strategy-cards">
              {(['avalanche', 'snowball', 'standard'] as PayoffStrategyType[]).map(strategy => {
                const result = comparison.strategies[strategy];
                const meta = STRATEGY_META[strategy];
                const isSelected = strategy === selectedStrategy;
                const isBest = strategy === (['avalanche', 'snowball', 'standard'] as PayoffStrategyType[]).reduce((best, s) =>
                  comparison.strategies[s].totalInterest < comparison.strategies[best].totalInterest ? s : best
                );
                return (
                  <button
                    key={strategy}
                    className={`msim-strategy-card ${isSelected ? 'active' : ''}`}
                    style={isSelected ? { borderColor: accent, background: isDark ? `${accent}14` : `${accent}10` } : undefined}
                    onClick={() => setSelectedStrategy(strategy)}
                  >
                    {isBest && extraPayment > 0 && (
                      <span className="msim-best-badge" style={{ background: savingsColor }}>Best</span>
                    )}
                    <span className="msim-strat-emoji">{meta.emoji}</span>
                    <span className="msim-strat-name" style={isSelected ? { color: accent } : undefined}>
                      {meta.label}
                    </span>
                    <span className="msim-strat-sub">{meta.sub}</span>
                    <div className="msim-strat-divider" />
                    <span className="msim-strat-metric-label">Total Interest</span>
                    <span className="msim-strat-interest" style={{ color: interestColor }}>
                      {fmt(result.totalInterest)}
                    </span>
                    <span className="msim-strat-metric-label" style={{ marginTop: 4 }}>Time to Payoff</span>
                    <span className="msim-strat-time">{formatMonths(result.totalMonths)}</span>
                    {result.interestSaved > 0 && (
                      <>
                        <span className="msim-strat-metric-label" style={{ marginTop: 4 }}>You Save</span>
                        <span className="msim-strat-saved" style={{ color: savingsColor }}>
                          {fmt(result.interestSaved)}
                        </span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </Section>

          {/* ── Balance Chart ── */}
          <Section title="Balance Over Time">
            <div className="msim-chart-wrap">
              <StrategyBalanceChart
                result={selectedResult}
                selectedStrategy={selectedStrategy}
                originalLoans={multiLoanData.loans}
              />
            </div>
          </Section>

          {/* ── Payoff Allocation ── */}
          <Section
            title="Payment Allocation"
            sub={`${fmt(selectedResult.monthlyEvents[0]?.totalPayment || 0)}/mo distributed`}
          >
            <div className="msim-alloc-list">
              {allocationData.map((loan, idx) => (
                <div key={loan.id} className="msim-alloc-row">
                  <div className="msim-alloc-rank">
                    <span className="msim-alloc-num">{idx + 1}</span>
                  </div>
                  <div className="msim-alloc-body">
                    <div className="msim-alloc-header">
                      <span className="msim-alloc-name">{loan.name}</span>
                      <span className="msim-alloc-pmt" style={{ color: accent }}>{fmt(loan.payment)}/mo</span>
                    </div>
                    <div className="msim-alloc-meta">
                      <span>{fmt(loan.principal)} @ {loan.apr.toFixed(2)}%</span>
                      <span style={{ color: interestColor }}>{fmt(loan.interest)} interest</span>
                    </div>
                    <div className="msim-alloc-bar-track">
                      <div
                        className="msim-alloc-bar-fill"
                        style={{ width: `${Math.min(loan.pct, 100)}%`, background: accent }}
                      />
                    </div>
                    <div className="msim-alloc-footer">
                      <span>{loan.pct.toFixed(0)}% of payment</span>
                      <span>Paid off {formatMonths(loan.payoffMonth)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="msim-alloc-summary">
              <div className="msim-alloc-sum-item">
                <span className="msim-alloc-sum-label">Debt Free In</span>
                <span className="msim-alloc-sum-val" style={{ color: accent }}>
                  {formatMonths(selectedResult.totalMonths)}
                </span>
              </div>
              <div className="msim-alloc-sum-item">
                <span className="msim-alloc-sum-label">Total Interest</span>
                <span className="msim-alloc-sum-val" style={{ color: interestColor }}>
                  {fmt(selectedResult.totalInterest)}
                </span>
              </div>
              <div className="msim-alloc-sum-item">
                <span className="msim-alloc-sum-label">Total Paid</span>
                <span className="msim-alloc-sum-val">{fmt(selectedResult.totalPaid)}</span>
              </div>
            </div>
          </Section>
        </>
      )}

    </div>
  );
};
