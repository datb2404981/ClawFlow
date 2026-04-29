import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ResponseMessage, User } from 'src/common/decorator/decorators';
import type { IUser } from 'src/module/accounts/users.interface';
import { CreateTaskDto } from '../dto/create-task.dto';
import { ListTasksQueryDto } from '../dto/list-tasks-query.dto';
import { TaskScopeQueryDto } from '../dto/task-scope-query.dto';
import { UpdateTaskDto } from '../dto/update-task.dto';
import { AppendTaskMessageDto } from '../dto/append-task-message.dto';
import { HumanAnswerDto } from '../dto/human-answer.dto';
import { TasksService } from '../service/tasks.service';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @ResponseMessage('Tạo task thành công')
  create(
    @User() user: IUser,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasksService.create(user._id, dto);
  }

  @Post(':taskId/messages')
  @ResponseMessage('Đã gửi tin nhắn')
  appendMessage(
    @User() user: IUser,
    @Param('taskId') taskId: string,
    @Query() q: TaskScopeQueryDto,
    @Body() dto: AppendTaskMessageDto,
  ) {
    return this.tasksService.appendUserMessage(
      user._id,
      taskId,
      q.workspace_id,
      dto.content,
    );
  }

  @Get()
  @ResponseMessage('Danh sách task')
  findAll(
    @User() user: IUser,
    @Query() q: ListTasksQueryDto,
  ) {
    return this.tasksService.findAllByWorkspace(user._id, q);
  }

  @Get(':taskId')
  @ResponseMessage('Chi tiết task')
  findOne(
    @User() user: IUser,
    @Param('taskId') taskId: string,
    @Query() q: TaskScopeQueryDto,
  ) {
    return this.tasksService.findOne(user._id, taskId, q.workspace_id);
  }

  @Patch(':taskId')
  @ResponseMessage('Cập nhật task thành công')
  update(
    @User() user: IUser,
    @Param('taskId') taskId: string,
    @Query() q: TaskScopeQueryDto,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.update(user._id, taskId, q.workspace_id, dto);
  }

  @Post(':taskId/human-answer')
  @ResponseMessage('Đã gửi câu trả lời cho AI (draft loop)')
  humanAnswer(
    @User() user: IUser,
    @Param('taskId') taskId: string,
    @Query() q: TaskScopeQueryDto,
    @Body() dto: HumanAnswerDto,
  ) {
    return this.tasksService.humanAnswer(
      user._id,
      taskId,
      q.workspace_id,
      dto.answer,
    );
  }

  @Post(':taskId/approve')
  @ResponseMessage('Đã approve task')
  approve(
    @User() user: IUser,
    @Param('taskId') taskId: string,
    @Query() q: TaskScopeQueryDto,
  ) {
    return this.tasksService.approveTask(user._id, taskId, q.workspace_id);
  }

  @Post(':taskId/reject')
  @ResponseMessage('Đã reject task')
  reject(
    @User() user: IUser,
    @Param('taskId') taskId: string,
    @Query() q: TaskScopeQueryDto,
  ) {
    return this.tasksService.rejectTask(user._id, taskId, q.workspace_id);
  }

  @Delete(':taskId')
  @ResponseMessage('Xóa task thành công')
  remove(
    @User() user: IUser,
    @Param('taskId') taskId: string,
    @Query() q: TaskScopeQueryDto,
  ) {
    return this.tasksService.remove(user._id, taskId, q.workspace_id);
  }
}
