import React, { useState } from 'react';

interface InfoTooltipProps {
  term: string;
  definition: string;
  howToFind?: string;
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({ term, definition, howToFind }) => {
  const [isVisible, setIsVisible] = useState(false);

  const close = () => setIsVisible(false);
  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsVisible(v => !v);
  };

  return (
    <span
      className="info-tooltip-wrapper"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {/* Mobile backdrop — tap anywhere outside to dismiss */}
      {isVisible && (
        <span className="info-tooltip__backdrop" onClick={close} aria-hidden="true" />
      )}

      <button
        type="button"
        className="info-tooltip__trigger"
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        onClick={toggle}
        aria-label={`Info about ${term}`}
        aria-expanded={isVisible}
      >
        <svg viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="8" r="8"/>
          <text x="8" y="11.5" textAnchor="middle" fill="white" fontSize="10" fontWeight="600" fontFamily="Georgia, serif" fontStyle="italic">i</text>
        </svg>
      </button>

      {isVisible && (
        <div className="info-tooltip__content" role="tooltip">
          {/* Mobile sheet handle */}
          <div className="info-tooltip__sheet-handle" aria-hidden="true" />
          <div className="info-tooltip__term">{term}</div>
          <div className="info-tooltip__definition">{definition}</div>
          {howToFind && (
            <div className="info-tooltip__how-to-find">
              <span className="info-tooltip__find-label">Where to find it:</span>
              <span>{howToFind}</span>
            </div>
          )}
          {/* Mobile close button */}
          <button
            type="button"
            className="info-tooltip__sheet-close"
            onClick={close}
            aria-label="Close"
          >
            Done
          </button>
        </div>
      )}
    </span>
  );
};

// Field definitions for all loan types
export const FIELD_DEFINITIONS = {
  // Common
  balance: {
    term: 'Current Balance',
    definition: 'The total amount you currently owe on this account.',
    howToFind: 'Check your latest statement or log into your online account.',
  },
  monthlyPayment: {
    term: 'Monthly Payment',
    definition: 'The amount you pay each month toward this debt. For mortgages: enter P&I only (principal + interest), not your total PITI payment. The strategy simulation uses P&I to calculate your payoff timeline.',
    howToFind: 'For mortgages: find P&I on your statement — it is lower than your total payment. For other loans: your regular payment amount.',
  },

  // Credit Card
  apr: {
    term: 'APR (Annual Percentage Rate)',
    definition: 'The annual rate used to accrue monthly interest in this simulator: balance × (APR/365 × 30).',
    howToFind: 'Found on your statement under "Interest Rates" or in your card agreement.',
  },
  creditLimit: {
    term: 'Credit Limit',
    definition: 'The maximum amount you can borrow on this card.',
    howToFind: 'Check your statement or online account under "Credit Limit" or "Available Credit".',
  },
  minimumPaymentPercent: {
    term: 'Minimum Payment %',
    definition: 'The percentage of your balance required as minimum payment (typically 1-3%).',
    howToFind: 'Listed in your card agreement. Most cards use 1-2% of balance.',
  },
  minimumPaymentFloor: {
    term: 'Minimum Payment Floor',
    definition: 'The lowest minimum payment amount, even if the percentage would be less.',
    howToFind: 'Usually $25-35. Check your card agreement.',
  },

  // Personal Loan
  interestRate: {
    term: 'Interest Rate (Note Rate)',
    definition: 'The annual rate used to compute monthly interest: balance × (rate/12). Use the rate from your loan documents — this is typically slightly lower than the APR disclosed at closing.',
    howToFind: 'Listed on your loan agreement or current monthly statement.',
  },
  termMonths: {
    term: 'Loan Term',
    definition: 'The total length of time to repay the loan.',
    howToFind: 'Check your original loan agreement or ask your lender.',
  },
  originationFee: {
    term: 'Origination Fee',
    definition: 'A one-time fee charged when the loan is issued, typically 1-8% of the loan amount.',
    howToFind: 'Listed in your loan disclosure documents.',
  },

  // Auto Loan
  vehiclePrice: {
    term: 'Vehicle Price',
    definition: 'The total purchase price of the vehicle before any discounts or trade-ins.',
    howToFind: 'On your purchase agreement or sales contract.',
  },
  downPayment: {
    term: 'Down Payment',
    definition: 'The upfront cash payment you make when purchasing. Recommended: 20% for new, 10% for used.',
    howToFind: 'The amount you paid at signing, not including trade-in.',
  },
  tradeInValue: {
    term: 'Trade-in Value',
    definition: 'The amount credited for your old vehicle toward the new purchase.',
    howToFind: 'Listed on your purchase agreement. Check KBB or Edmunds for estimates.',
  },
  tradeInPayoff: {
    term: 'Trade-in Payoff',
    definition: 'If you still owe money on your trade-in, this is added to your new loan.',
    howToFind: 'Contact your current lender for payoff amount.',
  },
  vehicleYear: {
    term: 'Vehicle Year',
    definition: 'The model year of the vehicle, used to calculate depreciation.',
    howToFind: 'Listed on the window sticker or vehicle registration.',
  },

  // Mortgage
  homePrice: {
    term: 'Home Price',
    definition: 'The purchase price of the home.',
    howToFind: 'On your purchase agreement or closing documents.',
  },
  downPaymentPercent: {
    term: 'Down Payment %',
    definition: 'Percentage of home price paid upfront. Under 20% requires PMI.',
    howToFind: 'Calculate: (Down Payment ÷ Home Price) × 100',
  },
  propertyTax: {
    term: 'Property Tax',
    definition: 'Annual taxes paid to local government based on home value (typically 0.5-2.5% of home value).',
    howToFind: 'Check your county assessor website or closing documents.',
  },
  homeInsurance: {
    term: 'Homeowners Insurance',
    definition: 'Annual insurance premium protecting against damage and liability.',
    howToFind: 'Contact insurance providers for quotes, or check closing docs.',
  },
  pmiRate: {
    term: 'PMI Rate',
    definition: 'Private Mortgage Insurance - required if down payment is under 20%. Typically 0.3-1.5% of loan annually.',
    howToFind: 'Your lender will provide this. It drops off at 78% LTV.',
  },
  hoa: {
    term: 'HOA Fees',
    definition: 'Monthly fees paid to a homeowners association for community maintenance.',
    howToFind: 'Ask your real estate agent or check listing details.',
  },
  mortgageTerm: {
    term: 'Mortgage Term',
    definition: 'Length of the loan. Shorter terms have higher payments but less total interest.',
    howToFind: 'Choose based on your budget: 15-year saves money, 30-year has lower payments.',
  },

  // Student Loan
  isFederal: {
    term: 'Federal vs Private',
    definition: 'Federal loans come from the government with fixed rates and flexible repayment. Private loans are from banks/credit unions.',
    howToFind: 'Check studentaid.gov for federal loans, or your lender for private.',
  },
  isSubsidized: {
    term: 'Subsidized Loan',
    definition: 'The government pays interest while you\'re in school and during grace periods. Only for undergrads with financial need.',
    howToFind: 'Listed on your loan documents. Check studentaid.gov.',
  },
  repaymentPlan: {
    term: 'Repayment Plan',
    definition: 'Standard (10yr fixed), Graduated (starts low, increases), Extended (25yr), or Income-Driven (based on income).',
    howToFind: 'Contact your loan servicer to see available plans.',
  },
  loanServicer: {
    term: 'Loan Servicer',
    definition: 'The company that manages your loan and collects payments.',
    howToFind: 'Check studentaid.gov or your monthly statements.',
  },
  studentOriginationFee: {
    term: 'Origination Fee',
    definition: 'Fee deducted from loan disbursement. Federal Direct loans: 1.057%, PLUS loans: 4.228%.',
    howToFind: 'Listed on your loan disclosure. Federal rates are fixed.',
  },

  // Auto Loan — additional purchase costs
  salesTax: {
    term: 'Sales Tax',
    definition: 'State and local sales tax applied to the vehicle purchase price. Adds directly to your loan amount. Varies by state: typically 4-10%.',
    howToFind: 'Check your state DMV website or ask the dealer. Most dealers calculate this automatically on the purchase agreement.',
  },
  docAndRegFees: {
    term: 'Doc & Registration Fees',
    definition: 'Dealer documentation fee ($100-$900) plus state registration and title fees. These are financed into the loan amount.',
    howToFind: 'Listed on the dealer\'s purchase order. Registration varies by state.',
  },

  // Personal Loan — prepayment
  prepaymentPenalty: {
    term: 'Prepayment Penalty',
    definition: 'A fee charged for paying off the loan early, typically 1-5% of the remaining balance or a flat fee. If present, extra payments may not benefit you as much as the calculator shows.',
    howToFind: 'Check your loan agreement under "Prepayment" or call your lender to ask.',
  },
};
