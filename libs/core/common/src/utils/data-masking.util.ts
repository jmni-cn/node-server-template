import { maskIp as _maskIp } from './security-masking.util';

/**
 * 数据脱敏工具类 — 纯静态方法，零依赖。
 *
 * 统一完成敏感信息脱敏（密钥/令牌/邮箱/手机号/IP 等），
 * 供日志、审计、对外响应等场景复用，避免重复实现。
 */
export class DataMaskingUtil {
  // ==================== 密钥 / Secret 脱敏 ====================

  /** 占位符：所有密钥/令牌一律整体替换为该值（无前缀、无后缀、无长度提示） */
  private static readonly REDACTED = '[REDACTED]';

  /**
   * `Authorization: Bearer <token>` 与裸 `Bearer <token>`。
   * 保留方案名，token 整体替换为 [REDACTED]。
   */
  private static readonly AUTH_HEADER_PATTERN =
    /(authorization\s*[:=]\s*)(?:bearer\s+)?[A-Za-z0-9._~+\/=\-*]+/gi;
  private static readonly BEARER_PATTERN =
    /\bbearer\s+[A-Za-z0-9._~+\/=\-*]+/gi;

  /**
   * 形如 `"<field>":"<value>"`（JSON）或 `<field>=<value>` 的敏感字段，
   * 将 VALUE 整体替换为 [REDACTED]。字段名大小写不敏感。
   */
  private static readonly SENSITIVE_FIELD_NAMES =
    'api[_-]?key|authorization|access[_-]?token|refresh[_-]?token|id[_-]?token|secret|client[_-]?secret|token|code';

  private static readonly SENSITIVE_FIELD_JSON_PATTERN = new RegExp(
    `("(?:${DataMaskingUtil.SENSITIVE_FIELD_NAMES})"\\s*:\\s*)"(?:[^"\\\\]|\\\\.)*"`,
    'gi',
  );
  private static readonly SENSITIVE_FIELD_KV_PATTERN = new RegExp(
    `\\b(${DataMaskingUtil.SENSITIVE_FIELD_NAMES})\\s*[:=]\\s*[^\\s,;&"'}{]+`,
    'gi',
  );

  /** JWT-like access token（eyJ... 三段式） */
  private static readonly ACCESS_TOKEN_PATTERN =
    /\b(?:eyJ[A-Za-z0-9_-]{10,}\.?[A-Za-z0-9_-]*\.?[A-Za-z0-9_-]*)\b/g;

  /**
   * 通用密钥/令牌文本脱敏 — 用于自由文本日志消息。
   *
   * 把字符串中出现的 Bearer token、JWT、以及敏感字段值
   * **整体**替换为 [REDACTED]（不保留前后缀、不保留长度提示）。
   */
  static redactSecrets(text: string): string {
    if (!text) return text;
    let out = text;

    // 1. Authorization 头（保留 "Authorization:" 前缀），须先于 KV 字段处理。
    out = out.replace(
      this.AUTH_HEADER_PATTERN,
      `Authorization: ${this.REDACTED}`,
    );

    // 2. 裸 Bearer token（保留 "Bearer" 方案名）
    out = out.replace(this.BEARER_PATTERN, `Bearer ${this.REDACTED}`);

    // 3. 敏感字段值（JSON / KV）→ 仅替换 value
    out = out.replace(
      this.SENSITIVE_FIELD_JSON_PATTERN,
      `$1"${this.REDACTED}"`,
    );
    out = out.replace(this.SENSITIVE_FIELD_KV_PATTERN, (_m, field: string) => {
      return `${field}=${this.REDACTED}`;
    });

    // 4. JWT-like token 兜底
    out = out.replace(this.ACCESS_TOKEN_PATTERN, this.REDACTED);

    return out;
  }

  /** API Key 脱敏 — 整体替换为 [REDACTED]。委托 redactSecrets。 */
  static maskApiKey(text: string): string {
    if (!text) return text;
    return this.redactSecrets(text);
  }

  // ==================== 单字段脱敏 ====================

  /** 邮箱脱敏: ab***@example.com */
  static maskEmail(email: string): string {
    if (!email || !email.includes('@')) return email;
    const [local, domain] = email.split('@');
    if (local.length <= 2) {
      return `${local[0]}***@${domain}`;
    }
    return `${local[0]}***${local[local.length - 1]}@${domain}`;
  }

  /** 手机号脱敏: 138****1234 */
  static maskPhone(phone: string): string {
    if (!phone || phone.length < 7) return phone;
    return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
  }

  /** 身份证号脱敏: 3201**********5678 */
  static maskIdCard(idCard: string): string {
    if (!idCard || idCard.length < 15) return idCard;
    return idCard.replace(/(\d{4})\d{10,}(\d{4})/, '$1**********$2');
  }

  /** IP 脱敏：IPv4 保留前三段，末段替换为 ***；IPv6 保留前三组 */
  static maskIp(ip: string | null | undefined): string | null {
    return _maskIp(ip);
  }

  // ==================== 通用文本脱敏 ====================

  /**
   * 对任意文本做敏感信息脱敏。
   *
   * 自动检测并脱敏：邮箱、电话号码。
   * 当 maskAccountLike = true 时，额外脱敏类似账号的字符串。
   */
  static maskText(value: string, maskAccountLike = false): string {
    if (!value) return value;
    let masked = value;

    masked = masked.replace(
      /([A-Z0-9._%+-]{1,2})[A-Z0-9._%+-]*(@[A-Z0-9.-]+\.[A-Z]{2,})/gi,
      '$1***$2',
    );

    masked = masked.replace(/(\+?\d[\d -]{6,}\d)/g, (match: string) => {
      const digits = match.replace(/\D/g, '');
      if (digits.length < 7) return match;
      return `${digits.slice(0, 3)}****${digits.slice(-2)}`;
    });

    if (maskAccountLike) {
      masked = masked.replace(
        /([A-Za-z0-9_-]{2})[A-Za-z0-9_-]{4,}([A-Za-z0-9_-]{2})/g,
        '$1****$2',
      );
    }

    return masked;
  }

  // ==================== 批量 / 结构化脱敏 ====================

  /** IP 相关的 key 名称 — 对这些 key 做 maskIp 而非完全替换 */
  private static readonly IP_KEY_PATTERN =
    /^(ip|ipAddress|ip_address|clientIp|client_ip|remoteAddr|remote_addr|lastLoginIp|last_login_ip|lastUsedIp|last_used_ip|lastIp|last_ip)$/i;

  /** 邮箱相关的 key 名称 — 对这些 key 做 maskEmail */
  private static readonly EMAIL_KEY_PATTERN =
    /^(email|userEmail|user_email|providerEmail|provider_email|contactEmail|contact_email|mail)$/i;

  /** 脱敏对象中匹配敏感 key 的值（password / token / secret 等） */
  static redactSensitiveKeys(
    data: Record<string, unknown>,
  ): Record<string, unknown> {
    const sensitiveKeys = [
      'password',
      'passwordHash',
      'token',
      'accessToken',
      'refreshToken',
      'rawToken',
      'secret',
      'apiKey',
      'apiToken',
      'secretKey',
      'authorization',
      'credential',
      'cookie',
      'session',
      'clientSecret',
      'signingSecret',
      'webhookSecret',
      'encryptionKey',
      'privateKey',
      'authToken',
      'loginCode',
      'authorizationCode',
    ];

    const result = { ...data };
    for (const key of Object.keys(result)) {
      if (
        sensitiveKeys.some((sk) => key.toLowerCase().includes(sk.toLowerCase()))
      ) {
        result[key] = '***REDACTED***';
      } else if (
        this.IP_KEY_PATTERN.test(key) &&
        typeof result[key] === 'string'
      ) {
        result[key] = this.maskIp(result[key]);
      } else if (
        this.EMAIL_KEY_PATTERN.test(key) &&
        typeof result[key] === 'string'
      ) {
        result[key] = this.maskEmail(result[key]);
      } else if (typeof result[key] === 'string') {
        // 自由文本字段值（message / error / stack 等）：扫描并整体替换
        // 内嵌的 token / Bearer token / 敏感字段值，防止密钥经由日志泄露。
        result[key] = this.redactSecrets(result[key]);
      } else if (Array.isArray(result[key])) {
        result[key] = (result[key] as unknown[]).map((item) =>
          typeof item === 'object' && item !== null
            ? this.redactSensitiveKeys(item as Record<string, unknown>)
            : item,
        );
      } else if (typeof result[key] === 'object' && result[key] !== null) {
        result[key] = this.redactSensitiveKeys(
          result[key] as Record<string, unknown>,
        );
      }
    }
    return result;
  }

  // ==================== 实体级便捷方法 ====================

  /** 对含 email 字段的对象做邮箱脱敏，返回新对象 */
  static maskEntityEmail<T extends { email?: string | null }>(entity: T): T {
    if (!entity?.email) return entity;
    return { ...entity, email: this.maskEmail(entity.email) };
  }

  /** 批量脱敏含 email 字段的对象数组 */
  static maskEntityEmails<T extends { email?: string | null }>(
    entities: T[],
  ): T[] {
    return entities.map((e) => this.maskEntityEmail(e));
  }

  // ==================== URL 脱敏 ====================

  /** 敏感 URL query 参数名（签名、token、凭据） */
  private static readonly SENSITIVE_URL_PARAMS = new Set([
    'token',
    'access_token',
    'refresh_token',
    'api_key',
    'apikey',
    'secret',
    'signature',
    'sig',
    'key',
    'auth',
    'authorization',
    'credential',
  ]);

  /**
   * 清理 URL 中的敏感 query 参数。
   *
   * 将签名、token 等参数值替换为 [REDACTED]，
   * 保留 URL 路径和非敏感参数。
   */
  static sanitizeUrl(url: string): string {
    if (!url) return url;
    try {
      const parsed = new URL(url);
      let redacted = false;
      for (const key of [...parsed.searchParams.keys()]) {
        if (this.SENSITIVE_URL_PARAMS.has(key.toLowerCase())) {
          parsed.searchParams.set(key, '[REDACTED]');
          redacted = true;
        }
      }
      return redacted ? parsed.toString() : url;
    } catch {
      return url;
    }
  }

  /**
   * 递归遍历对象/数组，对所有字符串值中的邮箱和电话做脱敏。
   *
   * 适用于非结构化 JSON 数据的脱敏。
   */
  static maskRawData<T>(data: T): T {
    if (data === null || data === undefined) return data;
    if (typeof data === 'string') return this.maskText(data) as T;
    if (Array.isArray(data))
      return data.map((item) => this.maskRawData(item)) as T;
    if (typeof data === 'object') {
      const result = { ...data } as Record<string, unknown>;
      for (const key of Object.keys(result)) {
        result[key] = this.maskRawData(result[key]);
      }
      return result as T;
    }
    return data;
  }
}
