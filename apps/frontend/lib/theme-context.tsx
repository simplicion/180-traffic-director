'use client';

import { useState, useEffect, useCallback } from 'react';

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

function applyThemeToDOM(resolved: ResolvedTheme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
  }
}

export function useTheme() {
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light');

  useEffect(() => {
    try {
      const isForm = typeof window !== 'undefined' && window.location.pathname.startsWith('/f/');
      const key = isForm ? '180_form_theme' : '180_theme';
      const saved = localStorage.getItem(key);
      const next: ResolvedTheme =
        saved === 'dark'
          ? 'dark'
          : saved === 'light'
          ? 'light'
          : document.documentElement.classList.contains('dark')
          ? 'dark'
          : 'light';
      setResolvedTheme(next);
      applyThemeToDOM(next);
    } catch (_) {}
  }, []);

  const setTheme = useCallback((newTheme: Theme) => {
    const resolved: ResolvedTheme =
      newTheme === 'system'
        ? typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : newTheme;
    setResolvedTheme(resolved);
    applyThemeToDOM(resolved);
    try {
      const isForm = typeof window !== 'undefined' && window.location.pathname.startsWith('/f/');
      localStorage.setItem(isForm ? '180_form_theme' : '180_theme', resolved);
    } catch (_) {}
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setTheme]);

  return {
    theme: resolvedTheme as Theme,
    resolvedTheme,
    setTheme,
    toggleTheme,
  };
}
