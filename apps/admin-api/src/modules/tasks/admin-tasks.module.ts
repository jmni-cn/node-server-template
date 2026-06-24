import { Module } from '@nestjs/common';
import { TaskModule } from '@platform/task';
import { TasksController } from './tasks.controller';

/** 管理后台任务管理模块。 */
@Module({
  imports: [TaskModule],
  controllers: [TasksController],
})
export class AdminTasksModule {}
