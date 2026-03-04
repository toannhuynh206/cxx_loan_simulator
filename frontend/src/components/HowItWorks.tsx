import React, { useEffect, useState } from 'react';
import { CombinedLoanResult, LoanCalculationResult } from '../types/loan';
import { monthlyRateForLoanType, paymentForTerm } from '../utils/amortization';

interface HowItWorksProps {
  loanData: CombinedLoanResult | null;
}

const fmt = (v: number, dec = 2) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: dec, maximumFractionDigits: dec,
  }).format(v);

const fmtPct = (v: number, dec = 4) => `${v.toFixed(dec)}%`;

function computeMonthTrace(
  principal: number,
  rate: number,
  payment: number,
  count: number,
): Array<{ month: number; startBal: number; interest: number; payment: number; principal: number; endBal: number }> {
  const rows = [];
  let bal = principal;
  for (let m = 1; m <= count && bal > 0.005; m++) {
    const startBal = bal;
    const interest = startBal * rate;
    const pmt = Math.min(payment, startBal + interest);
    const principalPaid = Math.max(0, pmt - interest);
    bal = Math.max(0, startBal + interest - pmt);
    rows.push({ month: m, startBal, interest, payment: pmt, principal: principalPaid, endBal: bal });
  }
  return rows;
}

type LoanGuideKey = 'mortgage' | 'auto' | 'student' | 'personal' | 'credit-card';

interface LoanInsight {
  icon: string;
  title: string;
  body: string;
  callout?: string;
}

interface LoanGuide {
  label: string;
  tagline: string;
  insights: LoanInsight[];
}

const LOAN_GUIDES: Record<LoanGuideKey, LoanGuide> = {
  mortgage: {
    label: 'Mortgage',
    tagline: 'The largest loan most people will ever take — with the most moving parts.',
    insights: [
      {
        icon: '🏠',
        title: 'PMI — the hidden cost',
        body: 'If your down payment is less than 20%, your lender adds Private Mortgage Insurance (PMI) — typically 0.5–1.5% of the loan annually. It cancels automatically once your balance drops to 80% of the home\'s appraised value.',
      },
      {
        icon: '📋',
        title: 'P&I vs PITI',
        body: 'Your quoted "monthly payment" often bundles more than just principal and interest. Lenders collect escrow for property taxes and homeowners insurance — this full amount is called PITI. Only the P&I portion reduces your loan balance.',
      },
      {
        icon: '📅',
        title: '30-year vs 15-year',
        body: 'A 15-year mortgage has a higher monthly payment but dramatically less total interest paid. On a $300,000 loan at 7% APR, you\'d pay roughly $240,000 in interest on a 30-year term versus around $100,000 on a 15-year.',
        callout: '~$140k saved by choosing 15 over 30 years',
      },
      {
        icon: '🐢',
        title: 'Principal builds slowly at first',
        body: 'In the early years of a 30-year mortgage, the vast majority of each payment is interest. Your balance barely moves for years. This is why making even small extra payments in year 1–5 has an outsized impact on your total cost.',
      },
    ],
  },
  auto: {
    label: 'Auto Loan',
    tagline: 'Cars lose value fast. Your loan needs to keep up — or you can end up owing more than it\'s worth.',
    insights: [
      {
        icon: '📉',
        title: 'Depreciation risk',
        body: 'New cars lose roughly 20% of value in year one and about 50% by year five. On a 72-month loan, you can owe more than the car is worth for the first 2–3 years. This is called being "underwater" or "upside down."',
      },
      {
        icon: '⚠️',
        title: 'Longer terms cost more',
        body: 'A 72-month loan feels affordable with a lower monthly payment, but you pay significantly more interest and stay underwater longer. Shorter terms (36–48 months) save money and reduce risk — though the monthly payment is higher.',
      },
      {
        icon: '🛡️',
        title: 'Gap insurance',
        body: 'If your car is totaled while you\'re underwater, your auto insurance pays only the car\'s current market value — not what you owe the lender. Gap insurance covers that difference. Worth considering on any long-term loan with a small down payment.',
      },
      {
        icon: '💵',
        title: 'Down payment reduces risk',
        body: 'A 10–20% down payment lowers your loan amount, reduces total interest, shortens the time you\'re underwater, and often qualifies you for better rates. Trading in a vehicle also reduces your principal immediately.',
      },
    ],
  },
  student: {
    label: 'Student Loan',
    tagline: 'Federal and private student loans play by very different rules. Know which type you have.',
    insights: [
      {
        icon: '🎓',
        title: 'Subsidized vs Unsubsidized',
        body: 'On subsidized federal loans, the government pays your interest while you\'re in school and during deferment. On unsubsidized loans, interest accrues from day one — even before you graduate — and gets added to your principal balance.',
      },
      {
        icon: '⏸️',
        title: 'The deferment trap',
        body: 'Pausing payments during deferment or forbearance feels like relief, but interest keeps accruing on unsubsidized loans. When payments resume, that unpaid interest capitalizes — it\'s added to your principal — making your starting balance larger than when you paused.',
      },
      {
        icon: '📊',
        title: 'Income-driven repayment',
        body: 'Federal loans offer plans that cap your monthly payment at 5–10% of your discretionary income, regardless of your balance. After 20–25 years of qualifying payments (or 10 years under Public Service Loan Forgiveness), any remaining balance is forgiven.',
      },
      {
        icon: '⏰',
        title: '6-month grace period',
        body: 'Federal loans give you a 6-month grace period after graduation before payments begin. Interest still accrues on unsubsidized loans during this time. Making even small payments during the grace period prevents your balance from growing before you\'ve started.',
      },
    ],
  },
  personal: {
    label: 'Personal Loan',
    tagline: 'Flexible and fast — but usually more expensive than secured loans. Read the fine print.',
    insights: [
      {
        icon: '💸',
        title: 'Origination fees',
        body: 'Many lenders charge an origination fee of 1–8% upfront, deducted before you receive the money. If you borrow $10,000 with a 5% origination fee, you receive $9,500 but owe — and pay interest on — the full $10,000 from day one. Always factor this into the true cost.',
      },
      {
        icon: '🔓',
        title: 'Unsecured = higher APR',
        body: 'Personal loans have no collateral, which means more risk for the lender and higher rates for you compared to auto loans or mortgages. Strong credit can get you 8–12% APR; weaker credit can push 25–36%. Always compare to your other options.',
      },
      {
        icon: '🔄',
        title: 'Debt consolidation use case',
        body: 'A common and often smart use: consolidate multiple high-interest debts into one lower-rate loan. If your credit cards average 22% APR and you qualify for a 12% personal loan, you reduce your interest cost and simplify to one monthly payment.',
      },
      {
        icon: '✅',
        title: 'Usually no prepayment penalty',
        body: 'Most personal loans let you pay off early without fees — unlike some mortgages. Any extra payment goes directly to principal. Even one extra payment per year can cut months off your loan and save a meaningful amount in interest.',
      },
    ],
  },
  'credit-card': {
    label: 'Credit Card',
    tagline: 'The most expensive debt to carry — and the easiest to pay zero interest on, if you know the rules.',
    insights: [
      {
        icon: '🎯',
        title: 'The grace period',
        body: 'If you pay your full statement balance before the due date every month, you pay zero interest — regardless of your APR. The moment you carry any balance forward, the grace period vanishes and interest starts accruing on every new purchase from the transaction date.',
        callout: 'Pay full balance monthly = 0% effective interest',
      },
      {
        icon: '🕳️',
        title: 'The minimum payment trap',
        body: 'Paying only the minimum keeps you in debt for a very long time. On a $5,000 balance at 20% APR, minimum payments alone could take 15+ years and cost nearly $5,000 in interest — almost doubling what you originally borrowed.',
        callout: '$5k balance → $10k total paid on minimums alone',
      },
      {
        icon: '📅',
        title: 'Daily compounding',
        body: 'Credit card interest accrues every single day using APR ÷ 365. Unlike installment loans with a fixed payoff date, there is no end — your balance can grow indefinitely on minimum payments. This is what makes revolving credit card debt so dangerous.',
      },
      {
        icon: '🔀',
        title: 'Multiple APR rates',
        body: 'Most cards have separate rates for purchases, cash advances, and balance transfers. Cash advance APR is usually higher and starts accruing immediately with no grace period. Balance transfer offers at 0% often charge a 3–5% upfront transfer fee — still worth it vs 20%+ APR in most cases.',
      },
    ],
  },
};

export const HowItWorks: React.FC<HowItWorksProps> = ({ loanData }) => {
  const [animate, setAnimate] = useState(false);
  const [activeLoanTab, setActiveLoanTab] = useState<LoanGuideKey>('mortgage');

  useEffect(() => {
    setAnimate(false);
    const t = setTimeout(() => setAnimate(true), 100);
    return () => clearTimeout(t);
  }, [loanData]);

  let isExample = false;
  let loanName: string, principal: number, apr: number, loanType: string, totalMonths: number, monthlyPayment: number;

  if (loanData && loanData.loans.length > 0) {
    const cc = loanData.loans.find(l => l.loanType === 'credit-card');
    const selected = cc ?? [...loanData.loans].sort((a, b) => b.apr - a.apr)[0];
    loanName = selected.loanName;
    principal = selected.principal;
    apr = selected.apr;
    loanType = selected.loanType;
    totalMonths = Math.max(selected.totalMonths || 0, 12);
    monthlyPayment = selected.monthlyPayment || paymentForTerm(selected.principal, selected.apr, totalMonths, loanType);
  } else {
    isExample = true;
    loanName = 'Example Loan';
    principal = 10000;
    apr = 20;
    loanType = 'personal-loan';
    totalMonths = 48;
    monthlyPayment = paymentForTerm(10000, 20, 48, 'personal-loan');
  }

  const isCC = loanType === 'credit-card';
  const monthlyRate = monthlyRateForLoanType(apr, loanType);
  const dailyRate = isCC ? (apr / 100 / 365) : (apr / 100 / 12 / 30);

  const allTrace = computeMonthTrace(principal, monthlyRate, monthlyPayment, totalMonths);
  const traceRows = allTrace.length <= 4
    ? allTrace
    : [allTrace[0], allTrace[1], allTrace[2], null, allTrace[allTrace.length - 1]];

  // Calendar: Day 1 payment → post-payment balance → interest accrues Days 2–30
  const month1 = allTrace[0];
  const postPaymentBalance = month1?.endBal ?? Math.max(0, principal - Math.max(0, monthlyPayment - principal * monthlyRate));
  const dailyInterestPostPayment = postPaymentBalance * dailyRate;
  const monthlyInterestOnNewBal = postPaymentBalance * monthlyRate;

  // APR → rate chain
  const formulaSteps = isCC
    ? [
        { label: `${apr}%`, desc: 'APR' },
        { arrow: '÷ 365' },
        { label: fmtPct(apr / 365, 4), desc: 'Per day' },
        { arrow: '× 30' },
        { label: fmtPct(apr / 365 * 30, 3), desc: '30-day cycle' },
      ]
    : [
        { label: `${apr}%`, desc: 'APR' },
        { arrow: '÷ 12' },
        { label: fmtPct(apr / 12, 3), desc: 'Per month' },
        { arrow: '÷ 30' },
        { label: fmtPct(apr / 12 / 30), desc: 'Approx./day' },
      ];

  const multiLoans: LoanCalculationResult[] = loanData
    ? [...loanData.loans].sort((a, b) => b.apr - a.apr)
    : [];
  const hasMultipleLoans = multiLoans.length > 1;
  const totalBudget = loanData?.totalMonthlyPayment ?? 0;
  const sumMins = multiLoans.reduce((s, l) => s + (l.minimumPayment || l.monthlyPayment || 0), 0);
  const surplus = Math.max(0, totalBudget - sumMins);

  const calendarKey = `${principal}-${apr}-${loanType}`;

  return (
    <div className="how-it-works">

      {isExample && (
        <div className="hiw-example-banner">
          Showing example numbers ($10,000 at 20% APR). Switch to <strong>Calculator</strong> and run a loan to see your real data.
        </div>
      )}

      <div className="hiw-page-header">
        <h3 className="hiw-page-title">How Your Loan Interest Works</h3>
        {!isExample && <span className="hiw-loan-badge">{loanName}</span>}
        <p className="hiw-page-sub">
          A plain-English breakdown — from how lenders set your rate to exactly how we simulate every payment.
        </p>
      </div>

      {/* ── Section 1: The three numbers ── */}
      <div className="hiw-section">
        <div className="hiw-section-hd">
          <span className="hiw-sec-num">01</span>
          <div>
            <h4 className="hiw-sec-title">The Three Numbers That Define Your Loan</h4>
            <p className="hiw-sec-sub">Principal, APR, and term are all your lender needs to compute every payment.</p>
          </div>
        </div>

        <div className="hiw-triad">
          {/* Principal */}
          <div className="hiw-triad-card">
            <div className="hiw-triad-glyph">P</div>
            <div className="hiw-triad-name">Principal</div>
            <div className="hiw-triad-val">{fmt(principal, 0)}</div>
            <p className="hiw-triad-desc">The exact amount you borrowed. Every other number — interest, payment, payoff date — flows from this.</p>
          </div>

          <div className="hiw-triad-arrow">
            <svg viewBox="0 0 48 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="0" y1="12" x2="36" y2="12" />
              <polyline points="26,4 36,12 26,20" />
            </svg>
          </div>

          <div className="hiw-triad-card hiw-triad-card--hi">
            <div className="hiw-triad-glyph hiw-triad-glyph--hi">r</div>
            <div className="hiw-triad-name">APR</div>
            <div className="hiw-triad-val">{apr}%</div>
            <p className="hiw-triad-desc">Annual Percentage Rate — the yearly interest rate your lender charges on your outstanding balance. Higher APR means more of each payment goes to interest, not reducing what you owe.</p>
          </div>

          <div className="hiw-triad-arrow">
            <svg viewBox="0 0 48 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="0" y1="12" x2="36" y2="12" />
              <polyline points="26,4 36,12 26,20" />
            </svg>
          </div>

          <div className="hiw-triad-card">
            <div className="hiw-triad-glyph">M</div>
            <div className="hiw-triad-name">Monthly Payment</div>
            <div className="hiw-triad-val">{fmt(monthlyPayment)}</div>
            <p className="hiw-triad-desc">The fixed amount you pay every month. Pay this exactly and your balance hits $0 after {totalMonths} months — not a day early or late.</p>
          </div>
        </div>

        {/* APR → rate chain */}
        <div className="hiw-rate-strip">
          <span className="hiw-rate-strip-label">How APR becomes your rate:</span>
          <div className="hiw-rate-strip-flow">
            {formulaSteps.map((step, i) =>
              'arrow' in step ? (
                <div key={i} className="hiw-rate-op">{step.arrow}</div>
              ) : (
                <div key={i} className="hiw-rate-chip">
                  <span className="hiw-rate-chip-val">{step.label}</span>
                  <span className="hiw-rate-chip-desc">{step.desc}</span>
                </div>
              )
            )}
          </div>
        </div>

        {isCC
          ? (
            <p className="hiw-note">
              Credit cards use <strong>daily accrual</strong>: APR ÷ 365 gives the daily rate charged on your balance every day of the billing cycle. Installment loans (mortgage, auto, personal, student) instead compute one monthly interest charge using APR ÷ 12.
            </p>
          ) : (
            <p className="hiw-note">
              Installment loans compute interest monthly using APR ÷ 12. Credit cards work differently — they use APR ÷ 365 to charge a daily rate on your balance every day of the billing cycle.
            </p>
          )
        }
      </div>

      {/* ── Section 2: The 30-day calendar ── */}
      <div className="hiw-section">
        <div className="hiw-section-hd">
          <span className="hiw-sec-num">02</span>
          <div>
            <h4 className="hiw-sec-title">Interest Builds Every Single Day</h4>
            <p className="hiw-sec-sub">
              {isCC
                ? <>Credit cards charge interest <strong>every single day</strong> on your outstanding balance. The longer you carry a balance, the more accrues — which is why paying early in the billing cycle saves money.</>
                : <>Each billing cycle your lender computes <strong>one month's interest</strong> on your current balance. That interest must be paid before any of your payment can reduce the principal. Your first payment is special — interest pre-accrues for roughly 30 days from loan origination before you pay anything.</>
              }
            </p>
          </div>
        </div>

        {/* Payment cycle flow */}
        <div className="hiw-cycle">
          <div className="hiw-cycle-node">
            <div className="hiw-cycle-tag">Opening</div>
            <div className="hiw-cycle-big">{fmt(principal, 0)}</div>
            <div className="hiw-cycle-caption">Balance you owe</div>
          </div>

          <div className="hiw-cycle-pipe">
            <div className="hiw-cycle-pipe-line" />
            <span className="hiw-cycle-pipe-chevron">›</span>
          </div>

          <div className="hiw-cycle-node hiw-cycle-node--pay">
            <div className="hiw-cycle-tag hiw-cycle-tag--pay">Day 1 · Pay</div>
            <div className="hiw-cycle-big">{fmt(monthlyPayment)}</div>
            <div className="hiw-cycle-caption">Your payment</div>
            <div className="hiw-cycle-split">
              <span className="hiw-cycle-split-i">{fmt(month1?.interest ?? 0)} interest</span>
              <span className="hiw-cycle-split-p">{fmt(month1?.principal ?? 0)} principal</span>
            </div>
          </div>

          <div className="hiw-cycle-pipe">
            <div className="hiw-cycle-pipe-line" />
            <span className="hiw-cycle-pipe-chevron">›</span>
          </div>

          <div className="hiw-cycle-node hiw-cycle-node--down">
            <div className="hiw-cycle-tag hiw-cycle-tag--down">Result</div>
            <div className="hiw-cycle-big">{fmt(postPaymentBalance, 0)}</div>
            <div className="hiw-cycle-caption">New lower balance</div>
          </div>

          <div className="hiw-cycle-pipe">
            <div className="hiw-cycle-pipe-line" />
            <span className="hiw-cycle-pipe-chevron">›</span>
          </div>

          <div className="hiw-cycle-node hiw-cycle-node--int">
            <div className="hiw-cycle-tag hiw-cycle-tag--int">{isCC ? 'Days 2–30' : 'Next cycle'}</div>
            <div className="hiw-cycle-big">{fmt(monthlyInterestOnNewBal)}</div>
            <div className="hiw-cycle-caption">{isCC ? 'Daily interest accrual' : 'Interest due next month'}</div>
          </div>
        </div>

        {/* 30-day calendar grid */}
        <div key={calendarKey} className="hiw-calendar">

          {/* Day 1 — payment cell */}
          <div className="hiw-cal-day hiw-cal-day--paid">
            <div className="hiw-cal-daynum">1</div>
            <div className="hiw-cal-paid-badge">PAID</div>
            <div className="hiw-cal-paid-amt">{fmt(monthlyPayment)}</div>
            <div className="hiw-cal-paid-bal">{fmt(postPaymentBalance, 0)} left</div>
          </div>

          {/* Days 2–30 — interest builds, intensity ramps */}
          {Array.from({ length: 29 }, (_, i) => (
            <div
              key={i + 2}
              className="hiw-cal-day hiw-cal-day--int"
              style={{
                '--day-index': i,
                '--intensity': ((i + 1) / 29),
              } as React.CSSProperties}
            >
              <div className="hiw-cal-daynum">{i + 2}</div>
              <div className="hiw-cal-cost">+{fmt(dailyInterestPostPayment)}</div>
            </div>
          ))}

          {/* Padding cells to complete the grid row */}
          {Array.from({ length: 5 }, (_, i) => (
            <div key={`e-${i}`} className="hiw-cal-day hiw-cal-day--empty" />
          ))}
        </div>

        {/* Monthly total bar */}
        <div className="hiw-cal-total">
          {isCC
            ? <span className="hiw-cal-total-math">30 days × {fmt(dailyInterestPostPayment)}/day</span>
            : <span className="hiw-cal-total-math">{fmt(postPaymentBalance, 0)} balance × {fmtPct(monthlyRate * 100, 3)}/mo</span>
          }
          <span className="hiw-cal-total-eq">=</span>
          <span className="hiw-cal-total-result">{fmt(monthlyInterestOnNewBal)}</span>
          <span className="hiw-cal-total-label">interest due on your next payment</span>
        </div>
        <p className="hiw-cycle-disclaimer">
          {isCC
            ? 'Credit cards truly charge interest every day — paying your balance early in the cycle saves real money. The calendar above is an accurate picture of how your balance accrues costs day by day.'
            : 'For installment loans (mortgage, auto, personal, student), your lender computes one monthly interest charge on your opening balance — not a literal daily tally. The calendar visualizes this as a daily breakdown to make it intuitive, but the number that actually matters is the monthly total shown above. The split between interest and principal is accurate from the first payment onward.'
          }
        </p>
      </div>

      {/* ── Section 3: The algorithm ── */}
      <div className="hiw-section">
        <div className="hiw-section-hd">
          <span className="hiw-sec-num">03</span>
          <div>
            <h4 className="hiw-sec-title">The Algorithm Behind Your Numbers</h4>
            <p className="hiw-sec-sub">How lenders set your minimum payment — and what we assume when we calculate it.</p>
          </div>
        </div>

        {/* Minimum payment explainer */}
        <div className="hiw-algo-block">
          <div className="hiw-algo-block-title">How Your Minimum Payment Is Set</div>
          <p className="hiw-trace-intro">
            Your lender uses three inputs — how much you borrowed, the interest rate, and the loan term — to compute a fixed monthly payment.
            Paying exactly this amount every month brings your balance to $0 at the end of the term.
          </p>

          <div className="hiw-term-cards">
            <div className="hiw-term-card">
              <div className="hiw-term-card-type">Personal Loan</div>
              <div className="hiw-term-card-term">1–7 yrs</div>
              <div className="hiw-term-card-note">Fixed term set at origination</div>
            </div>
            <div className="hiw-term-card">
              <div className="hiw-term-card-type">Auto Loan</div>
              <div className="hiw-term-card-term">2–7 yrs</div>
              <div className="hiw-term-card-note">Fixed term set at origination</div>
            </div>
            <div className="hiw-term-card">
              <div className="hiw-term-card-type">Mortgage</div>
              <div className="hiw-term-card-term">15 or 30 yrs</div>
              <div className="hiw-term-card-note">Fixed term set at origination</div>
            </div>
            <div className="hiw-term-card">
              <div className="hiw-term-card-type">Student Loan</div>
              <div className="hiw-term-card-term">10 yrs</div>
              <div className="hiw-term-card-note">Standard federal plan</div>
            </div>
            <div className="hiw-term-card hiw-term-card--cc">
              <div className="hiw-term-card-type">Credit Card</div>
              <div className="hiw-term-card-term">Revolving</div>
              <div className="hiw-term-card-note">≈2% of balance ($25 min), recalculated each month</div>
            </div>
          </div>

          <div className="hiw-formula-display">
            <div className="hiw-formula-lhs">M =</div>
            <div className="hiw-formula-fraction">
              <div className="hiw-formula-num">P &nbsp;×&nbsp; r &nbsp;×&nbsp; (1 + r)<sup>n</sup></div>
              <div className="hiw-formula-bar" />
              <div className="hiw-formula-den">(1 + r)<sup>n</sup> &nbsp;−&nbsp; 1</div>
            </div>
            <div className="hiw-formula-legend">
              <div><strong>P</strong> = {fmt(principal, 0)} &nbsp;(principal)</div>
              <div><strong>r</strong> = {fmtPct(monthlyRate * 100, 4)} &nbsp;({isCC ? 'APR ÷ 365 × 30' : 'APR ÷ 12'})</div>
              <div><strong>n</strong> = {totalMonths} months</div>
              <div className="hiw-formula-result"><strong>M</strong> = {fmt(monthlyPayment)} /month</div>
            </div>
          </div>

          <p className="hiw-formula-footnote">
            LoanScope uses this formula under the hood — you just enter your numbers and we handle the math.
          </p>

          <div className="hiw-assumptions">
            <div className="hiw-assumptions-title">Assumptions &amp; Limitations</div>
            <ul className="hiw-assumptions-list">
              <li>
                <strong>Fixed monthly payment.</strong> We assume the same payment every month. In practice, credit card minimums shrink as your balance drops, and variable-rate loans adjust with market rates.
              </li>
              <li>
                <strong>Principal = your starting balance.</strong> Whatever you enter is treated as the Day 1 balance. If you've already been paying for years and enter your <em>current</em> remaining balance, the minimum we calculate may be higher than what your lender actually charges — because they computed the original minimum on a much larger starting balance.
              </li>
            </ul>
          </div>
        </div>

        {/* Month-by-month trace table */}
        <div className="hiw-algo-block">
          <div className="hiw-algo-block-title">Month-by-Month Calculation</div>
          <p className="hiw-trace-intro">
            Each month: accrue interest on the current balance, apply your payment (interest first), reduce the balance by the rest.
          </p>
          <div className="hiw-trace-table-wrap">
            <table className="hiw-trace-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Start Balance</th>
                  <th className="hiw-col-interest">Interest ({fmtPct(monthlyRate * 100, 3)})</th>
                  <th>Payment</th>
                  <th className="hiw-col-principal">To Principal</th>
                  <th>End Balance</th>
                </tr>
              </thead>
              <tbody>
                {traceRows.map((row) =>
                  row === null ? (
                    <tr key="ellipsis" className="hiw-trace-ellipsis">
                      <td colSpan={6}>· · · {totalMonths - 4} more months · · ·</td>
                    </tr>
                  ) : (
                    <tr key={row.month} className={row.month === totalMonths ? 'hiw-trace-last' : ''}>
                      <td className="hiw-trace-month">{row.month}</td>
                      <td>{fmt(row.startBal)}</td>
                      <td className="hiw-col-interest">{fmt(row.interest)}</td>
                      <td>{fmt(row.payment)}</td>
                      <td className="hiw-col-principal">{fmt(row.principal)}</td>
                      <td className={row.endBal < 0.01 ? 'hiw-trace-zero' : ''}>
                        {row.endBal < 0.01 ? '$0.00 ✓' : fmt(row.endBal)}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Multi-loan cascade */}
        {hasMultipleLoans && (
          <div className="hiw-algo-block">
            <div className="hiw-algo-block-title">How We Handle Your {multiLoans.length} Loans Together</div>
            <p className="hiw-trace-intro">
              With multiple loans we simulate month-by-month using the <strong>avalanche strategy</strong>: minimums to every loan, surplus to the highest-APR loan first.
            </p>

            <div className="hiw-cascade-diagram">
              <div className="hiw-cascade-budget">
                <div className="hiw-cascade-budget-label">Monthly Budget</div>
                <div className="hiw-cascade-budget-amount">{fmt(totalBudget, 0)}</div>
              </div>

              <div className="hiw-cascade-arrow-down">↓</div>

              <div className="hiw-cascade-step">
                <div className="hiw-cascade-step-label">Step 1 — Minimums to every loan</div>
                <div className="hiw-cascade-loans">
                  {multiLoans.map((loan, i) => {
                    const min = loan.minimumPayment || loan.monthlyPayment || 0;
                    return (
                      <div key={loan.loanId} className={`hiw-cascade-loan-chip ${i === 0 ? 'hiw-cascade-loan-chip--priority' : ''}`}>
                        <div className="hiw-cascade-loan-name">{loan.loanName}</div>
                        <div className="hiw-cascade-loan-apr">{loan.apr}% APR{i === 0 ? ' ★ highest' : ''}</div>
                        <div className="hiw-cascade-loan-min">min {fmt(min, 0)}/mo</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {surplus > 0.5 && (
                <>
                  <div className="hiw-cascade-arrow-down">↓ {fmt(surplus, 0)} surplus remaining</div>
                  <div className="hiw-cascade-step hiw-cascade-step--priority">
                    <div className="hiw-cascade-step-label">Step 2 — Surplus attacks {multiLoans[0].loanName} ({multiLoans[0].apr}% APR)</div>
                    <div className="hiw-cascade-surplus-bar" style={{ '--bar-pct': animate ? '100%' : '0%' } as React.CSSProperties}>
                      <div className="hiw-cascade-surplus-fill">{fmt(surplus, 0)} extra/mo</div>
                    </div>
                  </div>
                </>
              )}

              <div className="hiw-cascade-arrow-down">↓ when a loan pays off</div>

              <div className="hiw-cascade-step hiw-cascade-step--freed">
                <div className="hiw-cascade-step-label">Step 3 — Freed minimum rolls to next priority</div>
                <p className="hiw-cascade-freed-desc">
                  When {multiLoans[0].loanName} is fully paid, its freed minimum redirects to the next highest-APR loan —
                  accelerating payoff without increasing your budget.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Section 4: Loan type guide ── */}
      <div className="hiw-section">
        <div className="hiw-section-hd">
          <span className="hiw-sec-num">04</span>
          <div>
            <h4 className="hiw-sec-title">How Each Loan Type Works</h4>
            <p className="hiw-sec-sub">
              The core math is the same for every loan — but each type has unique rules, risks, and costs that change your strategy.
            </p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="hiw-loan-tabs">
          {(Object.entries(LOAN_GUIDES) as [LoanGuideKey, LoanGuide][]).map(([key, guide]) => (
            <button
              key={key}
              className={`hiw-loan-tab${activeLoanTab === key ? ' hiw-loan-tab--active' : ''}`}
              onClick={() => setActiveLoanTab(key)}
            >
              {guide.label}
            </button>
          ))}
        </div>

        {/* Content panel */}
        {(() => {
          const guide = LOAN_GUIDES[activeLoanTab];
          return (
            <div className="hiw-loan-panel">
              <p className="hiw-loan-tagline">{guide.tagline}</p>
              <div className="hiw-loan-insights">
                {guide.insights.map((insight, i) => (
                  <div key={i} className="hiw-loan-insight">
                    <div className="hiw-loan-insight-icon">{insight.icon}</div>
                    <div className="hiw-loan-insight-title">{insight.title}</div>
                    <p className="hiw-loan-insight-body">{insight.body}</p>
                    {insight.callout && (
                      <div className="hiw-loan-callout">{insight.callout}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>

    </div>
  );
};
