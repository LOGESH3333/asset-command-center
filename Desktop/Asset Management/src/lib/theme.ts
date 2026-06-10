// src/lib/theme.ts
// Utility for handling dark/light theme toggling and persistence.

export type Theme = 'light' | 'dark';

/**
 * Retrieve the current theme from localStorage or system preference.
 */
export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  try {
    const stored = localStorage.getItem('theme') as Theme | null;
    if (stored === 'light' || stored === 'dark') return stored;
  } catch (_) {}
  return 'dark';
}

/**
 * Apply the given theme by updating the document class list.
 */
export function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.classList.toggle('light', theme === 'light');
  try {
    localStorage.setItem('theme', theme);
  } catch (_) {}
}

/**
 * Toggle between light and dark themes.
 */
export function toggleTheme() {
  const current = getStoredTheme();
  const next: Theme = current === 'light' ? 'dark' : 'light';
  applyTheme(next);
}

/**
 * Initialize theme on page load – used by the inline script in layout.
 */
export function initTheme() {
  const theme = getStoredTheme();
  applyTheme(theme);
}
