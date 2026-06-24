import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

/**
 * Password hashing service backed by bcrypt.
 */
@Injectable()
export class PasswordHasherService {
  /** Hash a plaintext password. */
  async hash(plain: string): Promise<string> {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    return bcrypt.hash(plain, salt);
  }

  /** Compare a plaintext password against a stored bcrypt hash. */
  async compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
