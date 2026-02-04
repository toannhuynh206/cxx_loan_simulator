import React, { useMemo, useState, useEffect } from 'react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  ReferenceLine
} from 'recharts';
import { StrategyResult } from '../types/payoffStrategy';
import { LoanCalculationResult } from '../types/loan';
import { useTheme } from '../context/ThemeContext';
import { formatCurrency } from '../services/payoffStrategyService';

interface StrategyBalanceChartProps {
  result: StrategyResult;
  selectedStrategy?: 'avalanche' | 'snowball' | 'standard';
  originalLoans: LoanCalculationResult[];
}

interface ChartDataPoint {
  month: number;
  [key: string]: number; // Dynamic loan balance keys
}

// Color palette for different loans
const LOAN_COLORS = [
  '#0d9488', // teal
  '#7c3aed', // purple
  '#ea580c', // orange
  '#2563eb', // blue
  '#dc2626', // red
  '#16a34a', // green
  '#ca8a04', // yellow
  '#9333ea', // violet
];

export const StrategyBalanceChart: React.FC<StrategyBalanceChartProps> = ({ result, selectedStrategy, originalLoans }) => {
  const { theme } = useTheme();
  const [hoveredLoan, setHoveredLoan] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Get the display name - use actual name or fall back to "Loan X"
  const getLoanDisplayName = (loanId: string): string => {
    const index = originalLoans.findIndex(loan => loan.loanId === loanId);
    if (index >= 0) {
      const loan = originalLoans[index];
      return loan.loanName || `Loan ${index + 1}`;
    }
    return `Loan ${index + 1}`;
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

  // Theme-aware colors
  const colors = useMemo(() => ({
    text: theme === 'dark' ? '#a8a29e' : '#57534e',
    textPrimary: theme === 'dark' ? '#fafaf9' : '#1c1917',
    grid: theme === 'dark' ? '#292524' : '#e7e5e4',
    axis: theme === 'dark' ? '#44403c' : '#d6d3d1',
    tooltipBg: theme === 'dark' ? '#1c1917' : '#ffffff',
    tooltipBorder: theme === 'dark' ? '#292524' : '#e7e5e4',
  }), [theme]);

  // Get unique loan names from the result (using numbered names)
  const loanNames = useMemo(() => {
    if (result.monthlyEvents.length === 0) return [];
    return result.monthlyEvents[0].loans.map(loan => ({
      id: loan.loanId,
      name: getLoanDisplayName(loan.loanId)
    }));
  }, [result, originalLoans]);

  // Transform data for the chart
  const chartData = useMemo((): ChartDataPoint[] => {
    const data: ChartDataPoint[] = [];

    // Add month 0 with initial balances
    if (result.monthlyEvents.length > 0) {
      const month0: ChartDataPoint = { month: 0 };
      result.monthlyEvents[0].loans.forEach(loan => {
        month0[getLoanDisplayName(loan.loanId)] = loan.startBalance;
      });
      data.push(month0);
    }

    // Add each month's end balances
    result.monthlyEvents.forEach(event => {
      const point: ChartDataPoint = { month: event.month };
      event.loans.forEach(loan => {
        point[getLoanDisplayName(loan.loanId)] = loan.endBalance;
      });
      data.push(point);
    });

    return data;
  }, [result, originalLoans]);

  // Calculate Y-axis bounds
  const yMax = useMemo(() => {
    if (chartData.length === 0) return 10000;
    let max = 0;
    chartData.forEach(point => {
      Object.keys(point).forEach(key => {
        if (key !== 'month' && typeof point[key] === 'number') {
          max = Math.max(max, point[key]);
        }
      });
    });
    return Math.ceil(max * 1.1 / 1000) * 1000; // Round up to nearest 1000
  }, [chartData]);

  // Custom tooltip
  interface CustomTooltipProps {
    active?: boolean;
    payload?: Array<{ name: string; value: number; color: string }>;
    label?: number;
  }

  const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
    if (active && payload && payload.length && label !== undefined) {
      // Sort payload by value descending
      const sortedPayload = [...payload].sort((a, b) => b.value - a.value);
      const totalBalance = sortedPayload.reduce((sum, entry) => sum + entry.value, 0);

      return (
        <div className="strategy-chart-tooltip">
          <p className="tooltip-month"><strong>Month {label}</strong></p>
          <div className="tooltip-loans">
            {sortedPayload.map(entry => (
              <div key={entry.name} className="tooltip-loan-item">
                <span
                  className="tooltip-color"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="tooltip-loan-name">{entry.name}</span>
                <span className="tooltip-loan-value">
                  {entry.value <= 0.01 ? 'Paid Off!' : formatCurrency(entry.value)}
                </span>
              </div>
            ))}
          </div>
          <div className="tooltip-total">
            <span>Total Balance:</span>
            <strong>{formatCurrency(totalBalance)}</strong>
          </div>
        </div>
      );
    }
    return null;
  };

  // Find payoff months for reference lines
  const payoffMonths = result.payoffOrder.map(item => ({
    month: item.payoffMonth,
    name: getLoanDisplayName(item.loanId)
  }));

  if (chartData.length === 0 || loanNames.length === 0) {
    return null;
  }

  return (
    <div className={`strategy-balance-chart ${isFullscreen ? 'strategy-chart-fullscreen' : ''}`}>
      <div className="strategy-chart-header-controls">
        <div className="strategy-chart-title-group">
          <h4>Balance Over Time</h4>
          {selectedStrategy && (
            <span className="strategy-chart-label">
              {selectedStrategy === 'avalanche' && '⛰️ Avalanche'}
              {selectedStrategy === 'snowball' && '❄️ Snowball'}
              {selectedStrategy === 'standard' && '📊 Standard'}
            </span>
          )}
        </div>
        <button
          className="fullscreen-btn"
          onClick={() => setIsFullscreen(!isFullscreen)}
          title={isFullscreen ? "Exit Fullscreen (Esc)" : "Fullscreen"}
        >
          {isFullscreen ? '✕' : '⛶'}
        </button>
      </div>
      <div className="strategy-chart-wrapper">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 60, bottom: 30 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={colors.grid}
              opacity={0.5}
            />
            <XAxis
              dataKey="month"
              type="number"
              domain={[0, result.totalMonths]}
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
            />
            <YAxis
              domain={[0, yMax]}
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
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="top"
              height={36}
              onMouseEnter={(e) => setHoveredLoan(e.dataKey as string)}
              onMouseLeave={() => setHoveredLoan(null)}
            />

            {/* Lines for each loan */}
            {loanNames.map((loan, index) => (
              <Line
                key={loan.id}
                type="monotone"
                dataKey={loan.name}
                stroke={LOAN_COLORS[index % LOAN_COLORS.length]}
                strokeWidth={hoveredLoan === loan.name ? 4 : 2}
                dot={false}
                activeDot={{ r: 6, strokeWidth: 2 }}
                opacity={hoveredLoan && hoveredLoan !== loan.name ? 0.3 : 1}
                isAnimationActive={false}
              />
            ))}

            {/* Reference lines for payoff events */}
            {payoffMonths.map((payoff, index) => (
              <ReferenceLine
                key={`payoff-${index}`}
                x={payoff.month}
                stroke={LOAN_COLORS[loanNames.findIndex(l => l.name === payoff.name) % LOAN_COLORS.length]}
                strokeDasharray="5 5"
                opacity={0.5}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
