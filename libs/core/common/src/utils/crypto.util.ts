import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const ENCRYPTED_PREFIX = 'enc:';
const DEFAULT_SALT = 'credential-salt';

/**
 * 凭据加密工具
 *
 * 使用 AES-256-GCM 对敏感字段进行加密/解密。
 * 密文格式：enc:<iv_hex>:<authTag_hex>:<ciphertext_hex>
 *
 * salt 优先级：构造参数 > 环境变量 CREDENTIAL_ENCRYPTION_SALT > 内置默认值。
 * 生产环境强烈建议通过环境变量提供独立 salt。
 */
export class CryptoUtil {
  private readonly derivedKey: Buffer;

  constructor(encryptionKey: string, salt?: string) {
    if (!encryptionKey || encryptionKey.length < 16) {
      throw new Error(
        'CREDENTIAL_ENCRYPTION_KEY must be at least 16 characters',
      );
    }
    const actualSalt =
      salt || process.env.CREDENTIAL_ENCRYPTION_SALT || DEFAULT_SALT;
    this.derivedKey = scryptSync(encryptionKey, actualSalt, 32);
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.derivedKey, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return `${ENCRYPTED_PREFIX}${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  decrypt(ciphertext: string): string {
    if (!this.isEncrypted(ciphertext)) {
      return ciphertext;
    }

    const withoutPrefix = ciphertext.slice(ENCRYPTED_PREFIX.length);
    const [ivHex, authTagHex, encrypted] = withoutPrefix.split(':');

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = createDecipheriv(ALGORITHM, this.derivedKey, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  isEncrypted(value: string): boolean {
    return typeof value === 'string' && value.startsWith(ENCRYPTED_PREFIX);
  }
}
