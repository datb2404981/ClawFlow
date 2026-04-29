import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger, forwardRef, Inject } from '@nestjs/common';
import { TasksService } from '../service/tasks.service';

@Processor('tasks_queue')
export class TasksProcessor extends WorkerHost {
  private readonly logger = new Logger(TasksProcessor.name);

  constructor(
    @Inject(forwardRef(() => TasksService))
    private readonly tasksService: TasksService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    if (job.name === 'scheduler_tick') {
      this.logger.log(`⏰ Scheduler tick bắt đầu [${job.id}]`);
      return this.tasksService.schedulerTick();
    }

    // default: process_task
    const taskId = String(job?.data?.taskId ?? '');
    this.logger.log(`🚀 Bắt đầu xử lý Job Queue [${job.id}] cho Task: ${taskId}`);

    try {
      // Gọi service để chạy task dựa vào taskId
      await this.tasksService.compileAndRunTaskById(taskId);
      return { success: true };
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Job ${job.id} thất bại: ${errMessage}`);
      throw error; // Ném lỗi ra để BullMQ ghi nhận Job Failed, có thể setup tự động Retry sau.
    }
  }
}
