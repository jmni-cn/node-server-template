import { LoggerService } from '@core/logger';
import { SSO_HTTP_TIMEOUT_MS } from '../constants';
import type { SsoProviderPort, SsoTokenSet } from '../types/sso-provider.port';

/**
 * SSO provider 抽象基类。
 *
 * 提供基于全局 `fetch` + `AbortController`（15s 超时）的 `httpGet` / `httpPost`
 * 工具，统一 `Accept: application/json`、表单/JSON content-type、!ok 时读取响应文本
 * 记录错误并抛 `Error(HTTP <status>: ...)`。
 *
 * 子类需实现 `name` / `buildAuthorizeUrl` / `exchangeCode` / `fetchUserInfo`，
 * 并通过构造函数获取各自的配置块。
 */
export abstract class BaseSsoProvider implements SsoProviderPort {
  abstract readonly name: string;

  constructor(protected readonly logger: LoggerService) {}

  abstract buildAuthorizeUrl(state: string, redirectUri?: string): string;
  abstract exchangeCode(
    code: string,
    redirectUri?: string,
  ): Promise<SsoTokenSet>;
  abstract fetchUserInfo(
    tokenSet: SsoTokenSet,
  ): Promise<Record<string, unknown>>;

  /** 发起 HTTP GET 请求（JSON 响应）。 */
  protected async httpGet<T>(
    url: string,
    headers?: Record<string, string>,
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SSO_HTTP_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json', ...headers },
        signal: controller.signal,
      });
      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`${this.name} HTTP GET failed`, {
          url,
          status: response.status,
          error: errorText,
        });
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * 发起 HTTP POST 请求（JSON 响应）。
   *
   * body 为 `URLSearchParams` 时使用 `application/x-www-form-urlencoded`，
   * 否则使用 `application/json`。
   */
  protected async httpPost<T>(
    url: string,
    body: URLSearchParams | Record<string, unknown>,
    headers?: Record<string, string>,
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SSO_HTTP_TIMEOUT_MS);
    try {
      const isForm = body instanceof URLSearchParams;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': isForm
            ? 'application/x-www-form-urlencoded'
            : 'application/json',
          ...headers,
        },
        body: isForm ? body.toString() : JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`${this.name} HTTP POST failed`, {
          url,
          status: response.status,
          error: errorText,
        });
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}
