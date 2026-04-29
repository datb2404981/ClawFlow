import 'tsconfig-paths/register';
import { Types } from 'mongoose';
import { TasksService } from './tasks.service';
import type { WorkspacesService } from 'src/module/accounts/service/workspaces.service';

describe('Approval Draft+Execute flow (MVP)', () => {
  const workspaceId = new Types.ObjectId().toHexString();
  const userId = new Types.ObjectId().toHexString();
  const agentId = new Types.ObjectId().toHexString();

  const taskIdObj = new Types.ObjectId();
  const taskId = taskIdObj.toHexString();

  const makeTaskDoc = (overrides?: Partial<any>) => {
    return {
      _id: taskIdObj,
      workspace_id: new Types.ObjectId(workspaceId),
      created_by: new Types.ObjectId(userId),
      agent_id: new Types.ObjectId(agentId),
      thread_id: taskId,
      title: 'test',
      description: 'prompt',
      status: 'waiting_human_input',
      draft_payload: null,
      result: null,
      compiled_prompt: null,
      messages: [],
      createdAt: new Date(),
      ...overrides,
    };
  };

  const taskModelMock: any = {
    findOne: jest.fn(),
    findById: jest.fn(),
    updateOne: jest.fn(),
  };

  const agentsModelMock: any = {};
  const knowledgeChunkModelMock: any = {};
  const skillTemplateModelMock: any = {};

  const workspacesServiceMock: Partial<WorkspacesService> = {
    findOne: jest.fn().mockResolvedValue({}),
  };

  const aiCoreServiceMock: any = {
    chatWithAiStream: jest.fn(),
  };

  const geminiEmbeddingServiceMock: any = {};
  const memoryFlowServiceMock: any = {
    ingestTaskOutcome: jest.fn().mockResolvedValue(undefined),
    logMemoryError: jest.fn(),
  };
  const tasksGatewayMock: any = {
    emitTaskStatus: jest.fn(),
    emitTaskStream: jest.fn(),
  };
  const tasksQueueMock: any = {
    add: jest.fn(),
  };

  const thirdPartyExecutorMock: any = {
    executeActionPlanMvp: jest.fn(),
  };

  const usersServiceMock: any = {
    getAppSettings: jest.fn().mockResolvedValue({
      integration_gmail_enabled: true,
      integration_google_calendar_enabled: true,
      integration_drive_enabled: true,
      integration_notion_enabled: true,
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function buildService() {
    return new TasksService(
      taskModelMock,
      agentsModelMock,
      knowledgeChunkModelMock,
      skillTemplateModelMock,
      workspacesServiceMock as any,
      aiCoreServiceMock,
      geminiEmbeddingServiceMock,
      memoryFlowServiceMock,
      tasksGatewayMock,
      tasksQueueMock,
      thirdPartyExecutorMock,
      usersServiceMock,
    );
  }

  it('humanAnswer: không ingest MemoryEvent và tạo draft loop state đúng', async () => {
    const taskDoc = makeTaskDoc({
      status: 'waiting_human_input',
    });

    taskModelMock.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(taskDoc),
    });
    taskModelMock.findById.mockReturnValue({
      lean: () => ({
        exec: jest.fn().mockResolvedValue({
          ...taskDoc,
          status: 'waiting_execute_approval',
          result: 'USER_VISIBLE',
        }),
      }),
    });
    taskModelMock.updateOne.mockResolvedValue({} as any);

    const aiText =
      'USER_VISIBLE\n\n<!--CF_ACTION_PLAN_START-->' +
      JSON.stringify({
        requires_human: false,
        questions: [],
        actions: [{ type: 'gmail_send' }],
      }) +
      '<!--CF_ACTION_PLAN_END-->';

    aiCoreServiceMock.chatWithAiStream.mockResolvedValue(aiText);

    const svc = buildService();
    const updated = await svc.humanAnswer(userId, taskId, workspaceId, '{"q1":"a1"}');

    expect(memoryFlowServiceMock.ingestTaskOutcome).not.toHaveBeenCalled();
    expect(aiCoreServiceMock.chatWithAiStream).toHaveBeenCalled();
    expect(tasksGatewayMock.emitTaskStatus).toHaveBeenCalledWith(
      workspaceId,
      taskId,
      'waiting_execute_approval',
      'USER_VISIBLE',
    );
    expect(updated).toBeTruthy();
  });

  it('approveTask: gọi connector + ingest memory sau khi approve', async () => {
    const taskDoc = makeTaskDoc({
      status: 'waiting_execute_approval',
      draft_payload: JSON.stringify({
        requires_human: false,
        actions: [{ type: 'gmail_send', payload: { to: 'a@b.com' } }],
      }),
      messages: [],
    });

    taskModelMock.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(taskDoc),
    });
    taskModelMock.findById.mockReturnValue({
      lean: () => ({
        exec: jest.fn().mockResolvedValue({
          ...taskDoc,
          status: 'completed',
        }),
      }),
    });
    taskModelMock.updateOne.mockResolvedValue({} as any);

    thirdPartyExecutorMock.executeActionPlanMvp.mockResolvedValue({
      executeResultText: 'EXECUTE_OK',
      executionLog: '{"log":true}',
    });

    const svc = buildService();
    await svc.approveTask(userId, taskId, workspaceId);

    expect(thirdPartyExecutorMock.executeActionPlanMvp).toHaveBeenCalled();
    expect(memoryFlowServiceMock.ingestTaskOutcome).toHaveBeenCalledTimes(1);
    expect(memoryFlowServiceMock.ingestTaskOutcome).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'completed',
        assistantAnswer: 'EXECUTE_OK',
      }),
    );
    expect(tasksGatewayMock.emitTaskStatus).toHaveBeenCalledWith(
      workspaceId,
      taskId,
      'completed',
      'EXECUTE_OK',
    );
  });

  it('compileAndRunTaskById: waiting_execute_approval thì bỏ qua (no-execute-before-approve)', async () => {
    const taskDoc = makeTaskDoc({
      status: 'waiting_execute_approval',
    });

    taskModelMock.findById.mockResolvedValue(taskDoc);

    const svc = buildService();
    await svc.compileAndRunTaskById(taskDoc._id.toHexString());

    expect(aiCoreServiceMock.chatWithAiStream).not.toHaveBeenCalled();
    expect(memoryFlowServiceMock.ingestTaskOutcome).not.toHaveBeenCalled();
    expect(tasksGatewayMock.emitTaskStatus).not.toHaveBeenCalled();
  });
});

