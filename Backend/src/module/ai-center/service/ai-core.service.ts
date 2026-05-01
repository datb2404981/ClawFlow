import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AiCoreService {
  private readonly logger = new Logger(AiCoreService.name);
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    // Ưu tiên AI_CORE_BASE_URL (docker-compose + agents.service); tương thích AI_CORE_URL cũ.
    this.baseUrl =
      this.config.get<string>('AI_CORE_BASE_URL')?.trim() ||
      this.config.get<string>('AI_CORE_URL')?.trim() ||
      'http://localhost:8000';
  }

  /**
   * Gọi API /api/v1/chat của tầng AI_Core.
   * @param message Nội dung Prompt (đã được compiled với kỹ năng, RAG,...)
   * @param userId ID của người tạo task
   * @param sessionId ID của phiên làm việc (hoặc ID của Task để AI_Core giữ log)
   * @returns Phản hồi của AI (chuỗi văn bản)
   */
  async chatWithAi(message: string, userId: string, sessionId: string): Promise<string> {
    const url = `${this.baseUrl}/api/v1/chat`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          session_id: sessionId,
          message: message,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`AI_Core trả về lỗi HTTP ${response.status}: ${errorText}`);
        throw new Error(`AI_Core Error ${response.status}`);
      }

      const data = await response.json();
      
      if (data.status === 'error') {
        throw new Error(data.error || 'AI_Core phản hồi lỗi không rõ nguyên nhân.');
      }

      return data.reply || '';
    } catch (error) {
      this.logger.error(`Không thể kết nối đến AI_Core tại ${url}: ${error}`);
      throw new Error(`Lỗi giao tiếp với AI_Core: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Gọi AI_Core `/chat/stream` (SSE), gọi onChunk từng đoạn; trả về nội dung đầy đủ.
   */
  async chatWithAiStream(
    message: string,
    userId: string,
    sessionId: string,
    onEvent: (event: Record<string, any>) => void,
    integrations?: Record<string, any>,
  ): Promise<string> {
    const url = `${this.baseUrl}/api/v1/chat/stream`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          session_id: sessionId,
          message,
          integrations,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`AI_Core stream HTTP ${response.status}: ${errorText}`);
        throw new Error(`AI_Core Error ${response.status}`);
      }

      const body = response.body;
      if (!body) {
        throw new Error('AI_Core stream: không có response body');
      }

      const reader = body.getReader();
      const decoder = new TextDecoder();
      let carry = '';
      let full = '';

      const flushBlock = (block: string) => {
        for (const line of block.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed.toLowerCase().startsWith('data:')) continue;
          const payload = trimmed.replace(/^data:\s*/i, '').trim();
          if (!payload) continue;
          try {
            const obj = JSON.parse(payload) as Record<string, any>;
            // #region agent log
            if (
              typeof obj?.chunk === 'string' &&
              /PASS|FAIL|Lý do:|Gợi ý:|Bạn là một KIỂM DUYỆT VIÊN/i.test(
                obj.chunk,
              )
            ) {
              fetch('http://127.0.0.1:7397/ingest/61f9edc5-769f-4480-8e6d-d96b9963be00',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'de0ba6'},body:JSON.stringify({sessionId:'de0ba6',runId:`ai-core-stream:${sessionId}`,hypothesisId:'H1',location:'Backend/src/module/ai-center/service/ai-core.service.ts:111',message:'incoming_sse_chunk_contains_reviewer_markers',data:{type:obj?.type ?? '',node:obj?.node ?? '',chunkPreview:String(obj.chunk).slice(0,200)},timestamp:Date.now()})}).catch(()=>{});
            }
            // #endregion
            if (obj.type === 'chunk' && typeof obj.chunk === 'string') {
              full += obj.chunk;
            }
            if (typeof obj.error === 'string') {
              throw new Error(obj.error);
            }
            onEvent(obj);
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        carry += decoder.decode(value, { stream: true });
        const blocks = carry.split('\n\n');
        carry = blocks.pop() ?? '';
        for (const b of blocks) {
          if (b.trim()) flushBlock(b);
        }
      }
      if (carry.trim()) {
        flushBlock(carry);
      }
      // #region agent log
      fetch('http://127.0.0.1:7397/ingest/61f9edc5-769f-4480-8e6d-d96b9963be00',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'de0ba6'},body:JSON.stringify({sessionId:'de0ba6',runId:`ai-core-stream:${sessionId}`,hypothesisId:'H2',location:'Backend/src/module/ai-center/service/ai-core.service.ts:140',message:'full_stream_result_compacted',data:{fullLen:full.length,hasReviewMarkers:/PASS|FAIL|Lý do:|Gợi ý:|Bạn là một KIỂM DUYỆT VIÊN/i.test(full),preview:full.slice(-240)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      return full;
    } catch (error) {
      this.logger.error(`Không thể stream AI_Core tại ${url}: ${error}`);
      throw new Error(
        `Lỗi giao tiếp với AI_Core: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Gọi API /api/v1/route_skills của AI_Core để chọn các kỹ năng cần thiết cho task.
   */
  async routeSkills(taskDescription: string, availableSkills: { id: string, title: string, description: string }[]): Promise<string[]> {
    const url = `${this.baseUrl}/api/v1/route_skills`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task_description: taskDescription,
          available_skills: availableSkills,
        }),
      });

      if (!response.ok) {
        throw new Error(`AI_Core Routing Error ${response.status}`);
      }

      const data = await response.json();
      
      if (data.status === 'error') {
        throw new Error(data.error || 'Lỗi khi lấy ID skills từ AI_Core');
      }

      return data.selected_skill_ids || [];
    } catch (error) {
      this.logger.warn(`Không thể tự động phân loại kỹ năng (Skill Router), sử dụng tất cả kỹ năng thay thế. Lỗi: ${error}`);
      // Fallback: nếu lỗi, trả về tất cả ID của kỹ năng để hệ thống vẫn chạy được
      return availableSkills.map(s => s.id);
    }
  }
}
