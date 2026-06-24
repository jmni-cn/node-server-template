import { join } from 'path';

/**
 * 运行时 i18n 文案目录解析。
 *
 * 开发态（ts-node / nest start）：直接指向 lib 源码内的 messages 目录。
 * 生产态（webpack 打包后）：copy-i18n.js 会把 messages 复制到
 * dist/apps/<APP_NAME>/i18n 与 dist/libs/core/i18n/messages，二者择优命中。
 */
function resolveMessagesPath(): string {
  const appName = process.env.APP_NAME || 'admin-api';
  const candidates = [
    // 源码目录（开发态，__dirname = libs/core/i18n/src）
    join(__dirname, 'messages'),
    // 打包后按应用拆分的目录
    join(process.cwd(), 'dist', 'apps', appName, 'i18n'),
    // 打包后 lib 目录
    join(process.cwd(), 'dist', 'libs', 'core', 'i18n', 'messages'),
  ];
  return candidates[0];
}

/** i18n 文案根目录 */
export const I18N_MESSAGES_PATH = resolveMessagesPath();
