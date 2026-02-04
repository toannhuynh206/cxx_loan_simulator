import React, { useState, useMemo } from 'react';
import { CombinedLoanResult } from '../types/loan';
import { PayoffStrategyType, StrategyComparison } from '../types/payoffStrategy';
import { compareStrategies } from '../services/payoffStrategyService';
import { ExtraPaymentInput } from './ExtraPaymentInput';
import { StrategySelector } from './StrategySelector';
import { StrategyComparisonTable } from './StrategyComparisonTable';
import { PayoffOrderList } from './PayoffOrderList';
import { StrategyBalanceChart } from './StrategyBalanceChart';
import { IndividualLoanTables } from './IndividualLoanTables';

interface DebtPayoffStrategyProps {
  loanData: CombinedLoanResult;
}

export const DebtPayoffStrategy: React.FC<DebtPayoffStrategyProps> = ({ loanData }) => {
  const [extraPayment, setExtraPayment] = useState<number>(100);
  const [selectedStrategy, setSelectedStrategy] = useState<PayoffStrategyType>('avalanche');

  // Calculate strategy comparison whenever inputs change
  const comparison: StrategyComparison = useMemo(() => {
    return compareStrategies(loanData, extraPayment);
  }, [loanData, extraPayment]);

  // Get the selected strategy's result
  const selectedResult = comparison.strategies[selectedStrategy];

  // Calculate suggested max extra payment (e.g., 50% of total minimum payments)
  const totalMinPayments = loanData.loans.reduce(
    (sum, loan) => sum + (loan.minimumPayment || loan.monthlyPayment),
    0
  );

  return (
    <div className="debt-payoff-strategy">
      <div className="strategy-header">
        <h3>Debt Payoff Strategies</h3>
        <p className="strategy-subtitle">
          Compare different approaches to pay off your {loanData.loans.length} loans faster
        </p>
      </div>

      <div className="strategy-inputs">
        <ExtraPaymentInput
          value={extraPayment}
          onChange={setExtraPayment}
          maxSuggested={Math.round(totalMinPayments * 0.5)}
        />
      </div>

      <div className="strategy-comparison-section">
        <StrategyComparisonTable
          comparison={comparison}
          selectedStrategy={selectedStrategy}
          onSelectStrategy={setSelectedStrategy}
        />
      </div>

      <div className="strategy-details">
        <div className="strategy-details-header">
          <StrategySelector
            selected={selectedStrategy}
            onChange={setSelectedStrategy}
          />
        </div>

        <div className="strategy-order-section">
          <PayoffOrderList result={selectedResult} originalLoans={loanData.loans} />
        </div>
      </div>

      <div className="strategy-chart-standalone">
        <StrategyBalanceChart result={selectedResult} selectedStrategy={selectedStrategy} originalLoans={loanData.loans} />
      </div>

      <div className="individual-tables-section">
        <IndividualLoanTables result={selectedResult} originalLoans={loanData.loans} />
      </div>
    </div>
  );
};
