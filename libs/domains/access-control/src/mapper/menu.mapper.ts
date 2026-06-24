import { Menu } from '../entities/menu.entity';
import { MenuTreeVo, MenuVo } from '../vo/menu.vo';

/**
 * MenuMapper — Menu 实体到 MenuVo 的纯静态映射，并提供树构建辅助。
 */
export class MenuMapper {
  static toVo(menu: Menu): MenuVo {
    return {
      uid: menu.uid,
      parentId: menu.parentId,
      name: menu.name,
      path: menu.path,
      icon: menu.icon,
      sort: menu.sort,
      type: menu.type,
    };
  }

  static toVoArray(menus: Menu[]): MenuVo[] {
    return menus.map((m) => MenuMapper.toVo(m));
  }

  /**
   * 将扁平菜单列表按 parentId 嵌套为树（纯函数）。
   * 顶级节点为 parentId 为 null 或其父不在集合内的节点；同级按 sort 升序。
   */
  static buildTree(menus: Menu[]): MenuTreeVo[] {
    const nodeByUid = new Map<string, MenuTreeVo>();
    for (const menu of menus) {
      nodeByUid.set(menu.uid, { ...MenuMapper.toVo(menu), children: [] });
    }

    const roots: MenuTreeVo[] = [];
    for (const menu of menus) {
      const node = nodeByUid.get(menu.uid)!;
      const parent = menu.parentId ? nodeByUid.get(menu.parentId) : undefined;
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }

    const sortRecursively = (nodes: MenuTreeVo[]): void => {
      nodes.sort((a, b) => a.sort - b.sort);
      for (const n of nodes) {
        sortRecursively(n.children);
      }
    };
    sortRecursively(roots);

    return roots;
  }
}
