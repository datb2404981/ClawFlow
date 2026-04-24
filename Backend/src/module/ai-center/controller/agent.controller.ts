import { Body, Controller, Get, Post, Put, Param, Delete } from '@nestjs/common';
import { AgentsService } from '../service/agents.service';
import { ResponseMessage, User } from 'src/common/decorator/decorators';
import type { IUser } from 'src/module/accounts/users.interface';
import { CreateAgentDto } from '../dto/create-agent.dto';
import { Agents } from '../schema/ai-center.schema';
import { UpdateAgentDto } from '../dto/update-agent.dto';

@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get(':id')
  findAgentById(@Param('id') id: string): Promise<Agents> {
    return this.agentsService.findAgentById(id);
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
  deleteAgent(@Param('id') id: string){
    return this.agentsService.deleteAgent(id);
  }
}
