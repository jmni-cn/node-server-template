import { registerAs } from '@nestjs/config';
import * as Joi from 'joi';
import { DATABASE_DEFAULTS, DATABASE_CONSTANTS } from './constants';

/**
 * 数据库配置命名空间
 */
export const databaseConfig = registerAs('database', () => ({
  type: DATABASE_CONSTANTS.TYPE,
  host: process.env.DB_HOST ?? DATABASE_DEFAULTS.HOST,
  port: parseInt(process.env.DB_PORT ?? String(DATABASE_DEFAULTS.PORT), 10),
  username: process.env.DB_USERNAME ?? DATABASE_DEFAULTS.USERNAME,
  password: process.env.DB_PASSWORD ?? DATABASE_DEFAULTS.PASSWORD,
  database: process.env.DB_DATABASE ?? DATABASE_DEFAULTS.DATABASE,
  logging: DATABASE_CONSTANTS.LOGGING,
  charset: DATABASE_CONSTANTS.CHARSET,
  collation: DATABASE_CONSTANTS.COLLATION,
  timezone: DATABASE_CONSTANTS.TIMEZONE,
  extra: {
    connectionLimit: parseInt(
      process.env.DB_CONNECTION_LIMIT ??
        String(DATABASE_DEFAULTS.CONNECTION_LIMIT),
      10,
    ),
  },
}));

/**
 * 数据库配置接口
 */
export interface DatabaseConfigType {
  type: 'mysql';
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  logging: boolean;
  charset: string;
  collation: string;
  timezone: string;
  extra: {
    connectionLimit: number;
  };
}

/**
 * 数据库配置验证 Schema
 */
export const databaseConfigSchema = {
  DB_HOST: Joi.string()
    .default(DATABASE_DEFAULTS.HOST)
    .description('数据库主机'),
  DB_PORT: Joi.number()
    .port()
    .default(DATABASE_DEFAULTS.PORT)
    .description('数据库端口'),
  DB_USERNAME: Joi.string()
    .default(DATABASE_DEFAULTS.USERNAME)
    .description('数据库用户名'),
  DB_PASSWORD: Joi.string()
    .allow('')
    .default(DATABASE_DEFAULTS.PASSWORD)
    .description('数据库密码'),
  DB_DATABASE: Joi.string()
    .default(DATABASE_DEFAULTS.DATABASE)
    .description('数据库名称'),
  DB_LOGGING: Joi.boolean()
    .default(DATABASE_CONSTANTS.LOGGING)
    .description('是否开启 SQL 日志'),
  DB_CHARSET: Joi.string()
    .default(DATABASE_CONSTANTS.CHARSET)
    .description('数据库字符集'),
  DB_COLLATION: Joi.string()
    .default(DATABASE_CONSTANTS.COLLATION)
    .description('数据库校对集'),
  DB_TIMEZONE: Joi.string()
    .default(DATABASE_CONSTANTS.TIMEZONE)
    .description('数据库时区'),
  DB_CONNECTION_LIMIT: Joi.number()
    .integer()
    .min(1)
    .default(DATABASE_DEFAULTS.CONNECTION_LIMIT)
    .description('数据库连接池最大连接数'),
};
