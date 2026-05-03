import { Body, Controller, Get, Post, Put, Param, Delete, Query } from '@nestjs/common';
import { AgentsService } from '../service/agents.service';
import { ResponseMessage, User } from 'src/common/decorator/decorators';
import type { IUser } from 'src/module/accounts/users.interface';
import { CreateAgentDto } from '../dto/create-agent.dto';
import { Agents } from '../schema/ai-center.schema';
import { ListAgentsQueryDto } from '../dto/list-agents-query.dto';
import { UpdateAgentDto } from '../dto/update-agent.dto';
import { RefineSystemPromptDto } from '../dto/refine-system-prompt.dto';
import { RefineEmailDto } from '../dto/refine-email.dto';

@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get()
  @ResponseMessage('Danh sách trợ lý theo workspace')
  findByWorkspace(
    @User() user: IUser,
    @Query() q: ListAgentsQueryDto,
  ) {
    return this.agentsService.findByWorkspace(user._id, q.workspace_id);
  }

  @Get(':id')
  findAgentById(
    @User() user: IUser,
    @Param('id') id: string,
    @Query() q: ListAgentsQueryDto,
  ): Promise<Agents> {
    return this.agentsService.findAgentById(user._id, id, q.workspace_id);
  }

  @Post()
  @ResponseMessage('Tạo trợ lý thành công')
  create(
    @User() user: IUser,
    @Body() createAgentDto: CreateAgentDto,
  ): Promise<Agents> {
    return this.agentsService.createAgent(user._id, createAgentDto);
  }

  @Put(':id')
  @ResponseMessage('Cập nhật trợ lý thành công')
  updateAgent(
    @User() user: IUser,
    @Param('id') id: string,
    @Body() updateAgentDto: UpdateAgentDto,
  ): Promise<Agents> {
    return this.agentsService.updateAgent(user._id, id, updateAgentDto);
  }

  @Delete(':id')
  @ResponseMessage('Xóa trợ lý thành công')
  deleteAgent(@User() user: IUser, @Param('id') id: string) {
    return this.agentsService.deleteAgent(user._id, id);
  }

  @Post('/refine-system-prompt')
  @ResponseMessage('Tối ưu hệ thống prompt thành công')
  refineSystemPrompt(@Body() dto: RefineSystemPromptDto) {
    return this.agentsService.refineSystemPrompt(dto.systemPromptOfUser);
  }

  @Post('/refine-email')
  @ResponseMessage('Tối ưu email thành công')
  refineEmail(@Body() dto: RefineEmailDto) {
    return this.agentsService.refineEmailDraft(dto.emailBody);
  }
}
