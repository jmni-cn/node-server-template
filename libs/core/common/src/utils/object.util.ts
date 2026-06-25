/**
 * 通用对象 / 类型守卫工具 — 纯函数，零依赖。
 *
 * 供 mapper / assembler / DTO `toQueryParams` 等在构建、裁剪、收窄对象时复用，
 * 避免各处重复手写 null 判断与字段挑选逻辑（mapper 仍需保持无副作用：
 * 这些函数均返回新对象，不修改入参）。
 */

/** 值是否为 null 或 undefined。 */
export function isNil(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

/** 值是否既不是 null 也不是 undefined（携带类型收窄）。 */
export function isNotNil<T>(value: T): value is NonNullable<T> {
  return value !== null && value !== undefined;
}

/**
 * 是否为「普通对象」（对象字面量 / `Object.create(null)`）。
 * 排除 null、数组、Date、Map、Set、类实例等。
 */
export function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const proto = Object.getPrototypeOf(value) as object | null;
  return proto === Object.prototype || proto === null;
}

/**
 * 对象是否为空（无自身可枚举属性）。
 * null / undefined 视为空。
 */
export function isEmptyObject(value: unknown): boolean {
  if (isNil(value)) {
    return true;
  }
  if (typeof value !== 'object') {
    return false;
  }
  return Object.keys(value).length === 0;
}

/**
 * 从对象中挑选指定 key，返回新对象（不修改原对象）。
 *
 * @example
 * ```typescript
 * pick(user, ['id', 'email']); // { id, email }
 * ```
 */
export function pick<T extends object, K extends keyof T>(
  obj: T,
  keys: readonly K[],
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * 从对象中剔除指定 key，返回新对象（不修改原对象）。
 *
 * @example
 * ```typescript
 * omit(user, ['passwordHash']); // 去掉敏感字段
 * ```
 */
export function omit<T extends object, K extends keyof T>(
  obj: T,
  keys: readonly K[],
): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}

/**
 * 移除对象中值为 null / undefined 的字段，返回新对象（浅层）。
 *
 * 适用于构建查询参数、PATCH 局部更新等「仅提交有值字段」的场景。
 *
 * @example
 * ```typescript
 * removeNullish({ a: 1, b: null, c: undefined }); // { a: 1 }
 * ```
 */
export function removeNullish<T extends object>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  for (const key of Object.keys(obj) as (keyof T)[]) {
    const value = obj[key];
    if (value !== null && value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}
