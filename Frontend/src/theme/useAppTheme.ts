import { useContext } from 'react'
import { ThemeContext, type ThemeCtx } from './themeContext'

export function useAppTheme(): ThemeCtx {
  const v = useContext(ThemeContext)
  if (!v) throw new Error('useAppTheme must be used within ThemeProvider')
  return v
}
