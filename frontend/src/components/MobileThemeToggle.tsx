import React from 'react';
import { useTheme } from '../context/ThemeContext';

const SunIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <circle cx="10" cy="10" r="3.5" />
    <line x1="10" y1="1.5" x2="10" y2="3.5" />
    <line x1="10" y1="16.5" x2="10" y2="18.5" />
    <line x1="1.5" y1="10" x2="3.5" y2="10" />
    <line x1="16.5" y1="10" x2="18.5" y2="10" />
    <line x1="4.1" y1="4.1" x2="5.5" y2="5.5" />
    <line x1="14.5" y1="14.5" x2="15.9" y2="15.9" />
    <line x1="4.1" y1="15.9" x2="5.5" y2="14.5" />
    <line x1="14.5" y1="5.5" x2="15.9" y2="4.1" />
  </svg>
);

const MoonIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <path d="M17 11.5A7 7 0 1 1 8.5 3a5.5 5.5 0 0 0 8.5 8.5z" />
  </svg>
);

export const MobileThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      className="m-theme-toggle"
      onClick={toggleTheme}
      aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
    >
      <span className={`m-theme-seg ${theme === 'light' ? 'active' : ''}`}>
        <SunIcon />
      </span>
      <span className={`m-theme-seg ${theme === 'dark' ? 'active' : ''}`}>
        <MoonIcon />
      </span>
    </button>
  );
};
