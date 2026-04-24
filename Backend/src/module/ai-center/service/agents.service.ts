import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { toObjectId } from 'src/common/util/object-id.util';
import { WorkspacesService } from 'src/module/accounts/service/workspaces.service';
import {
  SkillTemplate,
  SkillTemplateDocument,
} from '../schema/skill-template.schema';
import { Agents, AgentsDocument } from '../schema/ai-center.schema';
import { CreateAgentDto } from '../dto/create-agent.dto';
import { UpdateAgentDto } from '../dto/update-agent.dto';
import { resolveAttachableTemplateIds } from './resolve-attachable-template-ids';

function pickEnabledTemplateIds(
  dto: Pick<CreateAgentDto | UpdateAgentDto, 'enabled_skill_template_ids'>,
): string[] | undefined {
  return dto.enabled_skill_template_ids;
}

function withoutEnabledTemplateIds<T extends { enabled_skill_template_ids?: string[] }>(
  dto: T,
): Omit<T, 'enabled_skill_template_ids'> {
  const { enabled_skill_template_ids, ...rest } = dto;
  void enabled_skill_template_ids;
  return rest;
}

@Injectable()
export class AgentsService {
  constructor(
    @InjectModel(Agents.name) private agentsModel: Model<AgentsDocument>,
    @InjectModel(SkillTemplate.name)
    private readonly skillTemplateModel: Model<SkillTemplateDocument>,
    private readonly workspacesService: WorkspacesService,
  ) {}

  async createAgent(
    userId: string,
    createAgentDto: CreateAgentDto,
  ): Promise<Agents> {
    const rest = withoutEnabledTemplateIds(createAgentDto);
    const enabled_skill_template_ids = pickEnabledTemplateIds(createAgentDto);
    await this.workspacesService.findOne(userId, createAgentDto.workspace_id);

    const existing = await this.agentsModel.findOne({
      name: createAgentDto.name,
    });
    if (existing) {
      throw new ConflictException('Trợ lý đã tồn tại');
    }

    const workspaceOid = toObjectId(createAgentDto.workspace_id);
    const templateOids = await resolveAttachableTemplateIds(
      this.skillTemplateModel,
      userId,
      workspaceOid,
      enabled_skill_template_ids,
    );

    const doc = await this.agentsModel.create({
      ...rest,
      enabled_skill_template_ids: templateOids,
    });
    return doc.toJSON() as Agents;
  }

  async findAgentById(_id: string): Promise<Agents> {
    const agent = await this.agentsModel
      .findOne({ _id })
      .populate('enabled_skill_template_ids')
      .exec();
    if (!agent) {
      throw new NotFoundException('Trợ lý không tồn tại');
    }
    return agent.toJSON() as Agents;
  }

  async updateAgent(
    userId: string,
    _id: string,
    updateAgentDto: UpdateAgentDto,
  ): Promise<Agents> {
    const existing = await this.agentsModel.findById(_id);
    if (!existing) {
      throw new NotFoundException('Trợ lý không tồn tại');
    }
    await this.workspacesService.findOne(userId, String(existing.workspace_id));

    const other = withoutEnabledTemplateIds(updateAgentDto);
    const enabled_skill_template_ids = pickEnabledTemplateIds(updateAgentDto);
    const setPayload: Record<string, unknown> = { ...other };
    if (enabled_skill_template_ids !== undefined) {
      setPayload.enabled_skill_template_ids = await resolveAttachableTemplateIds(
        this.skillTemplateModel,
        userId,
        existing.workspace_id,
        enabled_skill_template_ids,
      );
    }
    const agent = await this.agentsModel.findOneAndUpdate(
      { _id },
      { $set: setPayload },
      { new: true },
    );
    if (!agent) {
      throw new NotFoundException('Trợ lý không tồn tại');
    }
    return agent.toJSON() as Agents;
  }

  async deleteAgent(_id: string) {
    const agent = await this.agentsModel.findOneAndDelete({ _id });
    if (!agent) {
      throw new NotFoundException('Trợ lý không tồn tại');
    }
    return "OK";
  }
}
