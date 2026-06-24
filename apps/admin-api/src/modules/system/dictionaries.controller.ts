import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiArrayResponse, ApiBaseResponse } from '@core/common';
import { Permissions } from '@platform/auth';
import { OperationLogDecorator } from '@platform/audit';
import {
  CreateDictionaryDto,
  CreateDictionaryItemDto,
  DictionaryService,
  DictionaryVo,
  DictionaryDetailVo,
  DictionaryItemVo,
  UpdateDictionaryDto,
  UpdateDictionaryItemDto,
} from '@domains/system';

/** 管理后台字典管理控制器。 */
@ApiTags('字典管理')
@ApiBearerAuth('bearer')
@Permissions('sys:dict:*')
@Controller('dictionaries')
export class DictionariesController {
  constructor(private readonly dictionaryService: DictionaryService) {}

  @Get(':uid')
  @ApiOperation({ summary: '字典详情' })
  @ApiBaseResponse(DictionaryDetailVo)
  detail(@Param('uid') uid: string): Promise<DictionaryDetailVo> {
    return this.dictionaryService.getDictDetail(uid);
  }

  @Get('code/:code/items')
  @ApiOperation({ summary: '按字典编码取字典项' })
  @ApiArrayResponse(DictionaryItemVo)
  itemsByCode(@Param('code') code: string): Promise<DictionaryItemVo[]> {
    return this.dictionaryService.getItemsByCode(code);
  }

  @Post()
  @ApiOperation({ summary: '创建字典' })
  @OperationLogDecorator({ action: 'CREATE_DICT', module: 'Dictionaries' })
  @ApiBaseResponse(DictionaryVo)
  create(@Body() dto: CreateDictionaryDto): Promise<DictionaryVo> {
    return this.dictionaryService.createDict(dto);
  }

  @Patch(':uid')
  @ApiOperation({ summary: '更新字典' })
  @OperationLogDecorator({ action: 'UPDATE_DICT', module: 'Dictionaries' })
  @ApiBaseResponse(DictionaryVo)
  update(
    @Param('uid') uid: string,
    @Body() dto: UpdateDictionaryDto,
  ): Promise<DictionaryVo> {
    return this.dictionaryService.updateDict(uid, dto);
  }

  @Post('items')
  @ApiOperation({ summary: '新增字典项' })
  @OperationLogDecorator({ action: 'CREATE_DICT_ITEM', module: 'Dictionaries' })
  @ApiBaseResponse(DictionaryItemVo)
  addItem(@Body() dto: CreateDictionaryItemDto): Promise<DictionaryItemVo> {
    return this.dictionaryService.addItem(dto);
  }

  @Patch('items/:uid')
  @ApiOperation({ summary: '更新字典项' })
  @OperationLogDecorator({ action: 'UPDATE_DICT_ITEM', module: 'Dictionaries' })
  @ApiBaseResponse(DictionaryItemVo)
  updateItem(
    @Param('uid') uid: string,
    @Body() dto: UpdateDictionaryItemDto,
  ): Promise<DictionaryItemVo> {
    return this.dictionaryService.updateItem(uid, dto);
  }
}
