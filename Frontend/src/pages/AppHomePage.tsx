import { Link } from 'react-router-dom'

/** Trang tạm sau đăng nhập / đăng ký thành công (chờ dashboard thật). */
export function AppHomePage() {
  return (
    <div className="openclaw-auth-shell flex min-h-dvh flex-col items-center justify-center px-6 font-text">
      <p className="text-center text-lg font-extrabold text-oc-text">
        You&apos;re signed in.
      </p>
      <p className="mt-2 text-center text-sm font-medium text-oc-muted">
        Token đã lưu; refresh cookie do backend set (cùng origin / CORS + credentials).
      </p>
      <Link
        className="mt-6 text-sm font-bold text-oc-electric underline-offset-4 hover:underline"
        to="/login"
      >
        Back to login
      </Link>
    </div>
  )
}
