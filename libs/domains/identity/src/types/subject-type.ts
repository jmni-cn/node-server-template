/**
 * SubjectType — 身份主体类型。
 *
 * 区分后台管理员（admin）与终端用户（user）。共享卫星表（凭证/会话/安全事件/
 * 外部身份）通过 `subjectType` 判别列区分归属。该值与 JWT 的 `typ` claim 一致。
 */
export type SubjectType = 'admin' | 'user';

/** 全部主体类型常量元组（用于校验 / 遍历）。 */
export const SUBJECT_TYPES = ['admin', 'user'] as const;
