/**
 * seed-system-configs — 基础系统配置项。
 *
 * 幂等：以 key 查重。
 */
import { DataSource } from 'typeorm';
import { SystemConfig, SystemConfigType } from '@domains/system';

interface ConfigSeed {
  key: string;
  value: string;
  type: SystemConfigType;
  group: string;
  description: string;
}

export const SYSTEM_CONFIG_SEEDS: ConfigSeed[] = [
  {
    key: 'site.name',
    value: 'Node Server Template',
    type: SystemConfigType.STRING,
    group: 'site',
    description: '站点名称',
  },
  {
    key: 'site.description',
    value: 'NestJS + TypeORM 单体模板',
    type: SystemConfigType.STRING,
    group: 'site',
    description: '站点描述',
  },
  {
    key: 'security.password.minLength',
    value: '8',
    type: SystemConfigType.NUMBER,
    group: 'security',
    description: '密码最小长度',
  },
  {
    key: 'security.password.requireComplexity',
    value: 'true',
    type: SystemConfigType.BOOLEAN,
    group: 'security',
    description: '是否要求密码包含大小写/数字/符号',
  },
  {
    key: 'security.login.maxAttempts',
    value: '5',
    type: SystemConfigType.NUMBER,
    group: 'security',
    description: '登录失败锁定阈值',
  },
  {
    key: 'auth.session.maxConcurrent',
    value: '5',
    type: SystemConfigType.NUMBER,
    group: 'auth',
    description: '单用户最大并发会话数',
  },
];

/** 执行系统配置 seed。 */
export async function seedSystemConfigs(dataSource: DataSource): Promise<void> {
  const repo = dataSource.getRepository(SystemConfig);
  console.log('  [system-configs] 填充系统配置...');
  for (const seed of SYSTEM_CONFIG_SEEDS) {
    const exists = await repo.findOne({ where: { key: seed.key } });
    if (!exists) {
      await repo.save(
        repo.create({
          key: seed.key,
          value: seed.value,
          type: seed.type,
          group: seed.group,
          description: seed.description,
        }),
      );
      console.log(`    + 配置 ${seed.key}`);
    }
  }
  console.log('  [system-configs] 完成。');
}
