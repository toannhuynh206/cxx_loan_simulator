import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { LoanResponse } from '../types/loan';
import { useTheme } from '../context/ThemeContext';

interface PaymentBreakdownChartProps {
  data: LoanResponse;
}

export const PaymentBreakdownChart: React.FC<PaymentBreakdownChartProps> = ({ data }) => {
  const { theme } = useTheme();
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

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { color: string } }> }) => {
    if (active && payload && payload.length) {
      const item = payload[0];
      const percent = ((item.value / totalPaid) * 100).toFixed(1);
      return (
        <div className="pie-tooltip">
          <p style={{ color: item.payload.color, fontWeight: 600 }}>{item.name}</p>
          <p>{formatCurrency(item.value)}</p>
          <p>{percent}% of total</p>
        </div>
      );
    }
    return null;
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

    if (percent < 0.05) return null; // Don't show label if slice is too small

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
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                labelLine={false}
                label={renderCustomLabel}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value) => <span style={{ color: colors.textSecondary }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
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
