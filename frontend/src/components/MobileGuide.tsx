import React, { useState } from 'react';
import { CombinedLoanResult, LoanCalculationResult } from '../types/loan';
import { monthlyRateForLoanType, paymentForTerm } from '../utils/amortization';
import { useTheme } from '../context/ThemeContext';

interface Props {
  loanData: CombinedLoanResult | null;
}

const fmt = (v: number, dec = 2) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v);
const fmtPct = (v: number, dec = 4) => `${v.toFixed(dec)}%`;

function computeMonthTrace(principal: number, rate: number, payment: number, count: number) {
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
const LOAN_GUIDES: Record<LoanGuideKey, { label: string; emoji: string; tagline: string; insights: { icon: string; title: string; body: string; callout?: string }[] }> = {
  mortgage: {
    label: 'Mortgage', emoji: '🏠',
    tagline: 'The largest loan most people will ever take — with the most moving parts.',
    insights: [
      { icon: '🔒', title: 'PMI — the hidden cost', body: 'If your down payment is less than 20%, your lender adds Private Mortgage Insurance (PMI) — typically 0.5–1.5% of the loan annually. It cancels automatically once your balance drops to 80% of the home\'s appraised value.' },
      { icon: '📋', title: 'P&I vs PITI', body: 'Your quoted "monthly payment" often bundles more than just principal and interest. Lenders collect escrow for property taxes and homeowners insurance — this full amount is called PITI. Only the P&I portion reduces your loan balance.' },
      { icon: '⚖️', title: '30-year vs 15-year', body: 'A 15-year mortgage has a higher monthly payment but dramatically less total interest paid. On a $300,000 loan at 7% APR, you\'d pay roughly $240,000 in interest on a 30-year term versus around $100,000 on a 15-year.', callout: '~$140k saved by choosing 15 over 30 years' },
      { icon: '🐢', title: 'Principal builds slowly at first', body: 'In the early years of a 30-year mortgage, the vast majority of each payment is interest. Your balance barely moves for years. This is why making even small extra payments in year 1–5 has an outsized impact.' },
    ],
  },
  auto: {
    label: 'Auto Loan', emoji: '🚗',
    tagline: 'Cars lose value fast. Your loan needs to keep up — or you\'ll owe more than it\'s worth.',
    insights: [
      { icon: '📉', title: 'Depreciation risk', body: 'New cars lose roughly 20% of value in year one and about 50% by year five. On a 72-month loan, you can owe more than the car is worth for the first 2–3 years — called being "underwater" or "upside down."' },
      { icon: '⚠️', title: 'Longer terms cost more', body: 'A 72-month loan feels affordable but you pay significantly more interest and stay underwater longer. Shorter terms (36–48 months) save money and reduce risk — though the monthly payment is higher.' },
      { icon: '🛡️', title: 'Gap insurance', body: 'If your car is totaled while you\'re underwater, your auto insurance pays only the car\'s current market value — not what you owe. Gap insurance covers that difference.' },
      { icon: '💵', title: 'Down payment reduces risk', body: 'A 10–20% down payment lowers your loan amount, reduces total interest, shortens the time you\'re underwater, and often qualifies you for better rates.' },
    ],
  },
  student: {
    label: 'Student', emoji: '🎓',
    tagline: 'Federal and private student loans play by very different rules.',
    insights: [
      { icon: '🎓', title: 'Subsidized vs Unsubsidized', body: 'On subsidized federal loans, the government pays your interest while you\'re in school. On unsubsidized loans, interest accrues from day one — even before you graduate — and gets added to your principal.' },
      { icon: '⏸️', title: 'The deferment trap', body: 'Pausing payments during deferment feels like relief, but interest keeps accruing. When payments resume, that unpaid interest capitalizes — it\'s added to your principal — making your balance larger than when you paused.' },
      { icon: '📊', title: 'Income-driven repayment', body: 'Federal loans offer plans that cap your monthly payment at 5–10% of your discretionary income. After 20–25 years of qualifying payments (or 10 years for PSLF), any remaining balance is forgiven.' },
      { icon: '⏰', title: '6-month grace period', body: 'Federal loans give you 6 months after graduation before payments begin. Interest still accrues on unsubsidized loans. Making even small payments during this period prevents your balance from growing before you\'ve started.' },
    ],
  },
  personal: {
    label: 'Personal', emoji: '💼',
    tagline: 'Flexible and fast — but usually more expensive than secured loans.',
    insights: [
      { icon: '💸', title: 'Origination fees', body: 'Many lenders charge 1–8% upfront, deducted before you receive the money. If you borrow $10,000 with a 5% fee, you receive $9,500 but owe — and pay interest on — the full $10,000 from day one.' },
      { icon: '🔓', title: 'Unsecured = higher APR', body: 'Personal loans have no collateral, which means more risk for the lender and higher rates. Strong credit can get 8–12% APR; weaker credit can push 25–36%. Always compare to your other options.' },
      { icon: '🔄', title: 'Debt consolidation use case', body: 'A common and smart use: consolidate multiple high-interest debts into one lower-rate loan. If your cards average 22% APR and you qualify for 12% personal loan, you reduce interest and simplify to one payment.' },
      { icon: '✅', title: 'No prepayment penalty', body: 'Most personal loans let you pay off early without fees. Any extra payment goes directly to principal. Even one extra payment per year can cut months off your loan.' },
    ],
  },
  'credit-card': {
    label: 'Credit Card', emoji: '💳',
    tagline: 'The most expensive debt to carry — and the easiest to pay zero interest on.',
    insights: [
      { icon: '🎯', title: 'The grace period', body: 'If you pay your full statement balance before the due date every month, you pay zero interest — regardless of your APR. The moment you carry any balance, the grace period vanishes.', callout: 'Pay full balance monthly = 0% effective interest' },
      { icon: '🕳️', title: 'The minimum payment trap', body: 'Paying only the minimum keeps you in debt for a very long time. On a $5,000 balance at 20% APR, minimum payments alone could take 15+ years and cost nearly $5,000 in interest.', callout: '$5k balance → $10k total paid on minimums alone' },
      { icon: '📅', title: 'Daily compounding', body: 'Credit card interest accrues every single day using APR ÷ 365. Unlike installment loans with a fixed payoff date, there is no end — your balance can grow indefinitely on minimum payments.' },
      { icon: '🔀', title: 'Multiple APR rates', body: 'Most cards have separate rates for purchases, cash advances, and balance transfers. Cash advance APR starts accruing immediately with no grace period. Balance transfer 0% offers often charge a 3–5% fee upfront.' },
    ],
  },
};

// Chevron icon
const Chevron: React.FC<{ open: boolean }> = ({ open }) => (
  <svg
    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    style={{ width: 18, height: 18, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

// Collapsible section wrapper
const Section: React.FC<{ num: string; title: string; sub: string; children: React.ReactNode; defaultOpen?: boolean }> = ({ num, title, sub, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`mg-section ${open ? 'mg-section--open' : ''}`}>
      <button className="mg-section-header" onClick={() => setOpen(o => !o)}>
        <span className="mg-sec-num">{num}</span>
        <div className="mg-section-header-text">
          <span className="mg-section-title">{title}</span>
          <span className="mg-section-sub">{sub}</span>
        </div>
        <Chevron open={open} />
      </button>
      {open && <div className="mg-section-body">{children}</div>}
    </div>
  );
};

export const MobileGuide: React.FC<Props> = ({ loanData }) => {
  useTheme(); // ensure theme context is connected for CSS variable reactivity
  const [activeLoanTab, setActiveLoanTab] = useState<LoanGuideKey>('mortgage');

  // ── Derive loan data (same logic as HowItWorks) ────────────
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

  const month1 = allTrace[0];
  const postPaymentBalance = month1?.endBal ?? Math.max(0, principal - Math.max(0, monthlyPayment - principal * monthlyRate));
  const dailyInterestPostPayment = postPaymentBalance * dailyRate;
  const monthlyInterestOnNewBal = postPaymentBalance * monthlyRate;

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

  const interestPct = month1 ? ((month1.interest / month1.payment) * 100).toFixed(0) : '0';
  const principalPct = month1 ? ((month1.principal / month1.payment) * 100).toFixed(0) : '100';

  return (
    <div className="mg-root">
      {/* Header */}
      <div className="mg-page-header">
        <h2 className="mg-page-title">How Your Loan Works</h2>
        {!isExample ? (
          <span className="mg-loan-badge">{loanName}</span>
        ) : (
          <div className="mg-example-banner">
            Showing example numbers ($10,000 at 20% APR). Run a calculation to see your real data.
          </div>
        )}
        <p className="mg-page-sub">Plain-English breakdown of how interest works and how we simulate your payoff.</p>
      </div>

      {/* ── Section 1: The Three Numbers ── */}
      <Section num="01" title="The Three Numbers" sub="Principal, APR, and term define every payment." defaultOpen={true}>

        {/* Stacked triad cards */}
        <div className="mg-triad">
          <div className="mg-triad-card">
            <div className="mg-triad-row">
              <span className="mg-triad-glyph">P</span>
              <div>
                <div className="mg-triad-name">Principal</div>
                <div className="mg-triad-val">{fmt(principal, 0)}</div>
              </div>
            </div>
            <p className="mg-triad-desc">The exact amount you borrowed. Every other number flows from this.</p>
          </div>

          <div className="mg-triad-connector">↓</div>

          <div className="mg-triad-card mg-triad-card--hi">
            <div className="mg-triad-row">
              <span className="mg-triad-glyph mg-triad-glyph--hi">r</span>
              <div>
                <div className="mg-triad-name">APR</div>
                <div className="mg-triad-val">{apr}%</div>
              </div>
            </div>
            <p className="mg-triad-desc">Annual Percentage Rate. Higher APR means more of each payment goes to interest, not reducing what you owe.</p>
          </div>

          <div className="mg-triad-connector">↓</div>

          <div className="mg-triad-card">
            <div className="mg-triad-row">
              <span className="mg-triad-glyph">M</span>
              <div>
                <div className="mg-triad-name">Monthly Payment</div>
                <div className="mg-triad-val">{fmt(monthlyPayment)}</div>
              </div>
            </div>
            <p className="mg-triad-desc">Pay this every month and your balance hits $0 after {totalMonths} months.</p>
          </div>
        </div>

        {/* APR Rate Chain */}
        <div className="mg-rate-chain">
          <div className="mg-rate-chain-label">How APR becomes your rate:</div>
          <div className="mg-rate-chain-flow">
            {formulaSteps.map((step, i) =>
              'arrow' in step ? (
                <div key={i} className="mg-rate-op">{step.arrow}</div>
              ) : (
                <div key={i} className="mg-rate-chip">
                  <span className="mg-rate-chip-val">{step.label}</span>
                  <span className="mg-rate-chip-desc">{step.desc}</span>
                </div>
              )
            )}
          </div>
        </div>

        <p className="mg-note">
          {isCC
            ? 'Credit cards use daily accrual: APR ÷ 365 × your balance every day. Installment loans use APR ÷ 12 for one monthly charge.'
            : 'Installment loans compute interest monthly using APR ÷ 12. Credit cards use APR ÷ 365 to charge a daily rate on your balance every day.'}
        </p>
      </Section>

      {/* ── Section 2: Interest Builds ── */}
      <Section num="02" title="Interest Builds Every Day" sub="See how each payment is split between interest and principal.">

        {/* Payment split visual */}
        <div className="mg-split-card">
          <div className="mg-split-title">Month 1 Payment Breakdown</div>
          <div className="mg-split-amount">{fmt(monthlyPayment)}</div>
          <div className="mg-split-bar">
            <div className="mg-split-bar-interest" style={{ width: `${interestPct}%` }} />
            <div className="mg-split-bar-principal" style={{ width: `${principalPct}%` }} />
          </div>
          <div className="mg-split-labels">
            <div className="mg-split-label mg-split-label--int">
              <span className="mg-split-dot mg-split-dot--int" />
              <span className="mg-split-lbl-text">Interest</span>
              <span className="mg-split-lbl-val">{fmt(month1?.interest ?? 0)} ({interestPct}%)</span>
            </div>
            <div className="mg-split-label mg-split-label--pri">
              <span className="mg-split-dot mg-split-dot--pri" />
              <span className="mg-split-lbl-text">Principal</span>
              <span className="mg-split-lbl-val">{fmt(month1?.principal ?? 0)} ({principalPct}%)</span>
            </div>
          </div>
        </div>

        {/* Vertical payment flow */}
        <div className="mg-flow">
          <div className="mg-flow-step">
            <div className="mg-flow-dot mg-flow-dot--neutral" />
            <div className="mg-flow-content">
              <div className="mg-flow-tag">Opening Balance</div>
              <div className="mg-flow-big">{fmt(principal, 0)}</div>
              <div className="mg-flow-caption">Balance you owe</div>
            </div>
          </div>

          <div className="mg-flow-line" />

          <div className="mg-flow-step">
            <div className="mg-flow-dot mg-flow-dot--pay" />
            <div className="mg-flow-content">
              <div className="mg-flow-tag mg-flow-tag--pay">Day 1 · You Pay</div>
              <div className="mg-flow-big">{fmt(monthlyPayment)}</div>
              <div className="mg-flow-split">
                <span className="mg-flow-int">{fmt(month1?.interest ?? 0)} → interest</span>
                <span className="mg-flow-pri">{fmt(month1?.principal ?? 0)} → principal</span>
              </div>
            </div>
          </div>

          <div className="mg-flow-line" />

          <div className="mg-flow-step">
            <div className="mg-flow-dot mg-flow-dot--down" />
            <div className="mg-flow-content">
              <div className="mg-flow-tag mg-flow-tag--down">New Balance</div>
              <div className="mg-flow-big">{fmt(postPaymentBalance, 0)}</div>
              <div className="mg-flow-caption">Balance after payment</div>
            </div>
          </div>

          <div className="mg-flow-line" />

          <div className="mg-flow-step">
            <div className="mg-flow-dot mg-flow-dot--int" />
            <div className="mg-flow-content">
              <div className="mg-flow-tag mg-flow-tag--int">{isCC ? 'Days 2–30' : 'Next Cycle'}</div>
              <div className="mg-flow-big">{fmt(monthlyInterestOnNewBal)}</div>
              <div className="mg-flow-caption">{isCC ? 'Daily interest accrual' : 'Interest due next month'}</div>
            </div>
          </div>
        </div>

        {/* Daily cost note */}
        <div className="mg-daily-cost">
          <span className="mg-daily-cost-label">Daily interest cost:</span>
          <span className="mg-daily-cost-val">{fmt(dailyInterestPostPayment)}/day</span>
        </div>

        <p className="mg-note" style={{ marginTop: 12 }}>
          {isCC
            ? 'Credit cards truly charge interest every day. Paying early in the billing cycle saves real money.'
            : 'For installment loans, your lender computes one monthly interest charge. The daily breakdown above makes it intuitive — but the monthly total is what actually matters.'}
        </p>
      </Section>

      {/* ── Section 3: The Algorithm ── */}
      <Section num="03" title="The Math Behind Your Numbers" sub="How lenders set your payment and how we simulate it.">

        {/* Term cards grid */}
        <div className="mg-term-grid">
          {[
            { type: 'Personal Loan', term: '1–7 yrs', note: 'Fixed term' },
            { type: 'Auto Loan', term: '2–7 yrs', note: 'Fixed term' },
            { type: 'Mortgage', term: '15 or 30 yrs', note: 'Fixed term' },
            { type: 'Student Loan', term: '10 yrs', note: 'Standard federal' },
            { type: 'Credit Card', term: 'Revolving', note: '≈2% balance, $25 min' },
          ].map(t => (
            <div key={t.type} className="mg-term-card">
              <div className="mg-term-type">{t.type}</div>
              <div className="mg-term-val">{t.term}</div>
              <div className="mg-term-note">{t.note}</div>
            </div>
          ))}
        </div>

        {/* Formula */}
        <div className="mg-formula">
          <div className="mg-formula-title">Monthly Payment Formula</div>
          <div className="mg-formula-display">
            <span className="mg-formula-lhs">M =</span>
            <div className="mg-formula-frac">
              <div className="mg-formula-num">P × r × (1+r)<sup>n</sup></div>
              <div className="mg-formula-bar" />
              <div className="mg-formula-den">(1+r)<sup>n</sup> − 1</div>
            </div>
          </div>
          <div className="mg-formula-legend">
            <div><strong>P</strong> = {fmt(principal, 0)} (principal)</div>
            <div><strong>r</strong> = {fmtPct(monthlyRate * 100, 4)} ({isCC ? 'APR ÷ 365 × 30' : 'APR ÷ 12'})</div>
            <div><strong>n</strong> = {totalMonths} months</div>
            <div className="mg-formula-result"><strong>M</strong> = {fmt(monthlyPayment)}/month</div>
          </div>
        </div>

        {/* Trace table */}
        <div className="mg-trace-title">Month-by-Month Calculation</div>
        <p className="mg-note">Each month: accrue interest on current balance, apply payment (interest first), reduce balance.</p>
        <div className="mg-trace-wrap">
          <table className="mg-trace-table">
            <thead>
              <tr>
                <th>Mo</th>
                <th>Start Bal</th>
                <th className="mg-col-int">Interest</th>
                <th>Payment</th>
                <th className="mg-col-pri">Principal</th>
                <th>End Bal</th>
              </tr>
            </thead>
            <tbody>
              {traceRows.map((row) =>
                row === null ? (
                  <tr key="ellipsis" className="mg-trace-ellipsis">
                    <td colSpan={6}>· · · {totalMonths - 4} more months · · ·</td>
                  </tr>
                ) : (
                  <tr key={row.month} className={row.month === totalMonths ? 'mg-trace-last' : ''}>
                    <td className="mg-trace-mo">{row.month}</td>
                    <td>{fmt(row.startBal, 0)}</td>
                    <td className="mg-col-int">{fmt(row.interest)}</td>
                    <td>{fmt(row.payment)}</td>
                    <td className="mg-col-pri">{fmt(row.principal)}</td>
                    <td className={row.endBal < 0.01 ? 'mg-trace-zero' : ''}>{row.endBal < 0.01 ? '$0 ✓' : fmt(row.endBal, 0)}</td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>

        {/* Multi-loan cascade */}
        {hasMultipleLoans && (
          <div className="mg-cascade">
            <div className="mg-cascade-title">How We Handle Your {multiLoans.length} Loans Together</div>
            <p className="mg-note">Minimums to every loan, surplus to the highest-APR loan first (avalanche strategy).</p>

            <div className="mg-cascade-flow">
              <div className="mg-cascade-budget">
                <span className="mg-cascade-budget-label">Monthly Budget</span>
                <span className="mg-cascade-budget-val">{fmt(totalBudget, 0)}</span>
              </div>

              <div className="mg-cascade-arrow">↓ Step 1: minimums to every loan</div>

              <div className="mg-cascade-loans">
                {multiLoans.map((loan, i) => {
                  const min = loan.minimumPayment || loan.monthlyPayment || 0;
                  return (
                    <div key={loan.loanId} className={`mg-cascade-chip ${i === 0 ? 'mg-cascade-chip--top' : ''}`}>
                      <span className="mg-cascade-chip-name">{loan.loanName}</span>
                      <span className="mg-cascade-chip-apr">{loan.apr}% APR{i === 0 ? ' ★' : ''}</span>
                      <span className="mg-cascade-chip-min">min {fmt(min, 0)}/mo</span>
                    </div>
                  );
                })}
              </div>

              {surplus > 0.5 && (
                <>
                  <div className="mg-cascade-arrow mg-cascade-arrow--surplus">↓ {fmt(surplus, 0)} surplus → {multiLoans[0].loanName}</div>
                  <div className="mg-cascade-surplus">
                    <span>{fmt(surplus, 0)} extra/mo attacks highest-APR loan</span>
                  </div>
                </>
              )}

              <div className="mg-cascade-arrow">↓ When a loan pays off</div>
              <div className="mg-cascade-freed">
                Freed minimum rolls to the next highest-APR loan — accelerating payoff without increasing your budget.
              </div>
            </div>
          </div>
        )}
      </Section>

      {/* ── Section 4: Loan Type Guide ── */}
      <Section num="04" title="Loan Type Guide" sub="Each loan type has unique rules, risks, and costs.">

        {/* Horizontal scrollable tabs */}
        <div className="mg-loan-tabs">
          {(Object.entries(LOAN_GUIDES) as [LoanGuideKey, typeof LOAN_GUIDES[LoanGuideKey]][]).map(([key, g]) => (
            <button
              key={key}
              className={`mg-loan-tab ${activeLoanTab === key ? 'mg-loan-tab--active' : ''}`}
              onClick={() => setActiveLoanTab(key)}
            >
              <span>{g.emoji}</span>
              <span>{g.label}</span>
            </button>
          ))}
        </div>

        {/* Active loan content */}
        {(() => {
          const guide = LOAN_GUIDES[activeLoanTab];
          return (
            <div className="mg-loan-panel">
              <p className="mg-loan-tagline">{guide.tagline}</p>
              <div className="mg-insights">
                {guide.insights.map((ins, i) => (
                  <div key={i} className="mg-insight">
                    <div className="mg-insight-icon">{ins.icon}</div>
                    <div className="mg-insight-body">
                      <div className="mg-insight-title">{ins.title}</div>
                      <p className="mg-insight-text">{ins.body}</p>
                      {ins.callout && <div className="mg-insight-callout">{ins.callout}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </Section>
    </div>
  );
};
