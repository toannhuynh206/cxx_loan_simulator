import React, { useState, useEffect, useRef } from 'react';
import '../section-index.css';

interface Section {
  id: string;
  label: string;
  icon: string;
  visible: boolean;
}

interface SectionIndexProps {
  hasStrategy: boolean;
  visible: boolean;
}

const BASE_SECTIONS: Section[] = [
  { id: 'section-summary',    label: 'Summary',    icon: '◈', visible: true },
  { id: 'section-breakdown',  label: 'Breakdown',  icon: '◉', visible: true },
  { id: 'section-chart',      label: 'Balance',    icon: '◈', visible: true },
  { id: 'section-table',      label: 'Schedule',   icon: '◉', visible: true },
  { id: 'section-scenarios',  label: 'Scenarios',  icon: '◈', visible: true },
  { id: 'section-strategy',   label: 'Strategy',   icon: '◉', visible: false },
];

export const SectionIndex: React.FC<SectionIndexProps> = ({ hasStrategy, visible }) => {
  const [activeId, setActiveId] = useState<string>('section-summary');
  const [mounted, setMounted] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const sections = BASE_SECTIONS.map(s =>
    s.id === 'section-strategy' ? { ...s, visible: hasStrategy } : s
  ).filter(s => s.visible);

  // Trigger mount animation
  useEffect(() => {
    if (visible) {
      const t = setTimeout(() => setMounted(true), 50);
      return () => clearTimeout(t);
    } else {
      setMounted(false);
    }
  }, [visible]);

  // Track which section is in view
  useEffect(() => {
    if (!visible) return;

    observerRef.current?.disconnect();

    const candidates: { id: string; ratio: number }[] = sections.map(s => ({ id: s.id, ratio: 0 }));

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          const found = candidates.find(c => c.id === entry.target.id);
          if (found) found.ratio = entry.intersectionRatio;
        });
        const best = candidates.reduce((a, b) => (b.ratio > a.ratio ? b : a), candidates[0]);
        if (best && best.ratio > 0) setActiveId(best.id);
      },
      { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1.0], rootMargin: '-10% 0px -30% 0px' }
    );

    sections.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) observerRef.current!.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, [visible, hasStrategy]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const offset = 80;
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });
    setActiveId(id);
  };

  if (!visible) return null;

  return (
    <nav className={`section-index ${mounted ? 'section-index--visible' : ''}`} aria-label="Page sections">
      <div className="section-index__track" />
      <ul className="section-index__list">
        {sections.map((section, i) => {
          const isActive = activeId === section.id;
          return (
            <li key={section.id} className="section-index__item">
              <button
                className={`section-index__btn ${isActive ? 'active' : ''}`}
                onClick={() => scrollTo(section.id)}
                aria-current={isActive ? 'location' : undefined}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <span className="section-index__dot">
                  <span className="section-index__dot-inner" />
                </span>
                <span className="section-index__label">{section.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
