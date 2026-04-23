import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { Eye, EyeOff, Github } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { loginWithPassword, refreshSession } from '../api/auth'
import { setAccessToken } from '../api/client'
import { getApiErrorMessage } from '../api/errors'
import { getGoogleAuthUrl } from '../api/client'
import {
  authBottomLinkClass,
  authDividerWrapClass,
  authErrorAlertClass,
  authEyeBtnClass,
  authFieldErrorClass,
  authInputErroredClass,
  authInputWithLeftIcon,
  authLabelClass,
  authPageColumnClass,
  authPageHeaderClass,
  authPageHeroSubtitleClass,
  authPageHeroTitleClass,
  authPageHeroTitleSizeLoginClass,
  authInputIconPrefixClass,
  authInputWrapClass,
  authPageMainRowClass,
  authPanelWrapperClass,
  authPasswordWithLeftIcon,
  authPrimarySubmitClass,
  authSocialOAuthBtnClass,
  authPageShellClass,
} from '../components/auth/authPageClasses'
import { emailErrorMessageVi } from '../components/auth/authFieldValidation'
import { ClawSparkIcon } from '../components/icons/ClawSparkIcon'
import { GoogleLogo } from '../components/icons/GoogleLogo'

function IconMail({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
      viewBox="0 0 24 24"
    >
      <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  )
}

function IconLock({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
      viewBox="0 0 24 24"
    >
      <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  )
}

type LoginFieldKey = 'email' | 'password'

export function LoginPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<LoginFieldKey, string>>
  >({})
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  function clearFieldError(key: LoginFieldKey) {
    setFieldErrors((prev) => {
      if (prev[key] === undefined) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  useEffect(() => {
    const status = searchParams.get('status')
    const err = searchParams.get('error')
    const accessFromQuery = searchParams.get('access_token')

    if (err === 'google') {
      const t = window.setTimeout(() => {
        setError('Đăng nhập Google bị hủy hoặc thất bại.')
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev)
            next.delete('error')
            return next
          },
          { replace: true },
        )
      }, 0)
      return () => window.clearTimeout(t)
    }

    if (status !== 'success') return undefined

    let cancelled = false
    const t = window.setTimeout(() => {
      if (accessFromQuery?.trim()) {
        setAccessToken(accessFromQuery.trim())
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev)
            next.delete('status')
            next.delete('access_token')
            return next
          },
          { replace: true },
        )
        if (!cancelled) navigate('/app', { replace: true })
        return
      }

      const hashParams = new URLSearchParams(
        window.location.hash.replace(/^#/, ''),
      )
      const fromOAuthHash = hashParams.get('access_token')

      if (fromOAuthHash) {
        setAccessToken(fromOAuthHash)
        window.history.replaceState(
          null,
          '',
          `${window.location.pathname}${window.location.search}`,
        )
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev)
            next.delete('status')
            return next
          },
          { replace: true },
        )
        if (!cancelled) navigate('/app', { replace: true })
        return
      }

      void refreshSession()
        .then(() => {
          if (!cancelled) navigate('/app', { replace: true })
        })
        .catch(() => {
          if (!cancelled) {
            setError('Làm mới phiên thất bại. Vui lòng đăng nhập lại.')
          }
        })
        .finally(() => {
          if (!cancelled) {
            setSearchParams(
              (prev) => {
                const next = new URLSearchParams(prev)
                next.delete('status')
                return next
              },
              { replace: true },
            )
          }
        })
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [navigate, searchParams, setSearchParams])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = e.currentTarget
    const email = (form.elements.namedItem('email') as HTMLInputElement).value
    const password = (form.elements.namedItem('password') as HTMLInputElement)
      .value

    const next: Partial<Record<LoginFieldKey, string>> = {}
    const emailErr = emailErrorMessageVi(email)
    if (emailErr) next.email = emailErr
    if (!password.trim()) next.password = 'Vui lòng nhập mật khẩu.'
    if (Object.keys(next).length > 0) {
      setFieldErrors(next)
      return
    }
    setFieldErrors({})

    setLoading(true)
    try {
      await loginWithPassword(email, password)
      navigate('/app', { replace: true })
    } catch (err) {
      setError(getApiErrorMessage(err, 'Đăng nhập thất bại.'))
    } finally {
      setLoading(false)
    }
  }

  function startGoogleOAuth() {
    window.location.href = getGoogleAuthUrl()
  }

  return (
    <div className={authPageShellClass} lang="vi">
      <main className="relative z-[1] flex min-h-dvh flex-grow flex-col">
        <div className={authPageMainRowClass}>
          <div className={authPageColumnClass}>
            <header className={authPageHeaderClass}>
              <div className="flex items-center justify-center gap-2">
                <ClawSparkIcon className="h-5 w-5 shrink-0 text-oc-muted/60" />
                <p className="openclaw-wordmark text-[12px] font-extrabold tracking-[0.14em]">
                  CLAWFLOW
                </p>
              </div>
              <h1
                className={`${authPageHeroTitleClass} ${authPageHeroTitleSizeLoginClass}`}
              >
                Đăng nhập
              </h1>
              <p className={authPageHeroSubtitleClass}>
                Nền tảng AI — đăng nhập vào không gian làm việc của bạn.
              </p>
            </header>

            <div className={authPanelWrapperClass}>
              {error ? (
                <p className={authErrorAlertClass} role="alert">
                  {error}
                </p>
              ) : null}

              <form
                className="space-y-4 text-left"
                method="post"
                noValidate
                onSubmit={handleSubmit}
              >
                <div className="space-y-4">
                  <div>
                    <label className={authLabelClass} htmlFor="email">
                      Email
                    </label>
                    <div className={authInputWrapClass}>
                      <IconMail className={authInputIconPrefixClass} />
                      <input
                        autoComplete="email"
                        aria-describedby={
                          fieldErrors.email ? 'login-email-error' : undefined
                        }
                        aria-invalid={!!fieldErrors.email}
                        className={`${authInputWithLeftIcon}${fieldErrors.email ? ` ${authInputErroredClass}` : ''}`}
                        id="email"
                        name="email"
                        placeholder="ten@congty.com"
                        type="text"
                        inputMode="email"
                        disabled={loading}
                        onInput={() => clearFieldError('email')}
                      />
                    </div>
                    {fieldErrors.email ? (
                      <p
                        id="login-email-error"
                        className={authFieldErrorClass}
                        role="alert"
                      >
                        {fieldErrors.email}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <label className={authLabelClass} htmlFor="password">
                        Mật khẩu
                      </label>
                      <a
                        className="text-[12px] font-semibold text-oc-electric underline-offset-4 hover:underline sm:text-right"
                        href="#"
                      >
                        Quên mật khẩu?
                      </a>
                    </div>
                    <div className={authInputWrapClass}>
                      <IconLock className={authInputIconPrefixClass} />
                      <input
                        autoComplete="current-password"
                        aria-describedby={
                          fieldErrors.password
                            ? 'login-password-error'
                            : undefined
                        }
                        aria-invalid={!!fieldErrors.password}
                        className={`${authPasswordWithLeftIcon}${fieldErrors.password ? ` ${authInputErroredClass}` : ''}`}
                        id="password"
                        name="password"
                        placeholder="••••••••"
                        type={showPassword ? 'text' : 'password'}
                        maxLength={128}
                        disabled={loading}
                        onInput={() => clearFieldError('password')}
                      />
                      <button
                        aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                        aria-pressed={showPassword}
                        className={authEyeBtnClass}
                        disabled={loading}
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                      >
                        {showPassword ? (
                          <EyeOff aria-hidden className="h-[17px] w-[17px]" strokeWidth={1.65} />
                        ) : (
                          <Eye aria-hidden className="h-[17px] w-[17px]" strokeWidth={1.65} />
                        )}
                      </button>
                    </div>
                    {fieldErrors.password ? (
                      <p
                        id="login-password-error"
                        className={authFieldErrorClass}
                        role="alert"
                      >
                        {fieldErrors.password}
                      </p>
                    ) : null}
                  </div>
                </div>

                <button
                  className={authPrimarySubmitClass}
                  type="submit"
                  disabled={loading}
                >
                  {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
                </button>
              </form>

              <div className={authDividerWrapClass}>
                <div aria-hidden className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-100" />
                </div>
                <span className="relative bg-white px-4 text-[11px] font-bold uppercase tracking-[0.12em] text-oc-muted/80">
                  Hoặc tiếp tục với
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  className={authSocialOAuthBtnClass}
                  type="button"
                  onClick={startGoogleOAuth}
                  disabled={loading}
                >
                  <span className="flex h-5 w-5 min-w-[1.25rem] shrink-0 items-center justify-center">
                    <GoogleLogo aria-hidden className="h-5 w-5" />
                  </span>
                  Google
                </button>
                <button
                  className={authSocialOAuthBtnClass}
                  type="button"
                  disabled
                  title="Sắp ra mắt"
                >
                  <span className="flex h-5 w-5 min-w-[1.25rem] shrink-0 items-center justify-center">
                    <Github aria-hidden className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  GitHub
                </button>
              </div>

              <p className={authBottomLinkClass}>
                Chưa có tài khoản?{' '}
                <Link
                  className="font-bold text-oc-electric underline-offset-4 hover:underline"
                  to="/signup"
                >
                  Tạo tài khoản
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
