import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { OnEvent } from '@nestjs/event-emitter';
import { LoggerService } from '../logger/logger.service';

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: '*',
    credentials: true
  }
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // userId -> Set<socketId>
  private userSockets = new Map<number, Set<string>>();

  constructor(
    private jwtService: JwtService,
    private logger: LoggerService
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.query?.token;
      if (!token) {
        client.disconnect();
        return;
      }

      const user = this.jwtService.verify(token as string);
      client.data.userId = user.id;

      // Добавляем сокет к пользователю
      if (!this.userSockets.has(user.id)) {
        this.userSockets.set(user.id, new Set());
      }
      this.userSockets.get(user.id).add(client.id);

      this.logger.log(`WS connected: user=${user.id} socket=${client.id}`, 'ChatGateway');
    } catch (error) {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId && this.userSockets.has(userId)) {
      this.userSockets.get(userId).delete(client.id);
      if (this.userSockets.get(userId).size === 0) {
        this.userSockets.delete(userId);
      }
    }
    this.logger.log(`WS disconnected: socket=${client.id}`, 'ChatGateway');
  }

  @SubscribeMessage('chat:join')
  handleJoinChat(@ConnectedSocket() client: Socket, @MessageBody() data: { chatId: number }) {
    client.join(`chat:${data.chatId}`);
    return { event: 'chat:joined', data: { chatId: data.chatId } };
  }

  @SubscribeMessage('chat:leave')
  handleLeaveChat(@ConnectedSocket() client: Socket, @MessageBody() data: { chatId: number }) {
    client.leave(`chat:${data.chatId}`);
    return { event: 'chat:left', data: { chatId: data.chatId } };
  }

  @SubscribeMessage('typing:start')
  handleTypingStart(@ConnectedSocket() client: Socket, @MessageBody() data: { chatId: number }) {
    client.to(`chat:${data.chatId}`).emit('typing:start', {
      userId: client.data.userId,
      chatId: data.chatId
    });
  }

  @SubscribeMessage('typing:stop')
  handleTypingStop(@ConnectedSocket() client: Socket, @MessageBody() data: { chatId: number }) {
    client.to(`chat:${data.chatId}`).emit('typing:stop', {
      userId: client.data.userId,
      chatId: data.chatId
    });
  }

  // ─── Event Handlers (from MessagesService via EventEmitter2) ───
  @OnEvent('message.created')
  handleMessageCreated(payload: { message: any; senderType: string }) {
    this.server.to(`chat:${payload.message.chatId}`).emit('message:new', payload.message);
  }

  @OnEvent('message.edited')
  handleMessageEdited(payload: { message: any }) {
    this.server.to(`chat:${payload.message.chatId}`).emit('message:edit', payload.message);
  }

  @OnEvent('message.deleted')
  handleMessageDeleted(payload: { messageId: number; chatId: number }) {
    this.server.to(`chat:${payload.chatId}`).emit('message:delete', payload);
  }
}
