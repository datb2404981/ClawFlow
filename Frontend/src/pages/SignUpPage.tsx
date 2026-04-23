import type { FormEvent } from 'react'
import { useState } from 'react'
import { Eye, EyeOff, Github } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { registerAccount } from '../api/auth'
import { getGoogleAuthUrl } from '../api/client'
import { getApiErrorMessage } from '../api/errors'
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
  authPageHeroTitleSizeSignUpClass,
  authInputIconPrefixClass,
  authInputWrapClass,
  authPageMainClass,
  authPageMainRowClass,
  authPageShellOneScreenClass,
  authPanelWrapperClass,
  authPasswordWithLeftIcon,
  authPrimarySubmitClass,
  authSocialOAuthBtnClass,
} from '../components/auth/authPageClasses'
import { emailErrorMessageVi } from '../components/auth/authFieldValidation'
import {
  PASSWORD_POLICY_ERROR_VI,
  PASSWORD_POLICY_HINT_VI,
  PASSWORD_STRENGTH_REGEX,
} from '../components/auth/authPasswordPolicy'
import { ClawSparkIcon } from '../components/icons/ClawSparkIcon'
import { GoogleLogo } from '../components/icons/GoogleLogo'

function IconUser({ className }: { className?: string }) {
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
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" />
    </svg>
  )
}

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

function normalizeUsername(raw: string): string {
  return raw.trim().slice(0, 48)
}

type SignUpFieldKey = 'username' | 'email' | 'password' | 'confirm'

export function SignUpPage() {
  const navigate = useNavigate()
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<SignUpFieldKey, string>>
  >({})
  const [apiError, setApiError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  function clearFieldError(key: SignUpFieldKey) {
    setFieldErrors((prev) => {
      if (prev[key] === undefined) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setApiError(null)
    const form = e.currentTarget
    const usernameRaw = (form.elements.namedItem('username') as HTMLInputElement)
      .value
    const email = (form.elements.namedItem('email') as HTMLInputElement).value
    const password = (form.elements.namedItem('password') as HTMLInputElement)
      .value
    const confirm = (
      form.elements.namedItem('confirm-password') as HTMLInputElement
    ).value

    const next: Partial<Record<SignUpFieldKey, string>> = {}
    const username = normalizeUsername(usernameRaw)
    if (username.length < 2) {
      next.username = 'Tên đăng nhập cần ít nhất 2 ký tự.'
    }
    const emailErr = emailErrorMessageVi(email)
    if (emailErr) next.email = emailErr
    if (!password) {
      next.password = 'Vui lòng nhập mật khẩu.'
    } else if (!PASSWORD_STRENGTH_REGEX.test(password)) {
      next.password = PASSWORD_POLICY_ERROR_VI
    }
    if (!confirm) {
      next.confirm = 'Vui lòng nhập lại mật khẩu.'
    } else if (password !== confirm) {
      next.confirm = 'Mật khẩu xác nhận không khớp.'
    }

    if (Object.keys(next).length > 0) {
      setFieldErrors(next)
      return
    }
    setFieldErrors({})

    setLoading(true)
    try {
      await registerAccount({ username, email: email.trim(), password })
      navigate('/app', { replace: true })
    } catch (err) {
      setApiError(getApiErrorMessage(err, 'Đăng ký thất bại.'))
    } finally {
      setLoading(false)
    }
  }

  function startGoogleOAuth() {
    window.location.href = getGoogleAuthUrl()
  }

  return (
    <div className={authPageShellOneScreenClass} lang="vi">
      <main className={authPageMainClass}>
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
                className={`${authPageHeroTitleClass} ${authPageHeroTitleSizeSignUpClass}`}
              >
                Tạo tài khoản
              </h1>
              <p className={authPageHeroSubtitleClass}>
                Gia nhập không gian làm việc AI — triển khai đặc vụ trong một
                quy trình.
              </p>
            </header>

            <div className={authPanelWrapperClass}>
              {apiError ? (
                <p className={authErrorAlertClass} role="alert">
                  {apiError}
                </p>
              ) : null}

              <form
                className="text-left"
                method="post"
                noValidate
                onSubmit={handleSubmit}
              >
                <div className="grid grid-cols-1 items-start gap-x-4 gap-y-3 sm:grid-cols-2 md:gap-y-3.5">
                  <div className="min-w-0">
                    <label className={authLabelClass} htmlFor="username">
                      Tên đăng nhập
                    </label>
                    <div className={authInputWrapClass}>
                      <IconUser className={authInputIconPrefixClass} />
                      <input
                        autoComplete="username"
                        aria-describedby={
                          fieldErrors.username ? 'username-error' : undefined
                        }
                        aria-invalid={!!fieldErrors.username}
                        className={`${authInputWithLeftIcon}${fieldErrors.username ? ` ${authInputErroredClass}` : ''}`}
                        id="username"
                        name="username"
                        placeholder="vi_du_nguoi_dung"
                        maxLength={48}
                        type="text"
                        disabled={loading}
                        onInput={() => clearFieldError('username')}
                      />
                    </div>
                    {fieldErrors.username ? (
                      <p
                        id="username-error"
                        className={authFieldErrorClass}
                        role="alert"
                      >
                        {fieldErrors.username}
                      </p>
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <label className={authLabelClass} htmlFor="email-address">
                      Email
                    </label>
                    <div className={authInputWrapClass}>
                      <IconMail className={authInputIconPrefixClass} />
                      <input
                        autoComplete="email"
                        aria-describedby={
                          fieldErrors.email ? 'email-error' : undefined
                        }
                        aria-invalid={!!fieldErrors.email}
                        className={`${authInputWithLeftIcon}${fieldErrors.email ? ` ${authInputErroredClass}` : ''}`}
                        id="email-address"
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
                        id="email-error"
                        className={authFieldErrorClass}
                        role="alert"
                      >
                        {fieldErrors.email}
                      </p>
                    ) : null}
                  </div>

                  <div className="min-w-0">
                    <label className={authLabelClass} htmlFor="password">
                      Mật khẩu
                    </label>
                    <div className={authInputWrapClass}>
                      <IconLock className={authInputIconPrefixClass} />
                      <input
                        autoComplete="new-password"
                        aria-describedby={
                          fieldErrors.password ? 'password-error' : undefined
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
                        aria-label={
                          showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'
                        }
                        aria-pressed={showPassword}
                        className={authEyeBtnClass}
                        disabled={loading}
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                      >
                        {showPassword ? (
                          <EyeOff
                            aria-hidden
                            className="h-[17px] w-[17px]"
                            strokeWidth={1.65}
                          />
                        ) : (
                          <Eye
                            aria-hidden
                            className="h-[17px] w-[17px]"
                            strokeWidth={1.65}
                          />
                        )}
                      </button>
                    </div>
                    {fieldErrors.password ? (
                      <p
                        id="password-error"
                        className={authFieldErrorClass}
                        role="alert"
                      >
                        {fieldErrors.password}
                      </p>
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <label
                      className={authLabelClass}
                      htmlFor="confirm-password"
                    >
                      Xác nhận mật khẩu
                    </label>
                    <div className={authInputWrapClass}>
                      <IconLock className={authInputIconPrefixClass} />
                      <input
                        autoComplete="new-password"
                        aria-describedby={
                          fieldErrors.confirm ? 'confirm-password-error' : undefined
                        }
                        aria-invalid={!!fieldErrors.confirm}
                        className={`${authPasswordWithLeftIcon}${fieldErrors.confirm ? ` ${authInputErroredClass}` : ''}`}
                        id="confirm-password"
                        name="confirm-password"
                        placeholder="••••••••"
                        type={showConfirmPassword ? 'text' : 'password'}
                        maxLength={128}
                        disabled={loading}
                        onInput={() => clearFieldError('confirm')}
                      />
                      <button
                        aria-label={
                          showConfirmPassword
                            ? 'Ẩn xác nhận mật khẩu'
                            : 'Hiện xác nhận mật khẩu'
                        }
                        aria-pressed={showConfirmPassword}
                        className={authEyeBtnClass}
                        disabled={loading}
                        type="button"
                        onClick={() => setShowConfirmPassword((v) => !v)}
                      >
                        {showConfirmPassword ? (
                          <EyeOff
                            aria-hidden
                            className="h-[17px] w-[17px]"
                            strokeWidth={1.65}
                          />
                        ) : (
                          <Eye
                            aria-hidden
                            className="h-[17px] w-[17px]"
                            strokeWidth={1.65}
                          />
                        )}
                      </button>
                    </div>
                    {fieldErrors.confirm ? (
                      <p
                        id="confirm-password-error"
                        className={authFieldErrorClass}
                        role="alert"
                      >
                        {fieldErrors.confirm}
                      </p>
                    ) : null}
                  </div>
                </div>

                {!fieldErrors.password ? (
                  <p className="mt-2 text-[11px] font-medium leading-snug text-oc-muted sm:text-[12px]">
                    {PASSWORD_POLICY_HINT_VI}
                  </p>
                ) : null}

                <button
                  className={`${authPrimarySubmitClass} mt-4`}
                  type="submit"
                  disabled={loading}
                >
                  {loading ? 'Đang tạo…' : 'Tạo tài khoản'}
                </button>
              </form>

              <div className={authDividerWrapClass}>
                <div aria-hidden className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-100" />
                </div>
                <span className="relative bg-white px-4 text-[11px] font-bold uppercase tracking-[0.12em] text-oc-muted/80">
                  Hoặc đăng ký với
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
                    <Github
                      aria-hidden
                      className="h-5 w-5"
                      strokeWidth={1.75}
                    />
                  </span>
                  GitHub
                </button>
              </div>

              <p className={authBottomLinkClass}>
                Đã có tài khoản?{' '}
                <Link
                  className="font-bold text-oc-electric underline-offset-4 hover:underline"
                  to="/login"
                >
                  Đăng nhập
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
