/** Class dùng chung cho trang đăng nhập / đăng ký — giữ đồng bộ layout & UI. */

export const authLabelClass =
  'mb-1.5 block text-left text-[11px] font-bold uppercase tracking-[0.14em] text-oc-muted'

export const authEyeBtnClass =
  'absolute top-1/2 right-2 z-[2] flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-oc-muted/75 transition-[color,transform,background-color] duration-200 hover:bg-slate-500/[0.08] hover:text-oc-electric active:scale-[0.96] focus:outline-none focus-visible:ring-2 focus-visible:ring-oc-electric/25 disabled:pointer-events-none disabled:opacity-50'

export const authInputRoundedSubtle =
  'openclaw-input-field openclaw-input-field-subtle w-full rounded-2xl px-3.5 py-3.5 text-[15px] font-semibold tracking-[-0.02em]'

export const authInputWithLeftIcon =
  'openclaw-auth-field-flush w-full rounded-xl py-2.5 pl-10 pr-3.5 text-[15px] font-medium tracking-[-0.02em] sm:py-3'

export const authPasswordWithLeftIcon =
  'openclaw-auth-field-flush w-full rounded-xl py-2.5 pl-10 pr-12 text-[15px] font-medium tracking-[-0.02em] sm:py-3'

export const authPasswordFieldOnly =
  'openclaw-input-field openclaw-input-field-subtle w-full rounded-2xl py-3.5 pl-3.5 pr-12 text-[15px] font-semibold tracking-[-0.02em]'

export const authSocialOAuthBtnClass =
  'flex min-h-[44px] w-full items-center justify-center gap-2.5 rounded-xl border-0 bg-white px-4 py-2.5 text-[14px] font-semibold tracking-[-0.02em] text-oc-muted transition-[color,background-color] hover:bg-slate-50 focus:outline-none focus-visible:ring-1 focus-visible:ring-gray-200 disabled:pointer-events-none disabled:opacity-50 sm:min-h-[46px] sm:py-3'

export const authPrimarySubmitClass =
  'openclaw-primary-btn flex min-h-[46px] w-full items-center justify-center rounded-xl px-4 py-3 text-[15px] disabled:opacity-60 sm:min-h-[48px] sm:py-3.5'

export const authErrorAlertClass =
  'mb-3 border-l-[3px] border-l-red-500 bg-red-50/50 pl-3 py-2 text-[13px] font-semibold leading-snug text-red-800'

/** Lỗi từng ô: gọn, không hộp nền — accent viền trái (đồng bộ kiểu “flat premium”) */
export const authFieldErrorClass =
  'mt-1 max-w-[100%] border-l-2 border-l-red-500 pl-2.5 text-[11px] font-medium leading-snug tracking-[-0.01em] text-red-700 sm:text-[12px]'

/** Gắn vào input khi lỗi: viền đỏ nhất quán khi focus */
export const authInputErroredClass =
  '!border-red-300 hover:!border-red-400 hover:!bg-red-50/30 focus:!border-red-500'

export const authPageShellClass =
  'openclaw-auth-shell flex min-h-screen flex-col font-text antialiased'

/** Đăng nhập / đăng ký: một viewport cố định, cuộn nhẹ trong main nếu máy thấp */
export const authPageShellOneScreenClass =
  'openclaw-auth-shell flex h-dvh max-h-dvh flex-col overflow-hidden font-text antialiased'

export const authPageMainClass =
  'relative z-[1] flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain'

export const authDividerWrapClass = 'relative my-5 flex items-center justify-center sm:my-6'

export const authBottomLinkClass =
  'mt-5 text-center text-[13px] font-medium text-oc-muted sm:mt-6 sm:text-[14px]'

/** Cột form rộng hơn + padding dọc gọn để ưu tiên một màn hình */
export const authPageMainRowClass =
  'relative z-[1] mx-auto flex w-full max-w-[520px] flex-1 flex-col justify-center px-4 py-4 sm:px-6 sm:py-6 md:max-w-[540px] md:py-8'

export const authPageColumnClass = 'relative z-[2] flex w-full flex-col'

/** Header form: gọn để còn chỗ cho form trong 100dvh */
export const authPageHeaderClass = 'mb-3 text-center sm:mb-4'

export const authPageHeroTitleClass =
  'mt-2 text-[1.45rem] font-extrabold tracking-[-0.04em] text-oc-text sm:mt-2.5 sm:text-[1.5rem]'

export const authPageHeroTitleSizeLoginClass = 'sm:text-[1.875rem]'

export const authPageHeroTitleSizeSignUpClass = 'sm:text-[1.625rem]'

export const authPageHeroSubtitleClass =
  'mx-auto mt-1 max-w-[24rem] text-[12px] font-medium leading-snug text-oc-muted sm:mt-1.5 sm:max-w-none sm:text-[13px]'

/** Bọc input + icon: dùng group-hover cho icon khi hover ô nhập */
export const authInputWrapClass = 'group/auth-field relative'

export const authInputIconPrefixClass =
  'pointer-events-none absolute top-1/2 left-3.5 z-[1] h-[18px] w-[18px] -translate-y-1/2 text-oc-muted/60 transition-colors duration-200 group-hover/auth-field:text-oc-electric'

export const authPanelWrapperClass = 'openclaw-auth-panel px-0 py-1 sm:py-2'

/* —— Đăng ký: High-end AI SaaS (glass + mesh bên phải) —— */
export const signUpShellClass =
  'openclaw-signup-premium-shell relative flex min-h-screen flex-col font-text antialiased'

export const signUpGridClass =
  'relative z-[1] grid min-h-0 flex-1 grid-cols-1 lg:min-h-screen lg:grid-cols-2'

export const signUpFormColumnClass =
  'relative z-[2] flex flex-col justify-center px-6 py-12 sm:px-10 lg:px-14 lg:py-16 xl:px-20'

export const signUpHeaderClass = 'mb-10 text-left md:mb-11'

export const signUpPanelClass = 'openclaw-signup-glass p-8 md:p-10 lg:p-11'

export const signUpWordmarkRowClass =
  "flex items-center gap-2 font-['JetBrains_Mono',ui-monospace,monospace]"

export const signUpLabelClass =
  'mb-2 block text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500'

export const signUpInputClass =
  'openclaw-signup-premium-input w-full px-3.5 py-3.5 text-[15px] font-medium tracking-[-0.02em] text-neutral-900 rounded-xl'

export const signUpPasswordClass =
  'openclaw-signup-premium-input w-full py-3.5 pl-3.5 pr-12 text-[15px] font-medium tracking-[-0.02em] text-neutral-900 rounded-xl'

export const signUpEyeBtnClass =
  'absolute top-1/2 right-2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition-[color,transform,background-color] duration-200 hover:bg-cyan-500/10 hover:text-cyan-700 active:scale-[0.96] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/30 disabled:pointer-events-none disabled:opacity-50'

export const signUpSubmitClass =
  'openclaw-signup-premium-submit flex min-h-[52px] w-full items-center justify-center rounded-xl px-4 py-3.5 text-[15px] font-semibold tracking-[-0.02em] disabled:cursor-not-allowed disabled:opacity-55'

export const signUpErrorAlertClass =
  'mb-5 rounded-xl border border-red-200/90 bg-red-50/95 px-4 py-3 text-[13px] font-medium leading-snug text-red-800'

export const signUpHelpTextClass =
  'mt-2 text-[12px] font-normal leading-relaxed text-slate-500'

export const signUpArtColumnClass = 'relative z-0 hidden min-h-0 lg:block'
