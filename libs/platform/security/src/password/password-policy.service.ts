import { Injectable, Optional } from '@nestjs/common';
import { BusinessException } from '@core/common';
import { SecurityErrorCode } from '../constants/security-error-codes';

/**
 * Configurable password policy options.
 */
export interface PasswordPolicyOptions {
  /** Minimum password length. Default: 8. */
  minLength?: number;
  /**
   * Minimum number of distinct character classes required out of
   * { lowercase, uppercase, digit, special }. Default: 3.
   */
  minCharClasses?: number;
}

export interface PasswordCheckResult {
  valid: boolean;
  reasons: string[];
}

const SPECIAL_RE = /[^A-Za-z0-9]/;

/**
 * Validates passwords against a configurable strength policy.
 */
@Injectable()
export class PasswordPolicyService {
  private readonly minLength: number;
  private readonly minCharClasses: number;

  constructor(@Optional() options?: PasswordPolicyOptions) {
    this.minLength = options?.minLength ?? 8;
    this.minCharClasses = options?.minCharClasses ?? 3;
  }

  /** Non-throwing strength check. */
  check(password: string): PasswordCheckResult {
    const reasons: string[] = [];

    if (!password || password.length < this.minLength) {
      reasons.push(`Password must be at least ${this.minLength} characters`);
    }

    const classes = this.countCharClasses(password ?? '');
    if (classes < this.minCharClasses) {
      reasons.push(
        `Password must contain at least ${this.minCharClasses} of: lowercase, uppercase, digit, special character`,
      );
    }

    return { valid: reasons.length === 0, reasons };
  }

  /**
   * Validate a password, throwing {@link BusinessException} with
   * {@link SecurityErrorCode.SEC_PASSWORD_TOO_WEAK} when it is too weak.
   */
  validate(password: string): void {
    const { valid, reasons } = this.check(password);
    if (!valid) {
      throw new BusinessException(SecurityErrorCode.SEC_PASSWORD_TOO_WEAK, {
        reasons,
      });
    }
  }

  private countCharClasses(password: string): number {
    let count = 0;
    if (/[a-z]/.test(password)) count += 1;
    if (/[A-Z]/.test(password)) count += 1;
    if (/[0-9]/.test(password)) count += 1;
    if (SPECIAL_RE.test(password)) count += 1;
    return count;
  }
}
