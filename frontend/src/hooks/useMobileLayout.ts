import { useState, useEffect } from 'react';

export function useMobileLayout(): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth <= 768
  );

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    const mq = window.matchMedia('(max-width: 768px)');
    const mqHandler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', mqHandler);
    window.addEventListener('resize', check);
    return () => {
      mq.removeEventListener('change', mqHandler);
      window.removeEventListener('resize', check);
    };
  }, []);

  return isMobile;
}
