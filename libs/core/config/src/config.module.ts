import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as path from 'path';
import { configNamespaces } from './namespaces';
import { configValidationSchema } from './config.validation';

const nodeEnv = process.env.NODE_ENV || 'production';

/**
 * 应用配置模块（全局）。
 * 加载所有配置命名空间并执行 Joi 校验；
 * 开发环境从 env/<APP_NAME>.local.env 读取，生产环境读取真实环境变量。
 */
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: configNamespaces,
      cache: true,
      validationSchema: configValidationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
      expandVariables: true,
      envFilePath: nodeEnv === 'production' ? [] : getEnvFilePath(),
      ignoreEnvFile: nodeEnv === 'production',
    }),
  ],
  exports: [ConfigModule],
})
export class AppConfigModule {}

function getEnvFilePath(): string[] {
  const appName = process.env.APP_NAME || 'admin-api';
  const envFiles: string[] = [];

  if (nodeEnv === 'development') {
    // 开发环境特定配置：env/<APP_NAME>.local.env
    envFiles.push(path.join(process.cwd(), `env/${appName}.local.env`));
  }

  // 生产环境（NODE_ENV=production）走真实环境变量，不读文件
  if (nodeEnv === 'production') {
    return [];
  }
  return envFiles;
}
