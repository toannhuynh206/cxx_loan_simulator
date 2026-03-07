import React from 'react';
import { PayoffStrategyType, STRATEGY_INFO } from '../types/payoffStrategy';

interface StrategySelectorProps {
  selected: PayoffStrategyType;
  onChange: (strategy: PayoffStrategyType) => void;
}

const STRATEGY_HINTS: Record<PayoffStrategyType, string> = {
  avalanche: 'Highest rate first — saves most money',
  snowball: 'Smallest balance first — fastest wins',
  standard: 'Split evenly across all loans',
};

export const StrategySelector: React.FC<StrategySelectorProps> = ({
  selected,
  onChange
}) => {
  const strategies: PayoffStrategyType[] = ['avalanche', 'snowball', 'standard'];

  return (
    <div className="strategy-selector">
      <div className="strategy-tabs">
        {strategies.map(strategy => (
          <button
            key={strategy}
            type="button"
            className={`strategy-tab ${selected === strategy ? 'strategy-tab--active' : ''}`}
            onClick={() => onChange(strategy)}
          >
            <div className="strategy-tab__content">
              <span className="strategy-tab__icon">
                {strategy === 'avalanche' && '⛰️'}
                {strategy === 'snowball' && '❄️'}
                {strategy === 'standard' && '📊'}
              </span>
              <div className="strategy-tab__text">
                <span className="strategy-tab__label">{STRATEGY_INFO[strategy].label}</span>
                <span className="strategy-tab__hint">{STRATEGY_HINTS[strategy]}</span>
              </div>
            </div>
            {strategy === 'avalanche' && (
              <span className="strategy-tab__badge">Recommended</span>
            )}
          </button>
        ))}
      </div>

      <div className="strategy-description">
        {STRATEGY_INFO[selected].description}
      </div>
    </div>
  );
};
