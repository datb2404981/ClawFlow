import { createContext } from 'react'
import type { AppTheme } from './storage'

export type ThemeCtx = {
  theme: AppTheme
  setTheme: (t: AppTheme) => void
}

export const ThemeContext = createContext<ThemeCtx | null>(null)
