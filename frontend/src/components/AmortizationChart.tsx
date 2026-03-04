import React, { useMemo, useState, useEffect } from 'react';
import {
  ComposedChart,
  Line,
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

interface ChartDataPoint {
  month: number;
  balance: number;
  green: number | null;
  red: number | null;
  eventMonth: number;
  pointType: 'principal' | 'after_interest' | 'after_payment';
  cumulativeInterest: number;
  cumulativePrincipalPaid: number;
  payoffPercent: number;
}

interface Milestone {
  percent: number;
  month: number;
  label: string;
}

export const AmortizationChart: React.FC<AmortizationChartProps> = ({ data, multiLoanData, viewMode, onViewModeChange }) => {
  const { theme } = useTheme();
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 480;
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

  const chartData = useMemo(() => {
    const points: ChartDataPoint[] = [];
    let cumulativeInterest = 0;
    let cumulativePrincipalPaid = 0;
    if (data.events.length > 0) {
      points.push({
        month: 0, balance: data.events[0].startBalance,
        green: null, red: data.events[0].startBalance, eventMonth: 0,
        pointType: 'principal', cumulativeInterest: 0, cumulativePrincipalPaid: 0, payoffPercent: 0,
      });
    }
    data.events.forEach((event) => {
      const balanceAfterInterest = event.startBalance + event.interest;
      const monthPosition = event.month - 1;
      cumulativeInterest += event.interest;
      cumulativePrincipalPaid += event.principalPaid ?? Math.max(0, event.payment - event.interest);
      const payoffPercent = ((data.principal - event.endBalance) / data.principal) * 100;
      points.push({
        month: monthPosition + 0.5, balance: balanceAfterInterest,
        green: balanceAfterInterest, red: balanceAfterInterest, eventMonth: event.month,
        pointType: 'after_interest', cumulativeInterest, cumulativePrincipalPaid, payoffPercent,
      });
      points.push({
        month: monthPosition + 0.501, balance: balanceAfterInterest,
        green: balanceAfterInterest, red: null, eventMonth: event.month,
        pointType: 'after_interest', cumulativeInterest, cumulativePrincipalPaid, payoffPercent,
      });
      points.push({
        month: event.month, balance: event.endBalance,
        green: event.endBalance, red: event.endBalance, eventMonth: event.month,
        pointType: 'after_payment', cumulativeInterest, cumulativePrincipalPaid, payoffPercent,
      });
      points.push({
        month: event.month + 0.001, balance: event.endBalance,
        green: null, red: event.endBalance, eventMonth: event.month,
        pointType: 'after_payment', cumulativeInterest, cumulativePrincipalPaid, payoffPercent,
      });
    });
    return points;
  }, [data]);

  const displayedChartData = useMemo(() => {
    if (!isSimulating && animationMonth >= totalMonths) return chartData;
    return chartData.filter((point) => point.month <= animationMonth);
  }, [chartData, animationMonth, isSimulating, totalMonths]);

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
    payload?: Array<{ payload: ChartDataPoint }>;
  }

  const CombinedTooltip: React.FC<CombinedTooltipProps> = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const point = payload[0].payload;
    if (point.pointType === 'principal') {
      return (
        <div className="custom-tooltip">
          <p><strong>Month 0</strong></p>
          <p style={{ fontSize: '1.1rem', fontWeight: 700, color: colors.accent }}>
            Balance: {formatCurrencyFull(point.balance)}
          </p>
          <p style={{ fontSize: '0.85rem' }}>Starting Principal</p>
          <hr />
          <p style={{ color: colors.accent, fontWeight: 600 }}>Paid Off: 0%</p>
        </div>
      );
    }
    const event = data.events.find(e => e.month === point.eventMonth);
    if (!event) return null;
    const balanceAfterInterest = event.startBalance + event.interest;
    const isAfterInterest = point.pointType === 'after_interest';
    const principalPaid = event.principalPaid ?? Math.max(0, event.payment - event.interest);
    return (
      <div className="custom-tooltip">
        <p><strong>Month {event.month}</strong></p>
        <p style={{ fontSize: '1.1rem', fontWeight: 700, color: isAfterInterest ? colors.interest : colors.payment }}>
          Balance: {formatCurrencyFull(point.balance)}
        </p>
        <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
          {isAfterInterest ? 'After Interest' : 'After Payment'}
        </p>
        <hr />
        <p>Start: {formatCurrencyFull(event.startBalance)}</p>
        <p style={{ color: colors.interest }}>+ Interest: {formatCurrencyFull(event.interest)}</p>
        <p style={{ color: colors.interest }}>= {formatCurrencyFull(balanceAfterInterest)}</p>
        <p style={{ color: colors.payment }}>- Payment: {formatCurrencyFull(event.payment)}</p>
        <p><strong>End: {formatCurrencyFull(event.endBalance)}</strong></p>
        <hr />
        <p style={{ color: colors.accent, fontWeight: 600 }}>
          Principal Paid: {formatCurrencyFull(principalPaid)}
        </p>
        <p style={{ color: colors.accent, fontWeight: 600, marginTop: '0.5rem' }}>
          Paid Off: {point.payoffPercent.toFixed(1)}%
        </p>
        {showCumulativeInterest && (
          <p style={{ color: colors.cumulative, marginTop: '0.5rem' }}>
            Total Interest Paid: {formatCurrencyFull(point.cumulativeInterest)}
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
  const visibleEvents = data.events.filter(e => e.month >= windowStart && e.month <= windowEnd + 1);
  const eventsForCalc = visibleEvents.length > 0 ? visibleEvents : data.events;
  const maxBalance = Math.max(...eventsForCalc.map(e => e.startBalance + e.interest));
  const minBalance = Math.min(...eventsForCalc.map(e => e.endBalance));
  const dataRange = maxBalance - minBalance;
  const padding = dataRange * 0.2;
  let yMin = minBalance - padding;
  let yMax = maxBalance + padding;
  if (yMin < 0) yMin = 0;
  const step = Math.pow(10, Math.floor(Math.log10(dataRange / 4 || 1)));
  yMin = Math.floor(yMin / step) * step;
  yMax = Math.ceil(yMax / step) * step;
  const yBounds = { min: yMin, max: yMax };

  const xTicks: number[] = [];
  const tickStep = windowSize <= 12 ? 1 : windowSize <= 24 ? 2 : windowSize <= 48 ? 6 : 12;
  for (let i = Math.ceil(windowStart / tickStep) * tickStep; i <= windowEnd; i += tickStep) {
    if (i >= windowStart && i <= windowEnd) xTicks.push(i);
  }

  const panLeft = () => setWindowStart(Math.max(0, windowStart - Math.max(1, Math.floor(windowSize / 4))));
  const panRight = () => setWindowStart(Math.min(totalMonths - windowSize, windowStart + Math.max(1, Math.floor(windowSize / 4))));
  const canPanLeft = windowStart > 0;
  const canPanRight = windowStart + windowSize < totalMonths;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderDot = (props: any): React.ReactElement<SVGElement> => {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null || !payload) return <g />;
    const monthDecimal = payload.month % 1;
    const isMainPoint = monthDecimal === 0 || monthDecimal === 0.5;
    if (!isMainPoint) return <g />;
    let fill = colors.accent;
    if (payload.pointType === 'after_interest') fill = colors.interest;
    else if (payload.pointType === 'after_payment') fill = colors.payment;
    return (
      <circle key={`dot-${payload.month}`} cx={cx} cy={cy} r={6}
        fill={fill} stroke={colors.tooltipBg} strokeWidth={2} style={{ cursor: 'pointer' }} />
    );
  };

  // ── SHARED AXIS PROPS ───────────────────────────────────────
  const sharedXAxis = (
    <XAxis
      dataKey="month" type="number"
      domain={[windowStart, windowEnd]}
      ticks={xTicks}
      tickFormatter={(v) => `${Math.round(v)}`}
      axisLine={{ stroke: colors.axis, strokeWidth: 1 }}
      tickLine={{ stroke: colors.axis }}
      tick={{ fill: colors.text, fontSize: isMobile ? 10 : 12 }}
      label={isMobile ? undefined : { value: 'Month', position: 'bottom', offset: 10, fill: colors.text, fontSize: 14 }}
      allowDataOverflow
    />
  );

  const sharedYAxis = (domain: [number, number]) => (
    <YAxis
      domain={domain}
      tickFormatter={isMobile ? formatCurrencyMobile : formatCurrency}
      axisLine={{ stroke: colors.axis, strokeWidth: 1 }}
      tickLine={{ stroke: colors.axis }}
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

          <button className="fullscreen-btn" onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Fullscreen'}>
            {isFullscreen ? '✕' : '⛶'}
          </button>
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
            <span className="legend-line green"></span>
            <span>Payment Applied (Down)</span>
          </div>
          <div className="legend-item">
            <span className="legend-line red"></span>
            <span>Interest Accrued (Up)</span>
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

      {/* ── PER-LOAN LEGEND ── */}
      {viewMode === 'per-loan' && multiLoanData && (
        <div className="chart-legend per-loan-legend">
          {multiLoanData.loans.map((loan, i) => (
            <div key={loan.loanId} className="legend-item">
              <span className="legend-dot" style={{ background: LOAN_COLORS[i % LOAN_COLORS.length] }}></span>
              <span>{loan.loanName}</span>
              <span className="legend-payoff" style={{ color: LOAN_COLORS[i % LOAN_COLORS.length] }}>
                {loan.totalMonths}mo
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── CHART AREA ── */}
      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height="100%">

          {/* COMBINED CHART */}
          {viewMode === 'combined' ? (
            <ComposedChart data={displayedChartData} margin={isMobile ? { top: 8, right: 8, left: 0, bottom: 16 } : { top: 20, right: 40, left: 0, bottom: 30 }}>
              {sharedXAxis}
              {sharedYAxis([yBounds.min, yBounds.max])}
              <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} opacity={0.5} />
              <Tooltip content={<CombinedTooltip />} />
              <Line type="linear" dataKey="green" stroke={colors.payment} strokeWidth={3}
                dot={renderDot} activeDot={{ r: 8, stroke: colors.tooltipBg, strokeWidth: 2 }}
                name="Payment" connectNulls={false} isAnimationActive={false} />
              <Line type="linear" dataKey="red" stroke={colors.interest} strokeWidth={3}
                dot={false} activeDot={{ r: 8, fill: colors.interest, stroke: colors.tooltipBg, strokeWidth: 2 }}
                name="Interest" connectNulls={false} isAnimationActive={false} />
              {showCumulativeInterest && (
                <Line type="monotone" dataKey="cumulativeInterest" stroke={colors.cumulative}
                  strokeWidth={3} dot={false} activeDot={{ r: 6, fill: colors.cumulative, stroke: colors.tooltipBg, strokeWidth: 2 }}
                  name="Total Interest Paid" connectNulls isAnimationActive={false} />
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
              {sharedXAxis}
              {sharedYAxis([perLoanYBounds.min, perLoanYBounds.max])}
              <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} opacity={0.5} />
              <Tooltip content={<PerLoanTooltip />} />
              {multiLoanData?.loans.map((loan, i) => (
                <Line
                  key={loan.loanId}
                  type="monotone"
                  dataKey={loan.loanId}
                  name={loan.loanName}
                  stroke={LOAN_COLORS[i % LOAN_COLORS.length]}
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 7, stroke: colors.tooltipBg, strokeWidth: 2 }}
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
