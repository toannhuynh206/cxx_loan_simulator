import React from 'react';
import { StrategyComparison, PayoffStrategyType, STRATEGY_INFO } from '../types/payoffStrategy';
import { formatCurrency, formatMonths } from '../services/payoffStrategyService';

interface StrategyComparisonTableProps {
  comparison: StrategyComparison;
  selectedStrategy: PayoffStrategyType;
  onSelectStrategy: (strategy: PayoffStrategyType) => void;
}

export const StrategyComparisonTable: React.FC<StrategyComparisonTableProps> = ({
  comparison,
  selectedStrategy,
  onSelectStrategy
}) => {
  const strategies: PayoffStrategyType[] = ['avalanche', 'snowball', 'standard'];

  // Find the best strategy (lowest interest)
  const bestStrategy = strategies.reduce((best, current) => {
    const currentInterest = comparison.strategies[current].totalInterest;
    const bestInterest = comparison.strategies[best].totalInterest;
    return currentInterest < bestInterest ? current : best;
  }, strategies[0]);

  return (
    <div className="strategy-comparison-table">
      <div className="comparison-header">
        <h4>Strategy Comparison</h4>
        {comparison.extraPayment > 0 && (
          <span className="comparison-extra">
            With ${comparison.extraPayment}/month extra
          </span>
        )}
      </div>

      <div className="comparison-grid">
        {strategies.map(strategy => {
          const result = comparison.strategies[strategy];
          const isBest = strategy === bestStrategy && comparison.extraPayment > 0;
          const isSelected = strategy === selectedStrategy;

          return (
            <div
              key={strategy}
              className={`comparison-card ${isSelected ? 'comparison-card--selected' : ''} ${isBest ? 'comparison-card--best' : ''}`}
              onClick={() => onSelectStrategy(strategy)}
            >
              {isBest && <div className="best-badge">Best</div>}

              <div className="comparison-card__header">
                <span className="comparison-card__icon">
                  {strategy === 'avalanche' && '⛰️'}
                  {strategy === 'snowball' && '❄️'}
                  {strategy === 'standard' && '📊'}
                </span>
                <span className="comparison-card__name">{STRATEGY_INFO[strategy].label}</span>
              </div>

              <div className="comparison-card__stats">
                <div className="comparison-stat">
                  <span className="comparison-stat__label">Total Interest</span>
                  <span className="comparison-stat__value comparison-stat__value--interest">
                    {formatCurrency(result.totalInterest)}
                  </span>
                </div>

                <div className="comparison-stat">
                  <span className="comparison-stat__label">Time to Payoff</span>
                  <span className="comparison-stat__value">
                    {formatMonths(result.totalMonths)}
                  </span>
                </div>

                {result.interestSaved > 0 && (
                  <div className="comparison-stat comparison-stat--savings">
                    <span className="comparison-stat__label">Interest Saved</span>
                    <span className="comparison-stat__value comparison-stat__value--savings">
                      {formatCurrency(result.interestSaved)}
                    </span>
                  </div>
                )}

                {result.monthsSaved > 0 && (
                  <div className="comparison-stat comparison-stat--savings">
                    <span className="comparison-stat__label">Time Saved</span>
                    <span className="comparison-stat__value comparison-stat__value--savings">
                      {formatMonths(result.monthsSaved)}
                    </span>
                  </div>
                )}
              </div>

              <div className="comparison-card__total">
                <span className="total-label">Total Paid</span>
                <span className="total-value">{formatCurrency(result.totalPaid)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
