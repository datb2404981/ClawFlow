import { Types } from 'mongoose';
import { MemoryFlowService } from './memory-flow.service';

describe('MemoryFlowService', () => {
  const mk = () => {
    const eventModel = {
      countDocuments: jest.fn().mockResolvedValue(3),
      findOne: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }),
          }),
        }),
      }),
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }),
      insertMany: jest.fn().mockResolvedValue(undefined),
    };
    const summaryModel = {
      countDocuments: jest.fn().mockResolvedValue(2),
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }),
      updateOne: jest.fn().mockResolvedValue(undefined),
    };
    const factModel = {
      countDocuments: jest.fn().mockResolvedValue(1),
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }),
      updateOne: jest.fn().mockResolvedValue(undefined),
    };
    return {
      svc: new MemoryFlowService(
        eventModel as never,
        summaryModel as never,
        factModel as never,
      ),
      eventModel,
      summaryModel,
      factModel,
    };
  };

  it('rankPacketsForQuery ưu tiên packet liên quan query', () => {
    const { svc } = mk();
    const ranked = svc.rankPacketsForQuery('nestjs memory context', [
      { source: 's1', text: 'nestjs memory context', score: 0.5 },
      { source: 's2', text: 'random unrelated', score: 0.8 },
    ]);
    expect(ranked[0]?.source).toBe('s1');
  });

  it('buildMemoryContext trả block MEMORY CONTEXT', async () => {
    const { svc, summaryModel, factModel } = mk();
    summaryModel.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([
              {
                scope: 'thread',
                summary_text: 'Đã xử lý tuyển sinh CT2.',
                confidence: 0.8,
                last_event_at: new Date(),
              },
            ]),
          }),
        }),
      }),
    });
    factModel.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([
              {
                key: 'current_project',
                value: 'ClawFlow Admissions',
                confidence: 0.7,
                updated_at: new Date(),
              },
            ]),
          }),
        }),
      }),
    });

    const text = await svc.buildMemoryContext({
      workspaceId: new Types.ObjectId(),
      userId: new Types.ObjectId(),
      threadId: 'thread-1',
      userQuery: 'CT2 chỉ tiêu',
      currentMessages: [{ role: 'user', content: 'Hỏi chỉ tiêu CT2' }],
    });
    expect(text).toContain('### MEMORY CONTEXT');
    expect(text).toContain('Long-term/Episodic');
  });

  it('smokeCheckMemory trả số lượng thread/workspace/user', async () => {
    const { svc } = mk();
    const out = await svc.smokeCheckMemory(
      new Types.ObjectId(),
      new Types.ObjectId(),
      'thread-1',
    );
    expect(out).toEqual({ summaries: 2, facts: 1, events: 3 });
  });
});
