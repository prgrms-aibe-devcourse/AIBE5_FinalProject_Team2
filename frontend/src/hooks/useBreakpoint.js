import { useState, useEffect } from "react";

/**
 * Returns responsive breakpoint flags.
 * Accounts for html { zoom: 1.1 } → effective layout width = window.innerWidth / 1.1
 * Breakpoints (screen px):
 *   isDesktop  : >= 1440
 *   isLaptop   : 1024 <= w < 1440   (13-14" laptops, also triggers at ≤1366)
 *   isTablet   : w < 1024
 */
export function useBreakpoint() {
  const [w, setW] = useState(() => window.innerWidth);
  useEffect(() => {
    const handler = () => setW(window.innerWidth);
    window.addEventListener("resize", handler, { passive: true });
    return () => window.removeEventListener("resize", handler);
  }, []);
  return {
    w,
    isDesktop: w >= 1440,
    isLaptop:  w >= 1024 && w < 1440,
    isTablet:  w < 1024,
    isCompact: w < 1366,   // single convenience flag: sidebar should be collapsed
  };
}
