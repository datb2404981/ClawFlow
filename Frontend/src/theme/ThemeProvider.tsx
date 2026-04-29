import { useCallback, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import {
  applyDocumentTheme,
  readStoredTheme,
  writeStoredTheme,
  type AppTheme,
} from './storage'
import { ThemeContext } from './themeContext'

function resolveInitialTheme(): AppTheme {
  const stored = readStoredTheme()
  if (stored) return stored
  if (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark'
  }
  return 'light'
}

/** Chỉ export component — hook `useAppTheme` nằm file riêng để Vite Fast Refresh ổn định. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>(resolveInitialTheme)

  useLayoutEffect(() => {
    applyDocumentTheme(theme)
  }, [theme])

  const setTheme = useCallback((t: AppTheme) => {
    setThemeState(t)
    writeStoredTheme(t)
    applyDocumentTheme(t)
  }, [])

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme])

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  )
}
