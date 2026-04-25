import { Navigate, useLocation } from 'react-router-dom'
import { ACCESS_TOKEN_KEY } from '../api/client'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const loc = useLocation()
  if (!localStorage.getItem(ACCESS_TOKEN_KEY)) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  }
  return <>{children}</>
}
