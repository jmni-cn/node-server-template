import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SystemConfigType } from '@platform/config';

/**
 * 配置定义目录视图对象（后台「键/默认/来源/业务含义」展示）。
 *
 * 由各消费 lib 通过 registerConfigDefinitions 注册的运行期配置定义聚合而来，
 * 并叠加 RuntimeConfigService 的当前解析结果（值 + 来源），便于后台一眼看清：
 * 某个键当前生效值是来自 DB 覆盖还是代码默认。
 *
 * 机密项（isSecret=true）的当前值脱敏为 null，避免泄露敏感值。
 */
export class ConfigDefinitionVo {
  @ApiProperty({ description: '配置键（全局唯一）' })
  key: string;

  @ApiProperty({ description: '配置分组' })
  group: string;

  @ApiProperty({ description: '展示标签（后台友好名称）' })
  label: string;

  @ApiPropertyOptional({ description: '配置描述（业务含义）' })
  description?: string;

  @ApiProperty({ description: '值类型', enum: SystemConfigType })
  valueType: SystemConfigType;

  @ApiProperty({
    description: '代码默认值（解析链最末端兜底值）',
    nullable: true,
  })
  defaultValue: unknown;

  @ApiProperty({ description: '是否机密（机密项当前值已脱敏）' })
  isSecret: boolean;

  @ApiProperty({ description: '是否可对外公开' })
  isPublic: boolean;

  @ApiProperty({ description: '是否允许后台编辑（false 表示只读）' })
  isEditable: boolean;

  @ApiProperty({
    description: '当前生效值（机密项已脱敏为 null）',
    nullable: true,
  })
  currentValue: unknown;

  @ApiProperty({
    description:
      '当前值来源: db(库覆盖) / code_default(代码默认) / disabled_fallback(行禁用回退) / error_fallback(异常回退)',
  })
  source: string;
}
