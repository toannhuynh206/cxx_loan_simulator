import React, { useMemo } from 'react';
import {
  ComposedChart, Area, Line,
  XAxis, YAxis,
  Tooltip, CartesianGrid, ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { LoanResponse, CombinedLoanResult } from '../types/loan';
import { useTheme } from '../context/ThemeContext';

const LOAN_COLORS = [
  '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899',
  '#14b8a6', '#f97316', '#06b6d4', '#84cc16',
];

interface Props {
  data: LoanResponse;
  multiLoanData: CombinedLoanResult | null;
}

const fmtFull = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

const fmtK = (v: number) => {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};

export const MobileBalanceView: React.FC<Props> = ({ data, multiLoanData }) => {
  const { theme } = useTheme();
  const hasMulti = !!multiLoanData && multiLoanData.loans.length > 1;

  const c = useMemo(() => ({
    accent:       theme === 'dark' ? '#2dd4bf' : '#0d9488',
    interest:     theme === 'dark' ? '#f87171' : '#dc2626',
    interestFill: theme === 'dark' ? 'rgba(248,113,113,0.12)' : 'rgba(220,38,38,0.08)',
    text:         theme === 'dark' ? '#a8a29e' : '#78716c',
    grid:         theme === 'dark' ? '#292524' : '#e7e5e4',
    crossover:    theme === 'dark' ? 'rgba(251,191,36,0.55)' : 'rgba(217,119,6,0.45)',
    tipBg:        theme === 'dark' ? 'rgba(28,25,23,0.92)' : 'rgba(255,255,255,0.95)',
    tipBorder:    theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    activeDot:    theme === 'dark' ? '#1c1917' : '#ffffff',
  }), [theme]);

  // ── Total / combined balance + cumulative interest ──────────
  const totalChartData = useMemo(() => {
    const pts: { month: number; balance: number; cumulativeInterest: number }[] = [
      { month: 0, balance: data.principal, cumulativeInterest: 0 },
    ];
    let cumInt = 0;
    for (const e of data.events) {
      cumInt += e.interest;
      pts.push({
        month: e.month,
        balance: Math.max(0, e.endBalance),
        cumulativeInterest: cumInt,
      });
    }
    return pts;
  }, [data]);

  // Find crossover month (where cumulativeInterest >= equity gained)
  const crossoverMonth = useMemo(() => {
    for (const pt of totalChartData) {
      const equityGained = data.principal - pt.balance;
      if (pt.cumulativeInterest >= equityGained && pt.month > 0) return pt.month;
    }
    return null;
  }, [totalChartData, data.principal]);

  // ── Per-loan lines ─────────────────────────────────────────
  const perLoanChartData = useMemo(() => {
    if (!multiLoanData) return [];
    const init: Record<string, number> = { month: 0 };
    multiLoanData.loans.forEach(l => { init[l.loanId] = l.principal; });
    const pts: Record<string, number>[] = [init];
    for (let m = 1; m <= multiLoanData.totalMonths; m++) {
      const pt: Record<string, number> = { month: m };
      multiLoanData.loans.forEach(l => {
        const ev = l.events.find(e => e.month === m);
        pt[l.loanId] = ev ? Math.max(0, ev.endBalance) : 0;
      });
      pts.push(pt);
    }
    return pts;
  }, [multiLoanData]);

  // ── X-axis ticks ───────────────────────────────────────────
  const xTicks = useMemo(() => {
    const ticks: number[] = [0];
    const step = data.totalMonths > 60 ? 12 : data.totalMonths > 24 ? 6 : 3;
    for (let m = step; m <= data.totalMonths; m += step) ticks.push(m);
    return ticks;
  }, [data.totalMonths]);

  const tickLabel = (v: number) => {
    if (v === 0) return '';
    const yrs = v / 12;
    return yrs < 1 ? `${v}mo` : Number.isInteger(yrs) ? `${yrs}yr` : '';
  };

  // ── Shared tooltip style ────────────────────────────────────
  const glassTip = {
    background: c.tipBg,
    backdropFilter: 'blur(16px)',
    border: `1px solid ${c.tipBorder}`,
    borderRadius: 12,
    padding: '8px 12px',
    fontSize: '0.8rem',
    boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
  } as React.CSSProperties;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const TotalTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const mo = Number(label);
    const yr = mo / 12;
    const timeStr = mo === 0 ? 'Start' : yr < 1 ? `Month ${mo}` : `Month ${mo} · ${yr.toFixed(1)}yr`;
    const balance = payload.find((p: { dataKey: string }) => p.dataKey === 'balance')?.value ?? 0;
    const interest = payload.find((p: { dataKey: string }) => p.dataKey === 'cumulativeInterest')?.value ?? 0;
    const equityGained = data.principal - balance;
    const pctPaid = Math.min(100, (equityGained / data.principal) * 100);
    return (
      <div style={{ ...glassTip, minWidth: 170 }}>
        <p style={{ fontWeight: 600, color: c.text, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{timeStr}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ color: c.text, fontSize: '0.75rem' }}>Balance</span>
            <span style={{ color: c.accent, fontWeight: 700 }}>{fmtFull(balance)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ color: c.text, fontSize: '0.75rem' }}>Interest paid</span>
            <span style={{ color: c.interest, fontWeight: 700 }}>{fmtFull(interest)}</span>
          </div>
          <div style={{ marginTop: 4, paddingTop: 4, borderTop: `1px solid ${c.tipBorder}`, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ color: c.text, fontSize: '0.75rem' }}>Paid off</span>
            <span style={{ color: c.text, fontWeight: 600 }}>{pctPaid.toFixed(1)}%</span>
          </div>
        </div>
      </div>
    );
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const PerLoanTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const mo = Number(label);
    const yr = mo / 12;
    const timeStr = mo === 0 ? 'Start' : yr < 1 ? `Month ${mo}` : `Month ${mo} · ${yr.toFixed(1)}yr`;
    const active_loans = payload.filter((p: { value: number }) => p.value > 0.01);
    return (
      <div style={{ ...glassTip, minWidth: 150 }}>
        <p style={{ fontWeight: 600, color: c.text, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{timeStr}</p>
        {active_loans.map((p: { name: string; value: number; color: string; dataKey: string }) => (
          <p key={p.dataKey} style={{ color: p.color, margin: '2px 0', fontWeight: 600, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ opacity: 0.85, fontWeight: 500 }}>{p.name}</span>
            <span>{fmtK(p.value)}</span>
          </p>
        ))}
      </div>
    );
  };

  // ── Shared chart props ─────────────────────────────────────
  const xAxisProps = {
    dataKey: 'month' as const,
    ticks: xTicks,
    tickFormatter: tickLabel,
    tick: { fill: c.text, fontSize: 10 },
    axisLine: false as const,
    tickLine: false as const,
  };

  // Y-axis max: whichever is larger — principal or total interest
  const yMax = useMemo(() => {
    const maxInterest = totalChartData[totalChartData.length - 1]?.cumulativeInterest ?? 0;
    return Math.max(data.principal, maxInterest) * 1.05;
  }, [totalChartData, data.principal]);

  return (
    <div className="m-balance-stack">

      {/* ── Chart 1: Total Balance + Cumulative Interest ── */}
      <div className="m-balance-card">
        <div className="m-balance-card-header">
          <span className="m-balance-card-title">Total Balance</span>
          <span className="m-balance-card-sub">{fmtFull(data.principal)} → $0</span>
        </div>

        {/* Legend */}
        <div className="m-balance-legend" style={{ marginBottom: 8 }}>
          <div className="m-balance-pill" style={{ '--pill-color': c.accent } as React.CSSProperties}>
            <span className="m-balance-pill-dot" />
            <span className="m-balance-pill-name">Balance</span>
          </div>
          <div className="m-balance-pill" style={{ '--pill-color': c.interest } as React.CSSProperties}>
            <span className="m-balance-pill-dot" />
            <span className="m-balance-pill-name">Interest paid</span>
          </div>
          {crossoverMonth && (
            <div className="m-balance-pill" style={{ '--pill-color': '#d97706' } as React.CSSProperties}>
              <span className="m-balance-pill-dot" style={{ background: '#d97706' }} />
              <span className="m-balance-pill-name">Crossover Mo {crossoverMonth}</span>
            </div>
          )}
        </div>

        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={totalChartData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="mTotalGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={c.accent} stopOpacity={0.38} />
                <stop offset="45%"  stopColor={c.accent} stopOpacity={0.12} />
                <stop offset="100%" stopColor={c.accent} stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" stroke={c.grid} vertical={false} opacity={0.7} />
            <XAxis {...xAxisProps} />
            <YAxis hide domain={[0, yMax]} />
            <Tooltip content={<TotalTooltip />} />

            {/* Crossover reference line */}
            {crossoverMonth && (
              <ReferenceLine
                x={crossoverMonth}
                stroke={c.crossover}
                strokeDasharray="4 3"
                strokeWidth={1.5}
              />
            )}

            {/* Balance area */}
            <Area
              type="monotone" dataKey="balance" name="Balance"
              stroke={c.accent} strokeWidth={2.5}
              fill="url(#mTotalGrad)"
              dot={false} activeDot={{ r: 5, fill: c.accent, strokeWidth: 0 }}
              isAnimationActive={false}
            />

            {/* Cumulative interest line */}
            <Line
              type="monotone" dataKey="cumulativeInterest" name="Interest paid"
              stroke={c.interest} strokeWidth={2}
              strokeDasharray="5 3"
              dot={false} activeDot={{ r: 5, fill: c.interest, strokeWidth: 0 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>

        {/* Crossover callout */}
        {crossoverMonth && (
          <p className="m-balance-crossover-note">
            ⚠ At month {crossoverMonth} you've paid as much in interest as you've reduced your balance
          </p>
        )}
      </div>

      {/* ── Chart 2: Per Loan (only when multi-loan) ── */}
      {hasMulti && (
        <div className="m-balance-card">
          <div className="m-balance-card-header">
            <span className="m-balance-card-title">Per Loan</span>
          </div>

          {/* Pill legend */}
          <div className="m-balance-legend">
            {multiLoanData!.loans.map((loan, i) => (
              <div key={loan.loanId} className="m-balance-pill"
                style={{ '--pill-color': LOAN_COLORS[i % LOAN_COLORS.length] } as React.CSSProperties}>
                <span className="m-balance-pill-dot" />
                <span className="m-balance-pill-name">{loan.loanName}</span>
                <span className="m-balance-pill-dur">{loan.totalMonths}mo</span>
              </div>
            ))}
          </div>

          <ResponsiveContainer width="100%" height={180}>
            <ComposedChart data={perLoanChartData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
              <defs>
                {multiLoanData!.loans.map((loan, i) => {
                  const color = LOAN_COLORS[i % LOAN_COLORS.length];
                  return (
                    <linearGradient key={`mPlg-${loan.loanId}`} id={`mPlg-${loan.loanId}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor={color} stopOpacity={0.32} />
                      <stop offset="45%"  stopColor={color} stopOpacity={0.10} />
                      <stop offset="100%" stopColor={color} stopOpacity={0.01} />
                    </linearGradient>
                  );
                })}
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke={c.grid} vertical={false} opacity={0.7} />
              <XAxis {...xAxisProps} />
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip content={<PerLoanTooltip />} />
              {multiLoanData!.loans.map((loan, i) => (
                <Area key={loan.loanId} type="monotone" dataKey={loan.loanId}
                  name={loan.loanName}
                  stroke={LOAN_COLORS[i % LOAN_COLORS.length]}
                  fill={`url(#mPlg-${loan.loanId})`}
                  strokeWidth={2.5} dot={false}
                  activeDot={{ r: 5, fill: LOAN_COLORS[i % LOAN_COLORS.length], stroke: c.activeDot, strokeWidth: 2 }}
                  isAnimationActive={false} connectNulls />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

    </div>
  );
};
