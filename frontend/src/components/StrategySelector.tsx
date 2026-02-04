import React from 'react';
import { PayoffStrategyType, STRATEGY_INFO } from '../types/payoffStrategy';

interface StrategySelectorProps {
  selected: PayoffStrategyType;
  onChange: (strategy: PayoffStrategyType) => void;
}

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
            <span className="strategy-tab__icon">
              {strategy === 'avalanche' && '⛰️'}
              {strategy === 'snowball' && '❄️'}
              {strategy === 'standard' && '📊'}
            </span>
            <span className="strategy-tab__label">{STRATEGY_INFO[strategy].label}</span>
          </button>
        ))}
      </div>

      <div className="strategy-description">
        {STRATEGY_INFO[selected].description}
      </div>
    </div>
  );
};
