/** Đồng bộ với Backend `PASSWORD_STRENGTH_REGEX` (create-user.dto). */
export const PASSWORD_STRENGTH_REGEX =
  /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,128}$/

export const PASSWORD_POLICY_HINT_VI =
  '8–128 ký tự: ít nhất một chữ hoa, một số và một ký tự đặc biệt.'

/** Bản ngắn cho dòng lỗi inline (tránh khối quá cao trong lưới 2 cột) */
export const PASSWORD_POLICY_ERROR_VI =
  '8–128 ký tự: chữ hoa, số và ký tự đặc biệt.'
