import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AiCoreService {
  private readonly logger = new Logger(AiCoreService.name);
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    // Nếu deploy, có thể sửa biến môi trường AI_CORE_URL trong .env, mặc định là http://localhost:8000
    this.baseUrl = this.config.get<string>('AI_CORE_URL') || 'http://localhost:8000';
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
