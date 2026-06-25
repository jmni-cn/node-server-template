import { existsSync } from 'fs';
import { join } from 'path';

/**
 * 运行时 i18n 文案目录解析。
 *
 * 开发态（ts-node / nest start）：__dirname 指向 lib 源码目录，命中源码内 messages。
 * 生产态（webpack 打包后）：__dirname 指向 dist/apps/<APP_NAME>，copy-i18n.js 已把
 * messages 复制到 dist/apps/<APP_NAME>/i18n 与 dist/libs/core/i18n/messages。
 *
 * 因此必须返回**第一个真实存在**的候选目录，而非固定取第一个——否则生产态会解析到
 * 不存在的 dist/apps/<APP_NAME>/messages，导致 nestjs-i18n 抛 "i18n path cannot be found"。
 */
function resolveMessagesPath(): string {
  const appName = process.env.APP_NAME || 'admin-api';
  const candidates = [
    // 源码目录（开发态，__dirname = libs/core/i18n/src）
    join(__dirname, 'messages'),
    // 打包后按应用拆分的目录（copy-i18n.js 写入）
    join(process.cwd(), 'dist', 'apps', appName, 'i18n'),
    // 打包后 lib 兜底目录（copy-i18n.js 写入）
    join(process.cwd(), 'dist', 'libs', 'core', 'i18n', 'messages'),
  ];
  // 取第一个真实存在的目录；都不存在时回退首项（保持 watch 模式语义）。
  return candidates.find((p) => existsSync(p)) ?? candidates[0];
}

/** i18n 文案根目录 */
export const I18N_MESSAGES_PATH = resolveMessagesPath();
