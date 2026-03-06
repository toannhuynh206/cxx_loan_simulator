import React, { useMemo, useState, useEffect } from 'react';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { LoanResponse, CombinedLoanResult } from '../types/loan';
import { useTheme } from '../context/ThemeContext';

// Distinct colors per loan — visible on both dark and light backgrounds
const LOAN_COLORS = [
  '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899',
  '#14b8a6', '#f97316', '#06b6d4', '#84cc16',
];

interface AmortizationChartProps {
  data: LoanResponse;
  multiLoanData?: CombinedLoanResult | null;
  viewMode: 'combined' | 'per-loan';
  onViewModeChange: (mode: 'combined' | 'per-loan') => void;
}

interface SimpleChartPoint {
  month: number;
  balance: number;
  cumulativeInterest: number;
  payoffPercent: number;
}

interface Milestone {
  percent: number;
  month: number;
  label: string;
}

export const AmortizationChart: React.FC<AmortizationChartProps> = ({ data, multiLoanData, viewMode, onViewModeChange }) => {
  const { theme } = useTheme();
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth <= 768
  );

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  const totalMonths = data.totalMonths;
  const hasMultipleLoans = !!multiLoanData && multiLoanData.loans.length > 1;

  const colors = useMemo(() => ({
    payment: theme === 'dark' ? '#34d399' : '#059669',
    interest: theme === 'dark' ? '#f87171' : '#dc2626',
    cumulative: theme === 'dark' ? '#fca5a5' : '#7c2d12',
    text: theme === 'dark' ? '#a8a29e' : '#57534e',
    textPrimary: theme === 'dark' ? '#fafaf9' : '#1c1917',
    grid: theme === 'dark' ? '#292524' : '#e7e5e4',
    axis: theme === 'dark' ? '#44403c' : '#d6d3d1',
    tooltipBg: theme === 'dark' ? '#1c1917' : '#ffffff',
    tooltipBorder: theme === 'dark' ? '#292524' : '#e7e5e4',
    milestone25: '#7dd3fc',
    milestone50: theme === 'dark' ? '#38bdf8' : '#0ea5e9',
    milestone75: theme === 'dark' ? '#0284c7' : '#0369a1',
    accent: theme === 'dark' ? '#2dd4bf' : '#0d9488',
  }), [theme]);

  const [windowSize, setWindowSize] = useState(totalMonths);
  const [windowStart, setWindowStart] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showCumulativeInterest, setShowCumulativeInterest] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);
  const [animationMonth, setAnimationMonth] = useState(totalMonths);

  useEffect(() => {
    setWindowSize(totalMonths);
    setWindowStart(0);
    setAnimationMonth(totalMonths);
    setIsSimulating(false);
  }, [totalMonths]);

  useEffect(() => {
    if (!isSimulating) return;
    const interval = setInterval(() => {
      setAnimationMonth((prev) => {
        if (prev >= totalMonths) { setIsSimulating(false); return totalMonths; }
        return prev + 0.5;
      });
    }, 150);
    return () => clearInterval(interval);
  }, [isSimulating, totalMonths]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) setIsFullscreen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isFullscreen]);

  useEffect(() => {
    document.body.style.overflow = isFullscreen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isFullscreen]);

  const windowEnd = Math.min(windowStart + windowSize, totalMonths);

  // ── COMBINED MODE DATA ──────────────────────────────────────
  const milestones = useMemo((): Milestone[] => {
    const result: Milestone[] = [];
    const targets = [25, 50, 75];
    let targetIndex = 0;
    for (const event of data.events) {
      const paidOffPercent = ((data.principal - event.endBalance) / data.principal) * 100;
      while (targetIndex < targets.length && paidOffPercent >= targets[targetIndex]) {
        result.push({ percent: targets[targetIndex], month: event.month, label: `${targets[targetIndex]}%` });
        targetIndex++;
      }
    }
    return result;
  }, [data]);

  const simpleChartData = useMemo((): SimpleChartPoint[] => {
    const points: SimpleChartPoint[] = [{ month: 0, balance: data.principal, cumulativeInterest: 0, payoffPercent: 0 }];
    let cumInterest = 0;
    for (const event of data.events) {
      cumInterest += event.interest;
      const payoffPercent = ((data.principal - event.endBalance) / data.principal) * 100;
      points.push({ month: event.month, balance: Math.max(0, event.endBalance), cumulativeInterest: cumInterest, payoffPercent });
    }
    return points;
  }, [data]);

  const displayedSimpleData = useMemo(() => {
    if (!isSimulating && animationMonth >= totalMonths) return simpleChartData;
    return simpleChartData.filter(p => p.month <= animationMonth);
  }, [simpleChartData, animationMonth, isSimulating, totalMonths]);

  const displayedMilestones = useMemo(() => {
    if (!isSimulating && animationMonth >= totalMonths) return milestones;
    return milestones.filter((m) => m.month <= animationMonth);
  }, [milestones, animationMonth, isSimulating, totalMonths]);

  // ── PER-LOAN MODE DATA ──────────────────────────────────────
  const perLoanChartData = useMemo(() => {
    if (!multiLoanData) return [];
    const maxMonths = multiLoanData.totalMonths;
    const points: Record<string, number>[] = [];

    const point0: Record<string, number> = { month: 0 };
    for (const loan of multiLoanData.loans) {
      point0[loan.loanId] = loan.principal;
    }
    points.push(point0);

    for (let m = 1; m <= maxMonths; m++) {
      const point: Record<string, number> = { month: m };
      for (const loan of multiLoanData.loans) {
        const event = loan.events.find(e => e.month === m);
        point[loan.loanId] = event ? Math.max(0, event.endBalance) : 0;
      }
      points.push(point);
    }
    return points;
  }, [multiLoanData]);

  const perLoanYBounds = useMemo(() => {
    if (!multiLoanData) return { min: 0, max: 1000 };
    const maxVal = Math.max(...multiLoanData.loans.map(l => l.principal));
    const step = Math.pow(10, Math.floor(Math.log10(maxVal / 4 || 1)));
    return { min: 0, max: Math.ceil(maxVal * 1.05 / step) * step };
  }, [multiLoanData]);

  // ── FORMATTERS ──────────────────────────────────────────────
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

  const formatCurrencyFull = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

  const formatCurrencyMobile = (value: number) => {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  // ── TOOLTIPS ────────────────────────────────────────────────
  interface CombinedTooltipProps {
    active?: boolean;
    payload?: Array<{ payload: SimpleChartPoint }>;
    label?: number;
  }

  const CombinedTooltip: React.FC<CombinedTooltipProps> = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const pt = payload[0].payload;
    const mo = Number(label ?? pt.month);
    const yr = mo / 12;
    const timeStr = mo === 0 ? 'Start' : yr < 1 ? `Month ${mo}` : `Month ${mo} · ${yr.toFixed(1)}yr`;
    const glassBg = theme === 'dark' ? 'rgba(28,25,23,0.92)' : 'rgba(255,255,255,0.95)';
    const glassBorder = theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
    return (
      <div style={{
        background: glassBg,
        backdropFilter: 'blur(16px)',
        border: `1px solid ${glassBorder}`,
        borderRadius: 12,
        padding: '10px 14px',
        fontSize: '0.8rem',
        boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
        minWidth: 160,
      }}>
        <p style={{ fontWeight: 600, color: colors.text, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{timeStr}</p>
        <p style={{ color: colors.accent, fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>{formatCurrencyFull(pt.balance)}</p>
        <p style={{ color: colors.text, marginBottom: showCumulativeInterest ? 4 : 0 }}>
          Paid off: <span style={{ color: colors.payment, fontWeight: 600 }}>{pt.payoffPercent.toFixed(1)}%</span>
        </p>
        {showCumulativeInterest && (
          <p style={{ color: colors.cumulative, fontWeight: 600 }}>
            Interest paid: {formatCurrencyFull(pt.cumulativeInterest)}
          </p>
        )}
      </div>
    );
  };

  interface PerLoanTooltipProps {
    active?: boolean;
    payload?: Array<{ name: string; value: number; color: string }>;
    label?: number;
  }

  const PerLoanTooltip: React.FC<PerLoanTooltipProps> = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const active_loans = payload.filter(p => p.value > 0.01);
    const paid_off = payload.filter(p => p.value <= 0.01);
    return (
      <div className="custom-tooltip">
        <p style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Month {label}</p>
        {active_loans.map(p => (
          <p key={p.name} style={{ color: p.color, margin: '0.2rem 0', display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
            <span>{p.name}</span>
            <span style={{ fontWeight: 600 }}>{formatCurrency(p.value)}</span>
          </p>
        ))}
        {paid_off.length > 0 && (
          <>
            <hr style={{ margin: '0.5rem 0', opacity: 0.3 }} />
            {paid_off.map(p => (
              <p key={p.name} style={{ color: colors.text, margin: '0.2rem 0', fontSize: '0.85rem' }}>
                {p.name} — <span style={{ color: colors.payment }}>Paid off ✓</span>
              </p>
            ))}
          </>
        )}
      </div>
    );
  };

  // ── AXIS + ZOOM ─────────────────────────────────────────────
  const visiblePts = simpleChartData.filter(p => p.month >= windowStart && p.month <= windowEnd);
  const ptsForCalc = visiblePts.length > 0 ? visiblePts : simpleChartData;
  const maxBalance = Math.max(...ptsForCalc.map(p => p.balance), 1);
  const minBalance = Math.min(...ptsForCalc.map(p => p.balance), 0);
  const dataRange = maxBalance - minBalance;
  const step = Math.pow(10, Math.floor(Math.log10(dataRange / 4 || 1)));
  const yBounds = {
    min: Math.max(0, Math.floor((minBalance - dataRange * 0.05) / step) * step),
    max: Math.ceil((maxBalance + dataRange * 0.05) / step) * step,
  };

  const xTicks: number[] = [];
  const tickStep = windowSize <= 12 ? 1 : windowSize <= 24 ? 2 : windowSize <= 48 ? 6 : 12;
  for (let i = Math.ceil(windowStart / tickStep) * tickStep; i <= windowEnd; i += tickStep) {
    if (i >= windowStart && i <= windowEnd) xTicks.push(i);
  }

  const panLeft = () => setWindowStart(Math.max(0, windowStart - Math.max(1, Math.floor(windowSize / 4))));
  const panRight = () => setWindowStart(Math.min(totalMonths - windowSize, windowStart + Math.max(1, Math.floor(windowSize / 4))));
  const canPanLeft = windowStart > 0;
  const canPanRight = windowStart + windowSize < totalMonths;

  // ── SHARED AXIS PROPS ───────────────────────────────────────
  const sharedXAxis = (
    <XAxis
      dataKey="month" type="number"
      domain={[windowStart, windowEnd]}
      ticks={xTicks}
      tickFormatter={(v) => `${Math.round(v)}`}
      axisLine={false}
      tickLine={false}
      tick={{ fill: colors.text, fontSize: isMobile ? 10 : 12 }}
      label={isMobile ? undefined : { value: 'Month', position: 'bottom', offset: 10, fill: colors.text, fontSize: 14 }}
      allowDataOverflow
    />
  );

  const sharedYAxis = (domain: [number, number]) => (
    <YAxis
      domain={domain}
      tickFormatter={isMobile ? formatCurrencyMobile : formatCurrency}
      axisLine={false}
      tickLine={false}
      tick={{ fill: colors.text, fontSize: isMobile ? 10 : 12 }}
      label={isMobile ? undefined : { value: 'Balance', angle: -90, position: 'insideLeft', offset: -45, fill: colors.text, fontSize: 14 }}
      width={isMobile ? 48 : 80}
    />
  );

  // ── RENDER ──────────────────────────────────────────────────
  return (
    <div className={`chart-container ${isFullscreen ? 'chart-fullscreen' : ''}`}>
      <div className="chart-header">
        <div className="chart-title-row">
          <h3>Loan Balance Over Time</h3>
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
        <div className="chart-controls">
          {!isMobile && (
            <div className="window-control">
              <button onClick={panLeft} disabled={!canPanLeft} title="Pan Left">&larr;</button>
              <div className="window-slider">
                <input
                  type="range"
                  min={Math.min(6, totalMonths)}
                  max={totalMonths}
                  step={1}
                  value={windowSize}
                  onChange={e => {
                    const newSize = Number(e.target.value);
                    setWindowSize(newSize);
                    setWindowStart(prev => Math.max(0, Math.min(totalMonths - newSize, prev)));
                  }}
                  title={windowSize >= totalMonths ? 'Showing all months' : `Showing ${windowSize} months`}
                />
                <span className="window-label">
                  {windowSize >= totalMonths ? 'All months' : `${windowSize}mo · ${Math.floor(windowStart) + 1}–${Math.floor(windowEnd)}`}
                </span>
              </div>
              <button onClick={panRight} disabled={!canPanRight} title="Pan Right">&rarr;</button>
            </div>
          )}

          {viewMode === 'combined' && (
            <label className="toggle-option">
              <input type="checkbox" checked={showCumulativeInterest}
                onChange={(e) => setShowCumulativeInterest(e.target.checked)} />
              <span>Total Interest</span>
            </label>
          )}

          {viewMode === 'combined' && (
            <button className="simulate-btn" onClick={() => { setAnimationMonth(0); setIsSimulating(true); }}
              disabled={isSimulating} title="Simulate loan payoff">
              {isSimulating ? '⏳ Simulating...' : '▶ Simulate'}
            </button>
          )}

          {!isMobile && (
            <button className="fullscreen-btn" onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Fullscreen'}>
              {isFullscreen ? '✕' : '⛶'}
            </button>
          )}
        </div>
      </div>

      {/* Simulation progress bar */}
      {isSimulating && viewMode === 'combined' && (
        <div className="simulation-progress">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${(animationMonth / totalMonths) * 100}%` }} />
          </div>
          <span className="progress-text">
            Month {Math.floor(animationMonth)} of {totalMonths} ({((animationMonth / totalMonths) * 100).toFixed(0)}%)
          </span>
        </div>
      )}

      {/* ── COMBINED LEGEND ── */}
      {viewMode === 'combined' && (
        <div className="chart-legend">
          <div className="legend-item">
            <span className="legend-line" style={{ background: colors.accent, opacity: 0.9 }}></span>
            <span>Balance</span>
          </div>
          {showCumulativeInterest && (
            <div className="legend-item">
              <span className="legend-line maroon"></span>
              <span>Total Interest Paid</span>
            </div>
          )}
          <div className="legend-item">
            <span className="legend-line milestone-gradient"></span>
            <span>Payoff Milestones</span>
          </div>
        </div>
      )}

      {/* ── PER-LOAN LEGEND ── compact scrollable pills */}
      {viewMode === 'per-loan' && multiLoanData && (
        <div className="chart-legend-pills">
          {multiLoanData.loans.map((loan, i) => {
            const color = LOAN_COLORS[i % LOAN_COLORS.length];
            return (
              <div key={loan.loanId} className="legend-pill" style={{ '--pill-color': color } as React.CSSProperties}>
                <span className="legend-pill-dot" />
                <span className="legend-pill-name">{loan.loanName}</span>
                <span className="legend-pill-dur">{loan.totalMonths}mo</span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── CHART AREA ── */}
      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height="100%">

          {/* COMBINED CHART */}
          {viewMode === 'combined' ? (
            <ComposedChart data={displayedSimpleData} margin={isMobile ? { top: 8, right: 8, left: 0, bottom: 16 } : { top: 20, right: 40, left: 0, bottom: 30 }}>
              <defs>
                <linearGradient id="combinedBalGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={colors.accent} stopOpacity={0.38} />
                  <stop offset="45%"  stopColor={colors.accent} stopOpacity={0.12} />
                  <stop offset="100%" stopColor={colors.accent} stopOpacity={0.01} />
                </linearGradient>
              </defs>
              {sharedXAxis}
              {sharedYAxis([yBounds.min, yBounds.max])}
              <CartesianGrid strokeDasharray="2 6" stroke={colors.grid} opacity={0.4} vertical={false} />
              <Tooltip content={<CombinedTooltip />} />
              <Area type="monotone" dataKey="balance" name="Balance"
                stroke={colors.accent} strokeWidth={2.5}
                fill="url(#combinedBalGrad)"
                dot={false} activeDot={{ r: 6, fill: colors.accent, stroke: colors.tooltipBg, strokeWidth: 2 }}
                isAnimationActive={false} />
              {showCumulativeInterest && (
                <Line type="monotone" dataKey="cumulativeInterest" stroke={colors.cumulative}
                  strokeWidth={2} strokeDasharray="4 3" dot={false}
                  activeDot={{ r: 5, fill: colors.cumulative, stroke: colors.tooltipBg, strokeWidth: 2 }}
                  name="Total Interest Paid" isAnimationActive={false} />
              )}
              {displayedMilestones.map((milestone) => {
                const milestoneColors: Record<number, string> = {
                  25: colors.milestone25, 50: colors.milestone50, 75: colors.milestone75,
                };
                const color = milestoneColors[milestone.percent] || colors.milestone50;
                return (
                  <ReferenceLine key={`milestone-${milestone.percent}`} x={milestone.month}
                    stroke={color} strokeWidth={2}
                    label={{ value: `${milestone.percent}%`, position: 'top', fill: color, fontSize: 12, fontWeight: 600 }} />
                );
              })}
            </ComposedChart>

          ) : (
            /* PER-LOAN CHART */
            <ComposedChart data={perLoanChartData} margin={isMobile ? { top: 8, right: 8, left: 0, bottom: 16 } : { top: 20, right: 40, left: 0, bottom: 30 }}>
              <defs>
                {multiLoanData?.loans.map((loan, i) => {
                  const color = LOAN_COLORS[i % LOAN_COLORS.length];
                  return (
                    <linearGradient key={`plg-${loan.loanId}`} id={`plg-${loan.loanId}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={0.30} />
                      <stop offset="45%" stopColor={color} stopOpacity={0.09} />
                      <stop offset="100%" stopColor={color} stopOpacity={0.01} />
                    </linearGradient>
                  );
                })}
              </defs>
              {sharedXAxis}
              {sharedYAxis([perLoanYBounds.min, perLoanYBounds.max])}
              <CartesianGrid strokeDasharray="2 6" stroke={colors.grid} opacity={0.4} />
              <Tooltip content={<PerLoanTooltip />} />
              {multiLoanData?.loans.map((loan, i) => (
                <Area
                  key={loan.loanId}
                  type="monotone"
                  dataKey={loan.loanId}
                  name={loan.loanName}
                  stroke={LOAN_COLORS[i % LOAN_COLORS.length]}
                  fill={`url(#plg-${loan.loanId})`}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 6, stroke: colors.tooltipBg, strokeWidth: 2 }}
                  isAnimationActive={false}
                  connectNulls
                />
              ))}
            </ComposedChart>
          )}

        </ResponsiveContainer>
      </div>
    </div>
  );
};
