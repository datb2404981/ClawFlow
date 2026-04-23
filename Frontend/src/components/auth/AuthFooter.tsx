const shellClass =
  'relative z-[1] border-t border-gray-100 bg-white text-gray-500 antialiased'

const linkClass =
  'text-[12px] font-medium text-blue-500 no-underline transition-colors hover:text-blue-600'

const linkCompactClass =
  'text-[10px] font-medium text-blue-500 no-underline transition-colors hover:text-blue-600'

type AuthFooterProps = {
  /** Một hàng gọn — dùng trang đăng ký viewport cố định, không cuộn */
  compact?: boolean
}

export function AuthFooter({ compact = false }: AuthFooterProps) {
  if (compact) {
    return (
      <footer className={`${shellClass} shrink-0 py-2`}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 sm:px-6">
          <p className="text-[10px] font-normal leading-tight text-gray-500">
            © 2026 ClawFlow.
          </p>
          <nav
            className="flex flex-wrap items-center gap-x-3 gap-y-0.5"
            aria-label="Chân trang"
          >
            <a className={linkCompactClass} href="#">
              Chính sách
            </a>
            <a className={linkCompactClass} href="#">
              Điều khoản
            </a>
            <a className={linkCompactClass} href="#">
              Trạng thái
            </a>
            <a className={linkCompactClass} href="#">
              Bảo mật
            </a>
          </nav>
        </div>
      </footer>
    )
  }

  return (
    <footer className={`${shellClass} py-5`}>
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-5 md:flex-row md:items-center md:justify-between md:px-10">
        <p className="max-w-xl text-left text-[12px] font-normal leading-snug tracking-normal text-gray-500">
          © 2026 ClawFlow.
        </p>
        <nav
          className="flex flex-wrap items-center gap-x-5 gap-y-1.5 md:justify-end"
          aria-label="Chân trang"
        >
          <a className={linkClass} href="#">
            Chính sách
          </a>
          <a className={linkClass} href="#">
            Điều khoản
          </a>
          <a className={linkClass} href="#">
            Trạng thái
          </a>
          <a className={linkClass} href="#">
            Bảo mật
          </a>
        </nav>
      </div>
    </footer>
  )
}
