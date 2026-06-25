/**
 * ESLint 规则：no-entity-response
 *
 * 控制器方法不得返回 TypeORM 实体（应返回 VO 或 void）。
 *
 * 启发式实现（无类型信息，轻量）：
 *   - 仅检查 *.controller.ts 文件。
 *   - 收集从 @domains/* 与 @platform/* 导入、且名称为裸 PascalCase（无 Vo/Dto/Service 等后缀）
 *     的标识符，视为「疑似实体」。
 *   - 若控制器方法的返回类型注解（含 Promise<T> / T[] / PageResultVo<T>）直接引用了这些标识符，则报错。
 *
 * 这是 P2 预设规则的功能骨架：以命名约定近似实体识别，避免误伤 VO（XxxVo）。
 */

type RuleModule = {
  meta: {
    type: 'problem';
    docs: { description: string };
    schema: unknown[];
    messages: Record<string, string>;
  };
  create: (context: any) => Record<string, (node: any) => void>;
};

const VO_DTO_SUFFIX =
  /(Vo|Dto|Result|Response|Type|Enum|Status|Module|Service|Mapper|Assembler)$/;

function looksLikeEntity(name: string): boolean {
  // PascalCase 且不带已知非实体后缀。
  return /^[A-Z][A-Za-z0-9]*$/.test(name) && !VO_DTO_SUFFIX.test(name);
}

/** 递归收集类型注解中引用的类型名。 */
function collectTypeNames(typeNode: any, acc: Set<string>): void {
  if (!typeNode) return;
  if (
    typeNode.type === 'TSTypeReference' &&
    typeNode.typeName?.type === 'Identifier'
  ) {
    acc.add(typeNode.typeName.name);
    const params = typeNode.typeParameters?.params ?? [];
    for (const p of params) collectTypeNames(p, acc);
  } else if (typeNode.type === 'TSArrayType') {
    collectTypeNames(typeNode.elementType, acc);
  } else if (
    typeNode.type === 'TSUnionType' ||
    typeNode.type === 'TSIntersectionType'
  ) {
    for (const t of typeNode.types ?? []) collectTypeNames(t, acc);
  }
}

const rule: RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: '控制器方法不得返回 TypeORM 实体（应返回 VO 或 void）',
    },
    schema: [],
    messages: {
      entityReturned:
        "控制器方法疑似返回实体 '{{name}}'。请改为返回 VO（XxxVo）或 void，由 mapper/assembler 转换。",
    },
  },
  create(context) {
    const filename: string = context.getFilename().replace(/\\/g, '/');
    if (!/\.controller\.ts$/.test(filename)) {
      return {};
    }
    const suspectedEntities = new Set<string>();

    return {
      ImportDeclaration(node: any) {
        const source: string = node.source.value ?? '';
        if (!/^@domains\//.test(source) && !/^@platform\//.test(source)) return;
        for (const spec of node.specifiers ?? []) {
          const name = spec.imported?.name ?? spec.local?.name;
          if (name && looksLikeEntity(name)) suspectedEntities.add(name);
        }
      },
      MethodDefinition(node: any) {
        const fn = node.value;
        const returnType = fn?.returnType?.typeAnnotation;
        if (!returnType) return;
        const names = new Set<string>();
        collectTypeNames(returnType, names);
        for (const name of names) {
          if (suspectedEntities.has(name)) {
            context.report({
              node: node.key,
              messageId: 'entityReturned',
              data: { name },
            });
          }
        }
      },
    };
  },
};

export default rule;
