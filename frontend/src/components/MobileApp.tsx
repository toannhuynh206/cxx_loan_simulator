import React, { useState, useMemo, useEffect, useRef } from 'react';
import '../mobile.css';
import { LoanInput } from './LoanInput';
import { MobileBalanceView } from './MobileBalanceView';
import { PaymentBreakdownChart } from './PaymentBreakdownChart';
import { MobileGuide } from './MobileGuide';
import { MobileThemeToggle } from './MobileThemeToggle';
import { MobileAmortizationTable } from './MobileAmortizationTable';
import { MobileSimulateTab } from './MobileSimulateTab';
import { LoanEntry, LoanResponse, CombinedLoanResult } from '../types/loan';
import { PayoffStrategyType } from '../types/payoffStrategy';
import Logo from '../assets/logo.svg';

// 'home' = form + overview (always accessible)
// others = locked until simulation
// 'guide' = always accessible, fully standalone
type MobileTab = 'home' | 'balance' | 'schedule' | 'more' | 'guide';

interface MobileAppProps {
  multiLoanData: CombinedLoanResult | null;
  loanData: LoanResponse | null;
  isLoading: boolean;
  error: string | null;
  resetKey: number;
  onCalculate: (loans: LoanEntry[], budget: number, strategy: PayoffStrategyType, mode: 'auto' | 'specify') => void;
  onReset: () => void;
}

const fmt = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

const fmtFull = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v);

// SVG icons
const IconHome = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const IconBalance = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const IconSchedule = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
    <rect x="9" y="3" width="6" height="4" rx="1" />
    <line x1="9" y1="12" x2="15" y2="12" />
    <line x1="9" y1="16" x2="12" y2="16" />
  </svg>
);

const IconSimulate = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const IconGuide = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </svg>
);

const IconEdit = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" width="14" height="14">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

export const MobileApp: React.FC<MobileAppProps> = ({
  multiLoanData, loanData, isLoading, error, resetKey, onCalculate, onReset,
}) => {
  const [activeTab, setActiveTab] = useState<MobileTab>('home');
  const [inputExpanded, setInputExpanded] = useState(true);

  const hasResults = !!loanData && !!multiLoanData;
  const prevIsLoading = useRef(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Smooth transition when calculation completes
  useEffect(() => {
    const wasLoading = prevIsLoading.current;
    prevIsLoading.current = isLoading;
    if (wasLoading && !isLoading && hasResults) {
      // Fade out current content
      setIsTransitioning(true);
      setTimeout(() => {
        setInputExpanded(false);
        setActiveTab('home');
        // Scroll to top then fade in
        contentRef.current?.scrollTo({ top: 0, behavior: 'instant' });
        setIsTransitioning(false);
      }, 200);
    }
  }, [isLoading, hasResults]);

  // Collapsed pill summary text
  const pillText = useMemo(() => {
    if (!multiLoanData) return '';
    const n = multiLoanData.loans.length;
    if (n === 1) {
      const l = multiLoanData.loans[0];
      const yrs = Math.floor(multiLoanData.totalMonths / 12);
      const mos = multiLoanData.totalMonths % 12;
      const termStr = yrs > 0 ? `${yrs}yr${mos > 0 ? ` ${mos}mo` : ''}` : `${mos}mo`;
      return `${fmt(l.principal)} · ${l.apr.toFixed(1)}% · ${termStr}`;
    }
    return `${n} loans · ${fmt(multiLoanData.totalPrincipal)}`;
  }, [multiLoanData]);

  // Summary stats
  const stats = useMemo(() => {
    if (!loanData || !multiLoanData) return null;
    const years = Math.floor(loanData.totalMonths / 12);
    const months = loanData.totalMonths % 12;
    const termStr = years > 0
      ? `${years}yr${months > 0 ? ` ${months}mo` : ''}`
      : `${months}mo`;
    const today = new Date();
    const debtFreeDate = new Date(today.getFullYear(), today.getMonth() + loanData.totalMonths, 1);
    const debtFreeDateStr = debtFreeDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    return {
      principal: fmtFull(loanData.principal),
      apr: `${loanData.apr.toFixed(2)}%`,
      payment: fmtFull(loanData.monthlyPayment),
      term: termStr,
      termSub: `${loanData.totalMonths} months`,
      interest: fmtFull(loanData.totalInterest),
      total: fmtFull(loanData.principal + loanData.totalInterest),
      debtFreeDate: debtFreeDateStr,
    };
  }, [loanData, multiLoanData]);

  // Navigate to a result tab (only when results exist)
  const goToResultTab = (tab: MobileTab) => {
    if (!hasResults) return;
    setActiveTab(tab);
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Navigate to Home — always works; collapses form if results exist
  const goHome = () => {
    setActiveTab('home');
    if (hasResults) setInputExpanded(false);
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Open form for editing (navigates to Home and expands form)
  const openEdit = () => {
    setActiveTab('home');
    setInputExpanded(true);
  };

  return (
    <div className="m-app">
      {/* ── Compact header (always fixed at top) ── */}
      <header className="m-header">
        <div className="m-header-brand">
          <img src={Logo} alt="LoanScope" className="m-header-logo" />
          <h1 className="m-header-title">LoanScope</h1>
        </div>
        <div className="m-header-actions">
          <MobileThemeToggle />
        </div>
      </header>

      {/* ── Main content ── */}
      <div ref={contentRef} className={`m-content${isTransitioning ? ' m-content--transitioning' : ''}`}>

        {/* ── HOME TAB ── form + overview ── */}
        {activeTab === 'home' && (
          <>
            {/* Collapsed pill when results exist and form is closed */}
            {hasResults && !inputExpanded && (
              <div className="m-input-pill" onClick={openEdit}>
                <span className="m-pill-summary">{pillText}</span>
                <button className="m-pill-edit" onClick={(e) => { e.stopPropagation(); openEdit(); }}>
                  <IconEdit /> Edit
                </button>
              </div>
            )}

            {/* Input form: only on Home tab, when editing or no results yet */}
            {(inputExpanded || !hasResults) && (
              <LoanInput key={resetKey} onCalculate={(loans, budget, strategy, mode) => {
                onCalculate(loans, budget, strategy, mode);
              }} isLoading={isLoading} />
            )}

            {error && <div className="m-error">{error}</div>}

            {/* Overview stats: Home tab, results exist, form closed */}
            {hasResults && !inputExpanded && stats && (
              <div className="m-tab-content" key="home-overview">
                <div className="m-debt-free-banner">
                  <span className="m-debt-free-label">Debt-free by</span>
                  <span className="m-debt-free-date">{stats.debtFreeDate}</span>
                </div>
                <h2 className="m-section-title">Loan Summary</h2>
                <div className="m-stat-grid">
                  <div className="m-stat-card">
                    <span className="m-stat-label">Principal</span>
                    <span className="m-stat-value">{stats.principal}</span>
                  </div>
                  <div className="m-stat-card">
                    <span className="m-stat-label">APR</span>
                    <span className="m-stat-value">{stats.apr}</span>
                  </div>
                  <div className="m-stat-card">
                    <span className="m-stat-label">Monthly Payment</span>
                    <span className="m-stat-value">{stats.payment}</span>
                  </div>
                  <div className="m-stat-card accent">
                    <span className="m-stat-label">Time to Payoff</span>
                    <span className="m-stat-value">{stats.term}</span>
                    <span className="m-stat-sub">{stats.termSub}</span>
                  </div>
                  <div className="m-stat-card warning">
                    <span className="m-stat-label">Total Interest</span>
                    <span className="m-stat-value">{stats.interest}</span>
                  </div>
                  <div className="m-stat-card accent">
                    <span className="m-stat-label">Total Paid</span>
                    <span className="m-stat-value">{stats.total}</span>
                  </div>
                </div>

                <h2 className="m-section-title">Payment Breakdown</h2>
                <div className="m-breakdown-wrapper">
                  <PaymentBreakdownChart data={loanData!} />
                </div>
              </div>
            )}
          </>
        )}

        {/* ── RESULT TABS — pill always visible on these tabs ── */}
        {activeTab !== 'home' && activeTab !== 'guide' && hasResults && (
          <>
            {/* Collapsed pill at top of every result tab */}
            <div className="m-input-pill" onClick={openEdit}>
              <span className="m-pill-summary">{pillText}</span>
              <button className="m-pill-edit" onClick={(e) => { e.stopPropagation(); openEdit(); }}>
                <IconEdit /> Edit
              </button>
            </div>

            <div className="m-tab-content" key={activeTab}>
              {activeTab === 'balance' && (
                <div>
                  <h2 className="m-section-title">Balance Over Time</h2>
                  <MobileBalanceView data={loanData!} multiLoanData={multiLoanData} />
                </div>
              )}
              {activeTab === 'schedule' && (
                <MobileAmortizationTable data={loanData!} multiLoanData={multiLoanData} />
              )}
              {activeTab === 'more' && (
                <MobileSimulateTab multiLoanData={multiLoanData!} />
              )}
            </div>
          </>
        )}

        {/* ── GUIDE TAB — fully standalone, no form, no pill ── */}
        {activeTab === 'guide' && (
          <div className="m-tab-content">
            <MobileGuide loanData={multiLoanData} />
          </div>
        )}
      </div>

      {/* ── Reset pill (floating, above nav) — always visible except Guide ── */}
      {activeTab !== 'guide' && (
        <button className="m-reset-pill" onClick={() => { onReset(); setActiveTab('home'); setInputExpanded(true); }}>
          ↺ Reset
        </button>
      )}

      {/* ── iOS bottom navigation ── always visible ── */}
      <nav className="m-bottom-nav">
        {/* Home — always enabled */}
        <button
          className={`m-bottom-nav-item ${activeTab === 'home' ? 'active' : ''}`}
          onClick={goHome}
        >
          <IconHome />
          <span className="m-bottom-nav-label">Home</span>
        </button>

        {/* Result tabs — locked until simulation */}
        <button
          className={`m-bottom-nav-item ${activeTab === 'balance' ? 'active' : ''} ${!hasResults ? 'disabled' : ''}`}
          onClick={() => goToResultTab('balance')}
        >
          <IconBalance />
          <span className="m-bottom-nav-label">Balance</span>
        </button>
        <button
          className={`m-bottom-nav-item ${activeTab === 'schedule' ? 'active' : ''} ${!hasResults ? 'disabled' : ''}`}
          onClick={() => goToResultTab('schedule')}
        >
          <IconSchedule />
          <span className="m-bottom-nav-label">Schedule</span>
        </button>
        <button
          className={`m-bottom-nav-item ${activeTab === 'more' ? 'active' : ''} ${!hasResults ? 'disabled' : ''}`}
          onClick={() => goToResultTab('more')}
        >
          <IconSimulate />
          <span className="m-bottom-nav-label">Simulate</span>
        </button>

        {/* Guide — always enabled */}
        <button
          className={`m-bottom-nav-item ${activeTab === 'guide' ? 'active' : ''}`}
          onClick={() => setActiveTab('guide')}
        >
          <IconGuide />
          <span className="m-bottom-nav-label">Guide</span>
        </button>
      </nav>
    </div>
  );
};
