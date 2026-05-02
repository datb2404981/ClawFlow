import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*', // Trong môi trường thật, đổi thành URL của frontend
  },
})
export class TasksGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('TasksGateway');

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinWorkspace')
  handleJoinWorkspace(
    @MessageBody() workspaceId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(workspaceId);
    this.logger.log(`Client ${client.id} joined workspace room: ${workspaceId}`);
    return { event: 'joined', data: workspaceId };
  }

  /**
   * Phát sự kiện stream từ AI (chunk, status, tool call...) về Frontend
   */
  emitTaskStream(
    workspaceId: string,
    taskId: string,
    event: Record<string, any>,
  ) {
    this.server.to(workspaceId).emit('task.stream', {
      taskId,
      ...event,
    });
  }

  /**
   * Phát tín hiệu chuyển trạng thái task (vd: completed, failed)
   */
  emitTaskStatus(
    workspaceId: string, 
    taskId: string, 
    status: string, 
    result?: string, 
    messageId?: string,
    extraData?: Record<string, any>
  ) {
    this.server.to(workspaceId).emit('task.status', {
      taskId,
      status,
      result,
      messageId,
      ...extraData
    });
  }
}
