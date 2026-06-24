/**
 * seed-dictionaries — 基础数据字典及字典项。
 *
 * 幂等：字典以 code 查重；字典项以 dictId+value 查重。
 */
import { DataSource } from 'typeorm';
import {
  Dictionary,
  DictionaryItem,
  DictionaryItemStatus,
} from '@domains/system';

interface DictItemSeed {
  label: string;
  value: string;
  sort: number;
}

interface DictSeed {
  code: string;
  name: string;
  description: string;
  items: DictItemSeed[];
}

export const DICTIONARY_SEEDS: DictSeed[] = [
  {
    code: 'user_status',
    name: '用户状态',
    description: '用户账户状态枚举',
    items: [
      { label: '正常', value: 'active', sort: 0 },
      { label: '已禁用', value: 'disabled', sort: 1 },
    ],
  },
  {
    code: 'gender',
    name: '性别',
    description: '性别枚举',
    items: [
      { label: '未知', value: 'unknown', sort: 0 },
      { label: '男', value: 'male', sort: 1 },
      { label: '女', value: 'female', sort: 2 },
    ],
  },
];

/** 执行字典 seed。 */
export async function seedDictionaries(dataSource: DataSource): Promise<void> {
  const dictRepo = dataSource.getRepository(Dictionary);
  const itemRepo = dataSource.getRepository(DictionaryItem);

  console.log('  [dictionaries] 填充字典...');
  for (const seed of DICTIONARY_SEEDS) {
    let dict = await dictRepo.findOne({ where: { code: seed.code } });
    if (!dict) {
      dict = await dictRepo.save(
        dictRepo.create({
          code: seed.code,
          name: seed.name,
          description: seed.description,
        }),
      );
      console.log(`    + 字典 ${seed.code}`);
    }
    for (const item of seed.items) {
      const exists = await itemRepo.findOne({
        where: { dictId: dict.uid, value: item.value },
      });
      if (!exists) {
        await itemRepo.save(
          itemRepo.create({
            dictId: dict.uid,
            label: item.label,
            value: item.value,
            sort: item.sort,
            status: DictionaryItemStatus.ENABLED,
          }),
        );
        console.log(`      + 字典项 ${seed.code}.${item.value}`);
      }
    }
  }
  console.log('  [dictionaries] 完成。');
}
