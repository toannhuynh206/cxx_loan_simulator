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
import { LoanResponse } from '../types/loan';
import { useTheme } from '../context/ThemeContext';

interface AmortizationChartProps {
  data: LoanResponse;
}

interface ChartDataPoint {
  month: number;
  balance: number;
  green: number | null;  // For green line segments (going down - payment)
  red: number | null;    // For red line segments (going up - interest)
  eventMonth: number;
  pointType: 'principal' | 'after_payment' | 'after_interest';
  cumulativeInterest: number;
  cumulativePrincipalPaid: number;
  payoffPercent: number;
}

interface Milestone {
  percent: number;
  month: number;
  label: string;
}

export const AmortizationChart: React.FC<AmortizationChartProps> = ({ data }) => {
  const { theme } = useTheme();
  const totalMonths = data.totalMonths;

  // Theme-aware colors
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

  // Window size and position for zoom/pan (X-axis)
  const [windowSize, setWindowSize] = useState(totalMonths);
  const [windowStart, setWindowStart] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showCumulativeInterest, setShowCumulativeInterest] = useState(true);

  // Simulation state
  const [isSimulating, setIsSimulating] = useState(false);
  const [animationMonth, setAnimationMonth] = useState(totalMonths); // Start with full graph

  // Reset window when data changes
  useEffect(() => {
    setWindowSize(totalMonths);
    setWindowStart(0);
    setAnimationMonth(totalMonths); // Show full graph
    setIsSimulating(false);
  }, [totalMonths]);

  // Simulation animation effect
  useEffect(() => {
    if (!isSimulating) return;

    const interval = setInterval(() => {
      setAnimationMonth((prev) => {
        if (prev >= totalMonths) {
          setIsSimulating(false);
          return totalMonths;
        }
        return prev + 0.5; // Increment by 0.5 to show both payment and interest points
      });
    }, 150); // Fixed speed

    return () => clearInterval(interval);
  }, [isSimulating, totalMonths]);

  const startSimulation = () => {
    setAnimationMonth(0);
    setIsSimulating(true);
  };

  // Handle escape key to exit fullscreen
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isFullscreen]);

  // Prevent body scroll when fullscreen
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isFullscreen]);

  const windowEnd = Math.min(windowStart + windowSize, totalMonths);

  // Calculate milestone months based on balance reduction
  // 25% paid off = balance is 75% of original, etc.
  const milestones = useMemo((): Milestone[] => {
    const result: Milestone[] = [];
    const targets = [25, 50, 75];
    let targetIndex = 0;

    for (const event of data.events) {
      // Calculate how much of the loan has been paid off based on remaining balance
      const paidOffPercent = ((data.principal - event.endBalance) / data.principal) * 100;

      while (targetIndex < targets.length && paidOffPercent >= targets[targetIndex]) {
        result.push({ percent: targets[targetIndex], month: event.month, label: `${targets[targetIndex]}%` });
        targetIndex++;
      }
    }

    return result;
  }, [data]);

  // Create data points with separate green/red values for colored line segments:
  // - Green line: goes DOWN (payment applied) - from start/after-interest to after-payment
  // - Red line: goes UP (interest added) - from after-payment to after-interest
  // We use small offsets to break lines at transition points
  const chartData = useMemo(() => {
    const points: ChartDataPoint[] = [];
    let cumulativeInterest = 0;
    let cumulativePrincipalPaid = 0;

    // Month 0: Just the principal - start of green line
    if (data.events.length > 0) {
      points.push({
        month: 0,
        balance: data.events[0].startBalance,
        green: data.events[0].startBalance,
        red: null,
        eventMonth: 0,
        pointType: 'principal',
        cumulativeInterest: 0,
        cumulativePrincipalPaid: 0,
        payoffPercent: 0,
      });
    }

    data.events.forEach((event) => {
      const balanceAfterPayment = event.startBalance - event.payment;
      const monthPosition = event.month - 1;
      cumulativePrincipalPaid += event.payment;
      // Payoff percent based on balance reduction
      const payoffPercent = ((data.principal - event.endBalance) / data.principal) * 100;

      // After payment (trough) - green ends here, red starts here
      points.push({
        month: monthPosition + 0.5,
        balance: balanceAfterPayment,
        green: balanceAfterPayment,
        red: balanceAfterPayment,
        eventMonth: event.month,
        pointType: 'after_payment',
        cumulativeInterest: cumulativeInterest,
        cumulativePrincipalPaid,
        payoffPercent,
      });

      // Break green line (tiny offset after trough) - only red continues
      points.push({
        month: monthPosition + 0.501,
        balance: balanceAfterPayment,
        green: null,
        red: balanceAfterPayment,
        eventMonth: event.month,
        pointType: 'after_payment',
        cumulativeInterest: cumulativeInterest,
        cumulativePrincipalPaid,
        payoffPercent,
      });

      cumulativeInterest += event.interest;

      // After interest (end of month) - red ends here, green starts for next
      points.push({
        month: event.month,
        balance: event.endBalance,
        green: event.endBalance,
        red: event.endBalance,
        eventMonth: event.month,
        pointType: 'after_interest',
        cumulativeInterest: cumulativeInterest,
        cumulativePrincipalPaid,
        payoffPercent,
      });

      // Break red line (tiny offset after end) - only green continues to next payment
      points.push({
        month: event.month + 0.001,
        balance: event.endBalance,
        green: event.endBalance,
        red: null,
        eventMonth: event.month,
        pointType: 'after_interest',
        cumulativeInterest: cumulativeInterest,
        cumulativePrincipalPaid,
        payoffPercent,
      });
    });

    return points;
  }, [data]);

  // Filter chart data based on animation progress
  const displayedChartData = useMemo(() => {
    if (!isSimulating && animationMonth >= totalMonths) {
      return chartData; // Show all data when not simulating
    }
    return chartData.filter((point) => point.month <= animationMonth);
  }, [chartData, animationMonth, isSimulating, totalMonths]);

  // Filter milestones based on animation progress
  const displayedMilestones = useMemo(() => {
    if (!isSimulating && animationMonth >= totalMonths) {
      return milestones;
    }
    return milestones.filter((m) => m.month <= animationMonth);
  }, [milestones, animationMonth, isSimulating, totalMonths]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  interface CustomTooltipProps {
    active?: boolean;
    payload?: Array<{ payload: ChartDataPoint }>;
  }

  const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const point = payload[0].payload;

      // Handle month 0 (principal only)
      if (point.pointType === 'principal') {
        return (
          <div className="custom-tooltip">
            <p><strong>Month 0</strong></p>
            <p style={{ fontSize: '1.1rem', fontWeight: 700, color: colors.accent }}>
              Balance: {formatCurrency(point.balance)}
            </p>
            <p style={{ fontSize: '0.85rem' }}>Starting Principal</p>
            <hr />
            <p style={{ color: colors.accent, fontWeight: 600 }}>
              Paid Off: 0%
            </p>
          </div>
        );
      }

      const event = data.events.find(e => e.month === point.eventMonth);
      if (event) {
        const balanceAfterPayment = event.startBalance - event.payment;
        const isAfterPayment = point.pointType === 'after_payment';
        const netProgress = event.payment - event.interest;

        return (
          <div className="custom-tooltip">
            <p><strong>Month {event.month}</strong></p>
            <p style={{ fontSize: '1.1rem', fontWeight: 700, color: isAfterPayment ? colors.payment : colors.interest }}>
              Balance: {formatCurrency(point.balance)}
            </p>
            <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
              {isAfterPayment ? 'After Payment' : 'After Interest'}
            </p>
            <hr />
            <p>Start: {formatCurrency(event.startBalance)}</p>
            <p style={{ color: colors.payment }}>- Payment: {formatCurrency(event.payment)}</p>
            <p style={{ color: colors.payment }}>= {formatCurrency(balanceAfterPayment)}</p>
            <p style={{ color: colors.interest }}>+ Interest: {formatCurrency(event.interest)}</p>
            <p><strong>End: {formatCurrency(event.endBalance)}</strong></p>
            <hr />
            <p style={{ color: colors.accent, fontWeight: 600 }}>
              Net Progress: {formatCurrency(netProgress)}
              <span style={{ fontWeight: 400, fontSize: '0.8rem', display: 'block', opacity: 0.7 }}>
                (Payment - Interest)
              </span>
            </p>
            <p style={{ color: colors.accent, fontWeight: 600, marginTop: '0.5rem' }}>
              Paid Off: {point.payoffPercent.toFixed(1)}%
              <span style={{ fontWeight: 400, fontSize: '0.8rem', display: 'block', opacity: 0.7 }}>
                ({formatCurrency(point.cumulativePrincipalPaid)} of {formatCurrency(data.principal)})
              </span>
            </p>
            {showCumulativeInterest && (
              <p style={{ color: colors.cumulative, marginTop: '0.5rem' }}>
                Total Interest Paid: {formatCurrency(point.cumulativeInterest)}
              </p>
            )}
          </div>
        );
      }
    }
    return null;
  };

  // Calculate Y-axis bounds based on visible data - auto-fit to show detail
  const visibleEvents = data.events.filter(e => e.month >= windowStart && e.month <= windowEnd + 1);
  const eventsForCalc = visibleEvents.length > 0 ? visibleEvents : data.events;

  const maxBalance = Math.max(...eventsForCalc.map(e => e.startBalance + e.interest));
  const minBalance = Math.min(...eventsForCalc.map(e => e.endBalance));
  const dataRange = maxBalance - minBalance;

  // Add padding (20% of range) above and below the data for better visibility
  const padding = dataRange * 0.2;
  let yMin = minBalance - padding;
  let yMax = maxBalance + padding;

  // Don't go below 0
  if (yMin < 0) {
    yMin = 0;
  }

  // Round to nice values for cleaner axis labels
  const step = Math.pow(10, Math.floor(Math.log10(dataRange / 4 || 1)));
  yMin = Math.floor(yMin / step) * step;
  yMax = Math.ceil(yMax / step) * step;

  const yBounds = { min: yMin, max: yMax };

  // Generate X-axis ticks - show each month when zoomed in
  const xTicks: number[] = [];
  const tickStep = windowSize <= 12 ? 1 : windowSize <= 24 ? 2 : windowSize <= 48 ? 6 : 12;
  for (let i = Math.ceil(windowStart / tickStep) * tickStep; i <= windowEnd; i += tickStep) {
    if (i >= windowStart && i <= windowEnd) xTicks.push(i);
  }

  // Zoom handlers - change window size
  const zoomIn = () => {
    const newSize = Math.max(3, Math.floor(windowSize / 2));
    setWindowSize(newSize);
    // Keep centered if possible
    const center = windowStart + windowSize / 2;
    const newStart = Math.max(0, Math.min(totalMonths - newSize, center - newSize / 2));
    setWindowStart(Math.floor(newStart));
  };

  const zoomOut = () => {
    const newSize = Math.min(totalMonths, windowSize * 2);
    setWindowSize(newSize);
    // Adjust start to keep in bounds
    const newStart = Math.max(0, Math.min(totalMonths - newSize, windowStart));
    setWindowStart(Math.floor(newStart));
  };

  const resetZoom = () => {
    setWindowSize(totalMonths);
    setWindowStart(0);
  };

  // Pan handlers - move window left/right
  const panLeft = () => {
    const step = Math.max(1, Math.floor(windowSize / 4));
    setWindowStart(Math.max(0, windowStart - step));
  };

  const panRight = () => {
    const step = Math.max(1, Math.floor(windowSize / 4));
    setWindowStart(Math.min(totalMonths - windowSize, windowStart + step));
  };

  const canPanLeft = windowStart > 0;
  const canPanRight = windowStart + windowSize < totalMonths;

  // Custom dot renderer - only show dots at main points (not break points)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderDot = (props: any): React.ReactElement<SVGElement> => {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null || !payload) {
      return <g />;
    }

    // Skip break points (those with fractional months like .501 or .999)
    const monthDecimal = payload.month % 1;
    const isMainPoint = monthDecimal === 0 || monthDecimal === 0.5;
    if (!isMainPoint) {
      return <g />;
    }

    // Color based on point type
    let fill = colors.accent; // accent for principal
    if (payload.pointType === 'after_payment') {
      fill = colors.payment; // green
    } else if (payload.pointType === 'after_interest') {
      fill = colors.interest; // red
    }

    return (
      <circle
        key={`dot-${payload.month}`}
        cx={cx}
        cy={cy}
        r={6}
        fill={fill}
        stroke={colors.tooltipBg}
        strokeWidth={2}
        style={{ cursor: 'pointer' }}
      />
    );
  };

  return (
    <div className={`chart-container ${isFullscreen ? 'chart-fullscreen' : ''}`}>
      <div className="chart-header">
        <h3>Loan Balance Over Time</h3>
        <div className="chart-controls">
          <div className="pan-controls">
            <button onClick={panLeft} disabled={!canPanLeft} title="Pan Left">&larr;</button>
            <span className="range-label">
              Month {Math.floor(windowStart)} - {Math.floor(windowEnd)}
            </span>
            <button onClick={panRight} disabled={!canPanRight} title="Pan Right">&rarr;</button>
          </div>
          <div className="zoom-controls">
            <button onClick={zoomIn} title="Zoom In (fewer months)">+</button>
            <button onClick={zoomOut} title="Zoom Out (more months)">-</button>
            <button onClick={resetZoom} title="Show All Months">All</button>
          </div>
          <label className="toggle-option">
            <input
              type="checkbox"
              checked={showCumulativeInterest}
              onChange={(e) => setShowCumulativeInterest(e.target.checked)}
            />
            <span>Total Interest</span>
          </label>
          <button
            className="simulate-btn"
            onClick={startSimulation}
            disabled={isSimulating}
            title="Simulate loan payoff"
          >
            {isSimulating ? '⏳ Simulating...' : '▶ Simulate'}
          </button>
          <button
            className="fullscreen-btn"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? "Exit Fullscreen (Esc)" : "Fullscreen"}
          >
            {isFullscreen ? '✕' : '⛶'}
          </button>
        </div>
      </div>
      {isSimulating && (
        <div className="simulation-progress">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${(animationMonth / totalMonths) * 100}%` }}
            />
          </div>
          <span className="progress-text">
            Month {Math.floor(animationMonth)} of {totalMonths} ({((animationMonth / totalMonths) * 100).toFixed(0)}%)
          </span>
        </div>
      )}
      <div className="chart-legend">
        <div className="legend-item">
          <span className="legend-line green"></span>
          <span>Payment (Balance Down)</span>
        </div>
        <div className="legend-item">
          <span className="legend-line red"></span>
          <span>Interest (Balance Up)</span>
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
      <div className="chart-wrapper">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={displayedChartData}
          margin={{ top: 20, right: 40, left: 60, bottom: 30 }}
        >
          <XAxis
            dataKey="month"
            type="number"
            domain={[windowStart, windowEnd]}
            ticks={xTicks}
            tickFormatter={(value) => `${Math.round(value)}`}
            axisLine={{ stroke: colors.axis, strokeWidth: 1 }}
            tickLine={{ stroke: colors.axis }}
            tick={{ fill: colors.text, fontSize: 12 }}
            label={{
              value: 'Month',
              position: 'bottom',
              offset: 10,
              fill: colors.text,
              fontSize: 14
            }}
            allowDataOverflow
          />
          <YAxis
            domain={[yBounds.min, yBounds.max]}
            tickFormatter={(value) => formatCurrency(value)}
            axisLine={{ stroke: colors.axis, strokeWidth: 1 }}
            tickLine={{ stroke: colors.axis }}
            tick={{ fill: colors.text, fontSize: 12 }}
            label={{
              value: 'Balance',
              angle: -90,
              position: 'insideLeft',
              offset: -45,
              fill: colors.text,
              fontSize: 14
            }}
            width={80}
          />
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={colors.grid}
            opacity={0.5}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Green line - Payment (balance going DOWN) */}
          <Line
            type="linear"
            dataKey="green"
            stroke={colors.payment}
            strokeWidth={3}
            dot={renderDot}
            activeDot={{ r: 8, stroke: colors.tooltipBg, strokeWidth: 2 }}
            name="Payment"
            connectNulls={false}
            isAnimationActive={false}
          />

          {/* Red line - Interest (balance going UP) */}
          <Line
            type="linear"
            dataKey="red"
            stroke={colors.interest}
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 8, fill: colors.interest, stroke: colors.tooltipBg, strokeWidth: 2 }}
            name="Interest"
            connectNulls={false}
            isAnimationActive={false}
          />

          {/* Maroon line - Cumulative Interest (running total) */}
          {showCumulativeInterest && (
            <Line
              type="monotone"
              dataKey="cumulativeInterest"
              stroke={colors.cumulative}
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 6, fill: colors.cumulative, stroke: colors.tooltipBg, strokeWidth: 2 }}
              name="Total Interest Paid"
              connectNulls={true}
              isAnimationActive={false}
            />
          )}

          {/* Milestone reference lines */}
          {displayedMilestones.map((milestone) => {
            // Color progression: light blue -> medium blue -> dark blue
            const milestoneColors: Record<number, string> = {
              25: colors.milestone25,
              50: colors.milestone50,
              75: colors.milestone75,
            };
            const color = milestoneColors[milestone.percent] || colors.milestone50;

            return (
              <ReferenceLine
                key={`milestone-${milestone.percent}`}
                x={milestone.month}
                stroke={color}
                strokeWidth={2}
                label={{
                  value: `${milestone.percent}%`,
                  position: 'top',
                  fill: color,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              />
            );
          })}
        </ComposedChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
};
