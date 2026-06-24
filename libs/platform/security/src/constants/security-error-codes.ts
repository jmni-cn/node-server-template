/**
 * Security-related error codes.
 * @description Used for security protection, rate limiting, IP blacklisting, etc.
 */
export enum SecurityErrorCode {
  // ============ Rate Limiting (RATE_) ============
  /** Request frequency exceeded */
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  /** API call quota exhausted */
  RATE_QUOTA_EXHAUSTED = 'RATE_QUOTA_EXHAUSTED',
  /** Too many login attempts */
  RATE_LOGIN_ATTEMPTS = 'RATE_LOGIN_ATTEMPTS',
  /** Verification code requested too frequently */
  RATE_CODE_REQUEST = 'RATE_CODE_REQUEST',

  // ============ IP-related (IP_) ============
  /** IP has been blacklisted */
  IP_BLACKLISTED = 'IP_BLACKLISTED',
  /** IP is not in the whitelist */
  IP_NOT_WHITELISTED = 'IP_NOT_WHITELISTED',
  /** IP address is invalid */
  IP_INVALID = 'IP_INVALID',
  /** Suspicious IP activity detected */
  IP_SUSPICIOUS = 'IP_SUSPICIOUS',

  // ============ Security Policy (SEC_) ============
  /** CSRF token invalid */
  SEC_CSRF_INVALID = 'SEC_CSRF_INVALID',
  /** CORS origin blocked */
  SEC_CORS_BLOCKED = 'SEC_CORS_BLOCKED',
  /** XSS attack detected */
  SEC_XSS_DETECTED = 'SEC_XSS_DETECTED',
  /** SQL injection detected */
  SEC_SQL_INJECTION = 'SEC_SQL_INJECTION',
  /** Request signature invalid */
  SEC_SIGNATURE_INVALID = 'SEC_SIGNATURE_INVALID',
  /** Request timestamp expired */
  SEC_TIMESTAMP_EXPIRED = 'SEC_TIMESTAMP_EXPIRED',
  /** Replay attack detected */
  SEC_REPLAY_ATTACK = 'SEC_REPLAY_ATTACK',
  /** Password does not meet the strength policy */
  SEC_PASSWORD_TOO_WEAK = 'SEC_PASSWORD_TOO_WEAK',

  // ============ Captcha (CAPTCHA_) ============
  /** Captcha invalid */
  CAPTCHA_INVALID = 'CAPTCHA_INVALID',
  /** Captcha expired */
  CAPTCHA_EXPIRED = 'CAPTCHA_EXPIRED',
  /** Captcha verification required */
  CAPTCHA_REQUIRED = 'CAPTCHA_REQUIRED',

  // ============ Risk Control (RISK_) ============
  /** Abnormal login behavior detected */
  RISK_ABNORMAL_LOGIN = 'RISK_ABNORMAL_LOGIN',
  /** Abnormal transaction behavior detected */
  RISK_ABNORMAL_TRANSACTION = 'RISK_ABNORMAL_TRANSACTION',
  /** Account at security risk */
  RISK_ACCOUNT_AT_RISK = 'RISK_ACCOUNT_AT_RISK',
  /** Untrusted device */
  RISK_UNTRUSTED_DEVICE = 'RISK_UNTRUSTED_DEVICE',
  /** Geographic location anomaly */
  RISK_LOCATION_ANOMALY = 'RISK_LOCATION_ANOMALY',
}

/**
 * HTTP status codes corresponding to security error codes.
 */
export const SecurityErrorCodeHttpStatus: Record<SecurityErrorCode, number> = {
  // Rate limiting
  [SecurityErrorCode.RATE_LIMIT_EXCEEDED]: 429,
  [SecurityErrorCode.RATE_QUOTA_EXHAUSTED]: 429,
  [SecurityErrorCode.RATE_LOGIN_ATTEMPTS]: 429,
  [SecurityErrorCode.RATE_CODE_REQUEST]: 429,

  // IP-related
  [SecurityErrorCode.IP_BLACKLISTED]: 403,
  [SecurityErrorCode.IP_NOT_WHITELISTED]: 403,
  [SecurityErrorCode.IP_INVALID]: 400,
  [SecurityErrorCode.IP_SUSPICIOUS]: 403,

  // Security policy
  [SecurityErrorCode.SEC_CSRF_INVALID]: 403,
  [SecurityErrorCode.SEC_CORS_BLOCKED]: 403,
  [SecurityErrorCode.SEC_XSS_DETECTED]: 400,
  [SecurityErrorCode.SEC_SQL_INJECTION]: 400,
  [SecurityErrorCode.SEC_SIGNATURE_INVALID]: 401,
  [SecurityErrorCode.SEC_TIMESTAMP_EXPIRED]: 401,
  [SecurityErrorCode.SEC_REPLAY_ATTACK]: 403,
  [SecurityErrorCode.SEC_PASSWORD_TOO_WEAK]: 400,

  // Captcha
  [SecurityErrorCode.CAPTCHA_INVALID]: 400,
  [SecurityErrorCode.CAPTCHA_EXPIRED]: 400,
  [SecurityErrorCode.CAPTCHA_REQUIRED]: 428,

  // Risk control
  [SecurityErrorCode.RISK_ABNORMAL_LOGIN]: 403,
  [SecurityErrorCode.RISK_ABNORMAL_TRANSACTION]: 403,
  [SecurityErrorCode.RISK_ACCOUNT_AT_RISK]: 403,
  [SecurityErrorCode.RISK_UNTRUSTED_DEVICE]: 403,
  [SecurityErrorCode.RISK_LOCATION_ANOMALY]: 403,
};
