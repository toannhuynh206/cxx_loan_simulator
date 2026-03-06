import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { LoanResponse } from '../types/loan';
import { useTheme } from '../context/ThemeContext';

interface PaymentBreakdownChartProps {
  data: LoanResponse;
}

export const PaymentBreakdownChart: React.FC<PaymentBreakdownChartProps> = ({ data }) => {
  const { theme } = useTheme();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const totalPaid = data.principal + data.totalInterest;

  // Theme-aware colors
  const colors = {
    principal: theme === 'dark' ? '#34d399' : '#059669',
    interest: theme === 'dark' ? '#f87171' : '#dc2626',
    text: theme === 'dark' ? '#fafaf9' : '#1c1917',
    textSecondary: theme === 'dark' ? '#a8a29e' : '#57534e',
  };
  const principalPercent = ((data.principal / totalPaid) * 100).toFixed(1);
  const interestPercent = ((data.totalInterest / totalPaid) * 100).toFixed(1);

  // Additional stats
  const effectiveInterestRate = ((data.totalInterest / data.principal) * 100).toFixed(2);
  const yearsToPayoff = data.totalMonths / 12;
  const interestPerYear = data.totalInterest / yearsToPayoff;
  const interestPerDollar = (data.totalInterest / data.principal).toFixed(2);

  const chartData = [
    { name: 'Principal', value: data.principal, color: colors.principal },
    { name: 'Interest', value: data.totalInterest, color: colors.interest },
  ];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Custom label inside pie
  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: {
    cx: number;
    cy: number;
    midAngle: number;
    innerRadius: number;
    outerRadius: number;
    percent: number;
  }) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    if (percent < 0.05) return null;

    return (
      <text
        x={x}
        y={y}
        fill="#fff"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={14}
        fontWeight={600}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="breakdown-container">
      <h3>Where Does Your Money Go?</h3>

      <div className="breakdown-content">
        <div className="breakdown-chart">
          {/* Wrap in relative container for center overlay */}
          <div style={{ position: 'relative' }}>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <defs>
                  <linearGradient id="principalGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={colors.principal} stopOpacity={1} />
                    <stop offset="100%" stopColor={theme === 'dark' ? '#059669' : '#047857'} stopOpacity={0.85} />
                  </linearGradient>
                  <linearGradient id="interestGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={colors.interest} stopOpacity={1} />
                    <stop offset="100%" stopColor={theme === 'dark' ? '#dc2626' : '#991b1b'} stopOpacity={0.85} />
                  </linearGradient>
                </defs>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={105}
                  paddingAngle={3}
                  cornerRadius={4}
                  dataKey="value"
                  labelLine={false}
                  label={renderCustomLabel}
                  activeIndex={activeIndex ?? undefined}
                  onMouseEnter={(_, index) => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                  onClick={(_, index) => setActiveIndex(activeIndex === index ? null : index)}
                  style={{ cursor: 'pointer' }}
                >
                  <Cell
                    key="cell-principal"
                    fill="url(#principalGrad)"
                    stroke={theme === 'dark' ? '#1c1917' : '#ffffff'}
                    strokeWidth={2}
                  />
                  <Cell
                    key="cell-interest"
                    fill="url(#interestGrad)"
                    stroke={theme === 'dark' ? '#1c1917' : '#ffffff'}
                    strokeWidth={2}
                  />
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            {/* Center text overlay */}
            <div className="pie-center-overlay">
              <span className="pie-center-label">Total Cost</span>
              <span className="pie-center-value">{formatCurrency(totalPaid)}</span>
            </div>
          </div>

          {/* Custom pill legend */}
          <div className="pie-legend-pills">
            <div className="pie-legend-pill" style={{ '--pill-color': colors.principal } as React.CSSProperties}
              onMouseEnter={() => setActiveIndex(0)} onMouseLeave={() => setActiveIndex(null)}
              onClick={() => setActiveIndex(activeIndex === 0 ? null : 0)}>
              <span className="pie-legend-dot" />
              <span>Principal</span>
              <span className="pie-legend-pct">{principalPercent}%</span>
            </div>
            <div className="pie-legend-pill" style={{ '--pill-color': colors.interest } as React.CSSProperties}
              onMouseEnter={() => setActiveIndex(1)} onMouseLeave={() => setActiveIndex(null)}
              onClick={() => setActiveIndex(activeIndex === 1 ? null : 1)}>
              <span className="pie-legend-dot" />
              <span>Interest</span>
              <span className="pie-legend-pct">{interestPercent}%</span>
            </div>
          </div>

          {/* Hover/tap info panel — never blocks the chart */}
          <div className="pie-info-panel" style={{ opacity: activeIndex !== null ? 1 : 0 }}>
            {activeIndex !== null && (
              <>
                <span className="pie-info-name" style={{ color: chartData[activeIndex].color }}>
                  {chartData[activeIndex].name}
                </span>
                <span className="pie-info-value">{formatCurrency(chartData[activeIndex].value)}</span>
                <span className="pie-info-pct">
                  {((chartData[activeIndex].value / totalPaid) * 100).toFixed(1)}% of total
                </span>
              </>
            )}
          </div>
        </div>

        <div className="breakdown-stats">
          <div className="stat-item">
            <span className="stat-label">Total You'll Pay</span>
            <span className="stat-value">{formatCurrency(totalPaid)}</span>
          </div>

          <div className="stat-item principal">
            <span className="stat-label">Principal (Borrowed)</span>
            <span className="stat-value">{formatCurrency(data.principal)}</span>
            <span className="stat-percent">{principalPercent}%</span>
          </div>

          <div className="stat-item interest">
            <span className="stat-label">Interest (Cost of Borrowing)</span>
            <span className="stat-value">{formatCurrency(data.totalInterest)}</span>
            <span className="stat-percent">{interestPercent}%</span>
          </div>

          <div className="cost-ratio">
            <span className="ratio-label">For every $1 borrowed, you pay:</span>
            <span className="ratio-value">${(totalPaid / data.principal).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Additional Stats Section */}
      <div className="extended-stats">
        <h4>Loan Insights</h4>
        <div className="stats-grid">
          <div className="insight-card">
            <span className="insight-label">Effective Interest Rate</span>
            <span className="insight-value highlight">{effectiveInterestRate}%</span>
            <span className="insight-desc">Total interest as % of principal</span>
          </div>

          <div className="insight-card">
            <span className="insight-label">Time to Payoff</span>
            <span className="insight-value">{data.totalMonths} months</span>
            <span className="insight-desc">{yearsToPayoff.toFixed(1)} years</span>
          </div>

          <div className="insight-card">
            <span className="insight-label">Interest Per Year</span>
            <span className="insight-value interest">{formatCurrency(interestPerYear)}</span>
            <span className="insight-desc">Average annual interest cost</span>
          </div>

          <div className="insight-card">
            <span className="insight-label">Interest per Dollar Borrowed</span>
            <span className="insight-value interest">${interestPerDollar}</span>
            <span className="insight-desc">For every $1 of principal, you pay ${interestPerDollar} in interest</span>
          </div>
        </div>
      </div>

    </div>
  );
};
