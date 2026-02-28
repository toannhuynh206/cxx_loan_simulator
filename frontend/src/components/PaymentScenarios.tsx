import React, { useMemo, useState, useEffect } from 'react';
import { CombinedLoanResult } from '../types/loan';
import { LoanSnapshot } from '../types/payoffStrategy';
import { createLoanSnapshots, simulateStrategy } from '../services/payoffStrategyService';

interface PaymentScenariosProps {
  multiLoanData: CombinedLoanResult;
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);

function monthsToDate(months: number): string {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() + months, 1);
  return target.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/** Binary search: find minimum extra payment to pay off all loans within targetMonths. */
function findExtraForTarget(
  snapshots: LoanSnapshot[],
  sumMinimums: number,
  targetMonths: number
): { totalPayment: number; totalInterest: number } | null {
  const feasibility = simulateStrategy(snapshots, 10_000_000, 'avalanche');
  if (feasibility.totalMonths > targetMonths) return null;

  const totalBalance = snapshots.reduce((s, l) => s + l.balance, 0);
  let lo = 0;
  let hi = Math.ceil(totalBalance);

  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const result = simulateStrategy(snapshots, mid, 'avalanche');
    if (result.totalMonths <= targetMonths) {
      hi = mid;
    } else {
      lo = mid + 1;
    }
  }

  const result = simulateStrategy(snapshots, lo, 'avalanche');
  return { totalPayment: sumMinimums + lo, totalInterest: result.totalInterest };
}

export const PaymentScenarios: React.FC<PaymentScenariosProps> = ({ multiLoanData }) => {
  const snapshots = useMemo(() => createLoanSnapshots(multiLoanData), [multiLoanData]);

  const sumMinimums = useMemo(
    () => snapshots.reduce((s, l) => s + l.minimumPayment, 0),
    [snapshots]
  );

  const currentTotal = Math.round(multiLoanData.totalMonthlyPayment);
  const step = currentTotal <= 300 ? 25 : currentTotal <= 600 ? 50 : 100;
  // Use exact current total as center so "current" row matches DebtPayoffStrategy baseline exactly
  const base = currentTotal;

  // Navigation state: how many steps offset from the initial center (base)
  const [centerOffset, setCenterOffset] = useState(0);

  // Reset offset whenever the underlying data changes
  useEffect(() => {
    setCenterOffset(0);
  }, [multiLoanData]);

  const centerPayment = base + centerOffset * step;
  const minPayment = Math.ceil(sumMinimums);

  // 7 rows: 3 below center, center, 3 above center
  const scenarioAmounts = useMemo(() => {
    const amounts: number[] = [];
    for (let i = -3; i <= 3; i++) {
      const amount = centerPayment + i * step;
      if (amount > 0) amounts.push(amount);
    }
    return amounts;
  }, [centerPayment, step]);

  // ↓ down = lower payments. Disabled when going one more step down would put
  // the bottom row below the minimum payment.
  // After going down: new bottom = (centerPayment - step) - 3 * step = centerPayment - 4 * step
  const canGoDown = centerPayment - 4 * step >= minPayment;

  // ↑ up = higher payments. Always enabled.
  const canGoUp = true;

  // Real simulation for each payment amount
  const scenarios = useMemo(() =>
    scenarioAmounts.map(payment => {
      const extra = Math.max(0, payment - sumMinimums);
      const result = simulateStrategy(snapshots, extra, 'avalanche');
      return { payment, months: result.totalMonths, totalInterest: result.totalInterest };
    }),
    [scenarioAmounts, snapshots, sumMinimums]
  );

  // Target timeline table via binary search
  const targetTimelines = useMemo(() =>
    [2, 3, 4, 5].map(years => {
      const found = findExtraForTarget(snapshots, sumMinimums, years * 12);
      return { years, ...found };
    }),
    [snapshots, sumMinimums]
  );

  return (
    <div className="payment-scenarios">
      <div className="scenarios-header">
        <h3>Payment Scenarios</h3>
        <p className="scenarios-subtitle">
          Projected across {snapshots.length} loan{snapshots.length !== 1 ? 's' : ''} using avalanche strategy
          &nbsp;·&nbsp; Min. payments: {formatCurrency(Math.round(sumMinimums))}/mo
        </p>
      </div>

      <div className="scenarios-grid">
        {/* Table 1: Payment → Payoff */}
        <div className="scenario-table-wrap">
          <h4 className="scenario-table-title">If I pay this much / month…</h4>
          <div className="scenario-navigable">
            {/* Arrow buttons on the left */}
            <div className="scenario-nav-arrows">
              <button
                className="scenario-nav-btn"
                onClick={() => setCenterOffset(prev => prev - 1)}
                disabled={!canGoDown}
                title="Show lower payments"
                aria-label="Show lower payments"
              >
                ▲
              </button>
              <button
                className="scenario-nav-btn"
                onClick={() => setCenterOffset(prev => prev + 1)}
                disabled={!canGoUp}
                title="Show higher payments"
                aria-label="Show higher payments"
              >
                ▼
              </button>
            </div>

            <table className="scenario-table">
              <thead>
                <tr>
                  <th>Monthly Payment</th>
                  <th>Paid Off By</th>
                  <th>Total Interest</th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map(({ payment, months, totalInterest }) => {
                  const isCurrent = payment === base;
                  const isMin = Math.abs(payment - minPayment) < step / 2;
                  return (
                    <tr key={payment} className={isCurrent ? 'scenario-row-highlight' : ''}>
                      <td className="scenario-payment">
                        {formatCurrency(payment)}
                        {isCurrent && !isMin && <span className="scenario-badge">current</span>}
                        {isMin && <span className="scenario-badge">min</span>}
                      </td>
                      <td>{monthsToDate(months)}</td>
                      <td className="scenario-interest">{formatCurrency(totalInterest)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Table 2: Target → Required Payment */}
        <div className="scenario-table-wrap">
          <h4 className="scenario-table-title">To pay it off in…</h4>
          <table className="scenario-table">
            <thead>
              <tr>
                <th>Goal</th>
                <th>Payment Needed</th>
                <th>Interest Cost</th>
              </tr>
            </thead>
            <tbody>
              {targetTimelines.map(({ years, totalPayment, totalInterest }) => (
                <tr key={years}>
                  <td className="scenario-goal">{years} years</td>
                  <td className="scenario-payment">
                    {totalPayment != null
                      ? <>{formatCurrency(totalPayment)}<span className="scenario-mo">/mo</span></>
                      : <span className="scenario-na">Not achievable</span>
                    }
                  </td>
                  <td className="scenario-interest">
                    {totalInterest != null ? formatCurrency(totalInterest) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
