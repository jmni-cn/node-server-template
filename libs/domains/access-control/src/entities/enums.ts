/**
 * 访问控制域枚举定义。
 */

/**
 * 菜单类型。
 * - DIRECTORY: 目录（仅用于分组，可包含子节点）
 * - MENU: 菜单（对应一个可路由页面）
 * - BUTTON: 按钮（页面内的操作权限点）
 */
export enum MenuType {
  DIRECTORY = 'directory',
  MENU = 'menu',
  BUTTON = 'button',
}
