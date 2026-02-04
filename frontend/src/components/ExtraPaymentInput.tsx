import React from 'react';

interface ExtraPaymentInputProps {
  value: number;
  onChange: (value: number) => void;
  maxSuggested?: number;
}

export const ExtraPaymentInput: React.FC<ExtraPaymentInputProps> = ({
  value,
  onChange,
  maxSuggested = 1000
}) => {
  const quickAmounts = [50, 100, 200, 500];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value) || 0;
    onChange(Math.max(0, newValue));
  };

  return (
    <div className="extra-payment-input">
      <div className="extra-payment-header">
        <label htmlFor="extra-payment">Extra Monthly Payment</label>
        <span className="extra-payment-hint">Amount above minimum payments</span>
      </div>

      <div className="extra-payment-control">
        <div className="input-wrapper">
          <span className="input-prefix">$</span>
          <input
            id="extra-payment"
            type="number"
            min="0"
            step="10"
            value={value || ''}
            onChange={handleInputChange}
            placeholder="0"
          />
        </div>

        <div className="quick-amounts">
          {quickAmounts.map(amount => (
            <button
              key={amount}
              type="button"
              className={`quick-amount-btn ${value === amount ? 'active' : ''}`}
              onClick={() => onChange(amount)}
            >
              ${amount}
            </button>
          ))}
        </div>
      </div>

      {value > 0 && (
        <div className="extra-payment-summary">
          You're adding <strong>${value.toLocaleString()}/month</strong> to accelerate debt payoff
        </div>
      )}
    </div>
  );
};
