import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  MemoryEvent,
  MemoryEventDocument,
  MemoryFact,
  MemoryFactDocument,
  MemorySummary,
  MemorySummaryDocument,
} from '../schema/memory.schema';

type TaskMessageLike = { role?: string; content?: string; createdAt?: Date };

type MemoryContextInput = {
  workspaceId: Types.ObjectId;
  userId: Types.ObjectId;
  threadId: string;
  userQuery: string;
  currentMessages: TaskMessageLike[];
};

type MemoryPacket = {
  source: string;
  text: string;
  score: number;
};

type TaskOutcomeInput = {
  workspaceId: Types.ObjectId;
  userId: Types.ObjectId;
  threadId: string;
  taskId: Types.ObjectId;
  status: 'completed' | 'failed';
  userPrompt: string;
  assistantAnswer: string;
  messages: TaskMessageLike[];
};

@Injectable()
export class MemoryFlowService {
  private readonly logger = new Logger(MemoryFlowService.name);

  constructor(
    @InjectModel(MemoryEvent.name)
    private readonly memoryEventModel: Model<MemoryEventDocument>,
    @InjectModel(MemorySummary.name)
    private readonly memorySummaryModel: Model<MemorySummaryDocument>,
    @InjectModel(MemoryFact.name)
    private readonly memoryFactModel: Model<MemoryFactDocument>,
  ) {}

  private normalizeText(t: string): string {
    return (t || '').replace(/\s+/g, ' ').trim();
  }

  private truncate(t: string, max = 1600): string {
    if (t.length <= max) return t;
    return `${t.slice(0, max)}…`;
  }

  private extractTags(query: string): string[] {
    const words = (query || '')
      .toLowerCase()
      .split(/[\s.,!?;:"()[\]{}]+/g)
      .filter((w) => w.length >= 4)
      .slice(0, 8);
    return [...new Set(words)];
  }

  private extractFacts(userPrompt: string, answer: string): Array<{ key: string; value: string; confidence: number }> {
    const out: Array<{ key: string; value: string; confidence: number }> = [];
    const user = userPrompt.toLowerCase();
    const ans = answer;

    const mName = user.match(/\b(?:tôi|tui|mình|anh|chị|em)\s+tên\s+([A-ZÀ-Ỹ][\wÀ-ỹ\s]{1,40})/i);
    if (mName?.[1]) {
      out.push({ key: 'user_name', value: this.normalizeText(mName[1]), confidence: 0.8 });
    }

    const mProject = user.match(/\b(?:dự án|project)\s+(?:là|tên)\s+([^\n.,]{2,80})/i);
    if (mProject?.[1]) {
      out.push({ key: 'current_project', value: this.normalizeText(mProject[1]), confidence: 0.75 });
    }

    const mDecision = ans.match(/\b(?:quyết định|chốt|kết luận)\b[:\s-]*([^\n]{5,180})/i);
    if (mDecision?.[1]) {
      out.push({ key: 'latest_decision', value: this.normalizeText(mDecision[1]), confidence: 0.72 });
    }
    return out;
  }

  private buildSummaryText(events: Array<{ event_type: string; content: string; created_at: Date }>): string {
    if (!events.length) return 'Chưa có sự kiện đủ dữ liệu để tóm tắt.';
    const latest = events.slice(0, 8).map((e, i) => `${i + 1}. [${e.event_type}] ${this.truncate(this.normalizeText(e.content), 240)}`);
    return `Tóm tắt gần nhất:\n${latest.join('\n')}`;
  }

  async ingestTaskOutcome(input: TaskOutcomeInput): Promise<void> {
    const now = new Date();
    const userPrompt = this.truncate(this.normalizeText(input.userPrompt), 2000);
    const assistantAnswer = this.truncate(this.normalizeText(input.assistantAnswer), 2200);
    const tagSeed = `${userPrompt} ${assistantAnswer}`;
    const tags = this.extractTags(tagSeed);

    const events: Array<Partial<MemoryEvent>> = [
      {
        workspace_id: input.workspaceId,
        user_id: input.userId,
        thread_id: input.threadId,
        task_id: input.taskId,
        event_type: input.status === 'completed' ? 'task_completed' : 'task_failed',
        content: `Task ${input.status}: ${assistantAnswer || 'Không có kết quả.'}`,
        source: 'tasks_service',
        importance: input.status === 'completed' ? 0.65 : 0.72,
        created_at: now,
      },
    ];

    if (userPrompt) {
      events.push({
        workspace_id: input.workspaceId,
        user_id: input.userId,
        thread_id: input.threadId,
        task_id: input.taskId,
        event_type: 'user_message',
        content: userPrompt,
        source: 'tasks_service',
        importance: 0.55,
        created_at: now,
      });
    }

    if (assistantAnswer) {
      events.push({
        workspace_id: input.workspaceId,
        user_id: input.userId,
        thread_id: input.threadId,
        task_id: input.taskId,
        event_type: 'assistant_message',
        content: assistantAnswer,
        source: 'tasks_service',
        importance: 0.6,
        created_at: now,
      });
    }

    if (events.length) {
      await this.memoryEventModel.insertMany(events, { ordered: false });
    }

    const facts = this.extractFacts(userPrompt, assistantAnswer);
    for (const f of facts) {
      const sourceEvent = await this.memoryEventModel
        .findOne({
          workspace_id: input.workspaceId,
          user_id: input.userId,
          thread_id: input.threadId,
        })
        .sort({ created_at: -1 })
        .lean()
        .exec();
      await this.memoryFactModel.updateOne(
        {
          workspace_id: input.workspaceId,
          user_id: input.userId,
          thread_id: input.threadId,
          key: f.key,
        },
        {
          $set: {
            value: f.value,
            confidence: f.confidence,
            tags,
            updated_at: now,
            source_event_id: sourceEvent ? String(sourceEvent._id) : String(input.taskId),
          },
        },
        { upsert: true },
      );
    }

    await this.refreshSummaries(input.workspaceId, input.userId, input.threadId, tags);
  }

  async refreshSummaries(
    workspaceId: Types.ObjectId,
    userId: Types.ObjectId,
    threadId: string,
    tags: string[] = [],
  ): Promise<void> {
    const now = new Date();
    const threadEvents = await this.memoryEventModel
      .find({ workspace_id: workspaceId, user_id: userId, thread_id: threadId })
      .sort({ created_at: -1 })
      .limit(24)
      .lean()
      .exec();
    const workspaceEvents = await this.memoryEventModel
      .find({ workspace_id: workspaceId, user_id: userId })
      .sort({ created_at: -1 })
      .limit(40)
      .lean()
      .exec();

    const threadSummary = this.buildSummaryText(
      threadEvents.map((e) => ({
        event_type: e.event_type,
        content: e.content,
        created_at: e.created_at,
      })),
    );
    const workspaceSummary = this.buildSummaryText(
      workspaceEvents.map((e) => ({
        event_type: e.event_type,
        content: e.content,
        created_at: e.created_at,
      })),
    );

    await this.memorySummaryModel.updateOne(
      { workspace_id: workspaceId, user_id: userId, thread_id: threadId, scope: 'thread' },
      {
        $set: {
          summary_text: threadSummary,
          tags,
          confidence: 0.72,
          source: 'summarizer_v1',
          last_event_at: threadEvents[0]?.created_at ?? now,
        },
      },
      { upsert: true },
    );

    await this.memorySummaryModel.updateOne(
      { workspace_id: workspaceId, user_id: userId, thread_id: threadId, scope: 'workspace' },
      {
        $set: {
          summary_text: workspaceSummary,
          tags,
          confidence: 0.65,
          source: 'summarizer_v1',
          last_event_at: workspaceEvents[0]?.created_at ?? now,
        },
      },
      { upsert: true },
    );

    await this.memorySummaryModel.updateOne(
      { workspace_id: workspaceId, user_id: userId, thread_id: threadId, scope: 'user' },
      {
        $set: {
          summary_text: workspaceSummary,
          tags,
          confidence: 0.6,
          source: 'summarizer_v1',
          last_event_at: workspaceEvents[0]?.created_at ?? now,
        },
      },
      { upsert: true },
    );
  }

  rankPacketsForQuery(query: string, packets: MemoryPacket[]): MemoryPacket[] {
    const qWords = new Set(
      (query || '')
        .toLowerCase()
        .split(/[\s.,!?;:"()[\]{}]+/g)
        .filter((w) => w.length >= 3),
    );
    const scored = packets.map((p) => {
      const textLow = p.text.toLowerCase();
      let overlap = 0;
      for (const w of qWords) {
        if (textLow.includes(w)) overlap += 1;
      }
      const relevance = qWords.size > 0 ? overlap / qWords.size : 0;
      return {
        ...p,
        score: Number((p.score * 0.6 + relevance * 0.4).toFixed(4)),
      };
    });
    return scored.sort((a, b) => b.score - a.score);
  }

  async buildMemoryContext(input: MemoryContextInput): Promise<string> {
    const shortTerm = (input.currentMessages || [])
      .slice(-10)
      .map((m, i) => `${i + 1}. [${m.role || 'unknown'}] ${this.truncate(this.normalizeText(m.content || ''), 220)}`)
      .filter((line) => !line.endsWith('] '));

    const summaries = await this.memorySummaryModel
      .find({
        workspace_id: input.workspaceId,
        user_id: input.userId,
        thread_id: input.threadId,
      })
      .sort({ last_event_at: -1 })
      .limit(6)
      .lean()
      .exec();

    const facts = await this.memoryFactModel
      .find({
        workspace_id: input.workspaceId,
        user_id: input.userId,
      })
      .sort({ updated_at: -1, confidence: -1 })
      .limit(12)
      .lean()
      .exec();

    const packets: MemoryPacket[] = [
      ...summaries.map((s) => ({
        source: `summary:${s.scope}`,
        text: this.truncate(this.normalizeText(s.summary_text), 420),
        score: 0.62 + (Number(s.confidence) || 0) * 0.2,
      })),
      ...facts.map((f) => ({
        source: `fact:${f.key}`,
        text: `${f.key}: ${this.truncate(this.normalizeText(f.value), 180)} (updated_at=${f.updated_at.toISOString()})`,
        score: 0.66 + (Number(f.confidence) || 0) * 0.25,
      })),
    ];

    const ranked = this.rankPacketsForQuery(input.userQuery, packets).slice(0, 8);
    const summaryLines = ranked.map((p, i) => `${i + 1}. [${p.source}] ${p.text}`);

    if (!shortTerm.length && !summaryLines.length) {
      return '';
    }

    return [
      '### MEMORY CONTEXT (TÓM TẮT XUYÊN TASK/XUYÊN PHIÊN)',
      shortTerm.length
        ? `- Short-term (10 tin gần nhất):\n${shortTerm.join('\n')}`
        : '- Short-term: chưa có.',
      summaryLines.length
        ? `- Long-term/Episodic (đã xếp hạng theo query):\n${summaryLines.join('\n')}`
        : '- Long-term/Episodic: chưa có.',
      '- Quy tắc sử dụng memory: ưu tiên mục mới hơn (`updated_at`/`last_event_at`), nếu memory thiếu thì nói rõ chưa có dữ liệu.',
    ].join('\n');
  }

  async smokeCheckMemory(
    workspaceId: Types.ObjectId,
    userId: Types.ObjectId,
    threadId: string,
  ): Promise<{ summaries: number; facts: number; events: number }> {
    const [summaries, facts, events] = await Promise.all([
      this.memorySummaryModel.countDocuments({ workspace_id: workspaceId, user_id: userId, thread_id: threadId }),
      this.memoryFactModel.countDocuments({ workspace_id: workspaceId, user_id: userId }),
      this.memoryEventModel.countDocuments({ workspace_id: workspaceId, user_id: userId, thread_id: threadId }),
    ]);
    return { summaries, facts, events };
  }

  logMemoryError(err: unknown, scope: string): void {
    const msg = err instanceof Error ? err.message : String(err);
    this.logger.warn(`Memory flow [${scope}] bỏ qua: ${msg}`);
  }
}
