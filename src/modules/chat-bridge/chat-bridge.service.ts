import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { io, Socket } from 'socket.io-client';
import axios, { AxiosInstance } from 'axios';
import { LoggerService } from '../logger/logger.service';
import { ChatApiResponse, ChatMessage, ChatUser, WsChangePayload } from './interfaces/chat-types';

@Injectable()
export class ChatBridgeService implements OnModuleInit, OnModuleDestroy {
  private wsClient: Socket;
  private httpClient: AxiosInstance;
  private chatServerUrl: string;
  private serviceApiKey: string;
  private systemUserJwt: string;

  // Registry: topicId → Set<botId (internal int)>
  private topicBotRegistry = new Map<string, Set<number>>();
  // Registry: botId → chatUserId (UUID)
  private botChatUserMap = new Map<number, string>();
  // Registry: chatUserId → botId
  private chatUserBotMap = new Map<string, number>();

  constructor(
    private configService: ConfigService,
    private eventEmitter: EventEmitter2,
    private logger: LoggerService
  ) {
    this.chatServerUrl = this.configService.get<string>('chatServer.url') || 'http://localhost:3000';
    this.serviceApiKey = this.configService.get<string>('chatServer.serviceApiKey') || '';
    this.systemUserJwt = this.configService.get<string>('chatServer.systemUserJwt') || '';

    this.httpClient = axios.create({
      baseURL: this.chatServerUrl + '/api',
      headers: {
        'x-service-key': this.serviceApiKey,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
  }

  async onModuleInit() {
    this.connectWebSocket();
  }

  onModuleDestroy() {
    if (this.wsClient) {
      this.wsClient.disconnect();
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  WebSocket Connection — слушаем события от chat_server
  // ═══════════════════════════════════════════════════════════

  private connectWebSocket() {
    if (!this.systemUserJwt) {
      this.logger.warn('System user JWT not configured — WS bridge disabled', 'ChatBridge');
      return;
    }

    this.wsClient = io(`${this.chatServerUrl}/chat`, {
      auth: { token: this.systemUserJwt },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 3000
    });

    this.wsClient.on('connect', () => {
      this.logger.log('WS connected to chat_server', 'ChatBridge');
      this.joinBotTopics();
    });

    this.wsClient.on('disconnect', (reason) => {
      this.logger.warn(`WS disconnected: ${reason}`, 'ChatBridge');
    });

    this.wsClient.on('connect_error', (err) => {
      this.logger.error(new Error(`WS connection error: ${err.message}`), 'ChatBridge');
    });

    // Слушаем новые сообщения
    this.wsClient.on('changeMessage', (payload: WsChangePayload<ChatMessage>) => {
      this.handleChangeMessage(payload);
    });
  }

  private handleChangeMessage(payload: WsChangePayload<ChatMessage>) {
    try {
      const { type, topicId, data: message } = payload;

      // Пропускаем не-NEW события (для updates нужны только новые сообщения)
      // TODO: поддержать edited_message, на будущее
      if (type !== 'NEW') return;

      // Пропускаем системные сообщения
      if (message.isSystem) return;

      // Пропускаем сообщения от ботов (иначе бот получит свои же сообщения)
      const senderUserId = message.senderUserId || (message as any).senderUser?.id;
      if (senderUserId && this.chatUserBotMap.has(senderUserId)) return;

      // Ищем ботов в этом топике
      const botsInTopic = this.topicBotRegistry.get(topicId);
      if (!botsInTopic || botsInTopic.size === 0) return;

      // Для каждого бота создаём Update
      for (const botId of botsInTopic) {
        const telegramStyleMessage = this.formatMessageToTelegramStyle(message, topicId);

        this.eventEmitter.emit('bot.update', {
          botId,
          type: 'message',
          payload: { message: telegramStyleMessage }
        });
      }
    } catch (err) {
      this.logger.error(
        err instanceof Error ? err : new Error(String(err)),
        'ChatBridge.handleChangeMessage'
      );
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  REST — отправка сообщений через chat_server
  // ═══════════════════════════════════════════════════════════

  async sendMessage(
    botId: number,
    topicId: string,
    text: string,
    options?: { replyMessageId?: string; ex?: any; taggedUserIds?: string[] }
  ): Promise<ChatApiResponse<ChatMessage>> {
    const chatUserId = this.botChatUserMap.get(botId);
    if (!chatUserId) throw new Error(`Bot ${botId} not found in registry`);

    const { data } = await this.httpClient.post<ChatApiResponse<ChatMessage>>(
      '/internal/messages/send',
      {
        senderUserId: chatUserId,
        topicId,
        text,
        replyMessageId: options?.replyMessageId,
        ex: options?.ex,
        taggedUserIds: options?.taggedUserIds
      }
    );
    return data;
  }

  async editMessage(
    botId: number,
    messageId: string,
    text: string
  ): Promise<ChatApiResponse<ChatMessage>> {
    const chatUserId = this.botChatUserMap.get(botId);
    if (!chatUserId) throw new Error(`Bot ${botId} not found in registry`);

    const { data } = await this.httpClient.post<ChatApiResponse<ChatMessage>>(
      '/internal/messages/edit',
      { senderUserId: chatUserId, messageId, text }
    );
    return data;
  }

  async deleteMessage(
    botId: number,
    messageId: string,
    topicId: string
  ): Promise<ChatApiResponse> {
    const chatUserId = this.botChatUserMap.get(botId);
    if (!chatUserId) throw new Error(`Bot ${botId} not found in registry`);

    const { data } = await this.httpClient.post<ChatApiResponse>(
      '/internal/messages/delete',
      { senderUserId: chatUserId, messageId, topicId }
    );
    return data;
  }

  // ═══════════════════════════════════════════════════════════
  //  REST — управление пользователями-ботами
  // ═══════════════════════════════════════════════════════════

  async createBotUser(nickname: string, displayName: string): Promise<ChatUser> {
    const { data } = await this.httpClient.post<ChatApiResponse<ChatUser>>(
      '/internal/users/create-bot',
      { nickname, displayName }
    );
    if (!data.ok) throw new Error(data.description || 'Failed to create bot user');
    return data.result;
  }

  async getUser(userId: string): Promise<ChatUser | null> {
    try {
      const { data } = await this.httpClient.get<ChatApiResponse<ChatUser>>(
        `/internal/users/${userId}`
      );
      return data.ok ? data.result : null;
    } catch {
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  REST — топики
  // ═══════════════════════════════════════════════════════════

  async getTopicInfo(topicId: string): Promise<any> {
    const { data } = await this.httpClient.get<ChatApiResponse>(
      `/internal/topics/${topicId}`
    );
    return data.result;
  }

  async getTopicMembers(topicId: string): Promise<string[]> {
    const { data } = await this.httpClient.get<ChatApiResponse<string[]>>(
      `/internal/topics/${topicId}/members`
    );
    return data.result || [];
  }

  async getUserTopicIds(userId: string): Promise<string[]> {
    const { data } = await this.httpClient.get<ChatApiResponse<string[]>>(
      `/internal/topics/user/${userId}/topics`
    );
    return data.result || [];
  }

  async addBotToTopic(topicId: string, botUserId: string, actorId: string): Promise<boolean> {
    const { data } = await this.httpClient.post<ChatApiResponse>(
      `/internal/topics/${topicId}/add-bot`,
      { botUserId, actorId }
    );
    return data.ok;
  }

  async removeBotFromTopic(topicId: string, botUserId: string, actorId: string): Promise<boolean> {
    const { data } = await this.httpClient.post<ChatApiResponse>(
      `/internal/topics/${topicId}/remove-bot`,
      { botUserId, actorId }
    );
    return data.ok;
  }

  // ═══════════════════════════════════════════════════════════
  //  Bot Registry — управление какие боты в каких топиках
  // ═══════════════════════════════════════════════════════════

  registerBot(botId: number, chatUserId: string) {
    this.botChatUserMap.set(botId, chatUserId);
    this.chatUserBotMap.set(chatUserId, botId);
  }

  unregisterBot(botId: number) {
    const chatUserId = this.botChatUserMap.get(botId);
    if (chatUserId) {
      this.chatUserBotMap.delete(chatUserId);
    }
    this.botChatUserMap.delete(botId);

    // Remove from all topics
    for (const [topicId, bots] of this.topicBotRegistry) {
      bots.delete(botId);
      if (bots.size === 0) {
        this.topicBotRegistry.delete(topicId);
      }
    }
  }

  registerBotInTopic(topicId: string, botId: number) {
    if (!this.topicBotRegistry.has(topicId)) {
      this.topicBotRegistry.set(topicId, new Set());
    }
    this.topicBotRegistry.get(topicId).add(botId);

    // Join WS room
    if (this.wsClient?.connected) {
      // Socket.IO client не может join server rooms напрямую,
      // но системный пользователь уже подписан на все свои room'ы через handleConnection
      // Нужно будет добавить кастомное событие join или подписаться через REST
    }
  }

  async loadBotTopics(botId: number, chatUserId: string) {
    try {
      const topicIds = await this.getUserTopicIds(chatUserId);
      for (const topicId of topicIds) {
        this.registerBotInTopic(topicId, botId);
      }
      this.logger.log(
        `Bot ${botId} registered in ${topicIds.length} topics`,
        'ChatBridge'
      );
    } catch (err) {
      this.logger.error(
        err instanceof Error ? err : new Error(String(err)),
        `ChatBridge.loadBotTopics(${botId})`
      );
    }
  }

  private async joinBotTopics() {
    // При подключении WS, подписываемся на все топики ботов
    // Системный пользователь auto-join'ится на свои топики в handleConnection chat_server
    // Но нужно, чтобы системный пользователь был участником всех нужных топиков
    this.logger.log(
      `Registry: ${this.botChatUserMap.size} bots, ${this.topicBotRegistry.size} topics`,
      'ChatBridge'
    );
  }

  // ═══════════════════════════════════════════════════════════
  //  Helpers
  // ═══════════════════════════════════════════════════════════

  private formatMessageToTelegramStyle(message: ChatMessage, topicId: string) {
    return {
      message_id: message.id,
      from: {
        id: message.senderUserId,
        is_bot: message.senderUser?.isBot || false,
        first_name: message.senderUser?.initials || '',
        username: message.senderUser?.nickname || ''
      },
      chat: {
        id: topicId,
        type: 'unknown' // будет обогащено позже если нужно
      },
      date: Math.floor(new Date(message.createdAt).getTime() / 1000),
      text: message.text || '',
      ...(message.replyMessageId
        ? { reply_to_message: { message_id: message.replyMessageId } }
        : {})
    };
  }
}
