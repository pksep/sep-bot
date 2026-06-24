import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AmqpConnection, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { LoggerService } from '../logger/logger.service';
import {
  ChatApiResponse,
  ChatMessage,
  ChatUser
} from './interfaces/chat-types';
import {
  BOT_COMMANDS_EXCHANGE,
  CHAT_EVENTS_EXCHANGE,
  QUEUE_CHAT_EVENTS,
  RK_MESSAGE_NEW,
  RK_MESSAGE_EDIT,
  RK_MESSAGE_DELETE,
  RK_BOT_SEND_MESSAGE,
  RK_BOT_EDIT_MESSAGE,
  RK_BOT_DELETE_MESSAGE,
  RK_BOT_CREATE_USER,
  RK_BOT_GET_TOPIC_INFO,
  RK_BOT_GET_TOPIC_MEMBERS,
  RK_BOT_GET_USER_TOPICS,
  RK_BOT_ADD_TO_TOPIC,
  RK_BOT_REMOVE_FROM_TOPIC,
  RK_BOT_GET_UPLOAD_URL,
  type BotMedia,
  type GetUploadUrlResult
} from './rabbitmq.constants';

@Injectable()
export class ChatBridgeService implements OnModuleInit {
  // Registry: topicId → Set<botId (internal int)>
  private topicBotRegistry = new Map<string, Set<number>>();
  // Registry: botId → chatUserId (UUID)
  private botChatUserMap = new Map<number, string>();
  // Registry: chatUserId → botId
  private chatUserBotMap = new Map<string, number>();

  constructor(
    private configService: ConfigService,
    private eventEmitter: EventEmitter2,
    private amqp: AmqpConnection,
    private logger: LoggerService
  ) {}

  async onModuleInit() {
    this.logger.log('ChatBridge initialized with RabbitMQ', 'ChatBridge');
  }

  // ═══════════════════════════════════════════════════════════
  //  RabbitMQ Subscribers — получение событий от chat_server
  // ═══════════════════════════════════════════════════════════

  @RabbitSubscribe({
    exchange: CHAT_EVENTS_EXCHANGE,
    routingKey: RK_MESSAGE_NEW,
    queue: QUEUE_CHAT_EVENTS + '.message_new'
  })
  async handleMessageNew(payload: {
    type: string;
    topicId: string;
    message: ChatMessage;
    senderUserId: string;
  }) {
    await this.dispatchToBot(payload.topicId, payload.message, 'message');
  }

  @RabbitSubscribe({
    exchange: CHAT_EVENTS_EXCHANGE,
    routingKey: RK_MESSAGE_EDIT,
    queue: QUEUE_CHAT_EVENTS + '.message_edit'
  })
  handleMessageEdit(payload: {
    type: string;
    topicId: string;
    message: ChatMessage;
    senderUserId: string;
  }) {
    void this.dispatchToBot(payload.topicId, payload.message, 'edited_message');
  }

  @RabbitSubscribe({
    exchange: CHAT_EVENTS_EXCHANGE,
    routingKey: RK_MESSAGE_DELETE,
    queue: QUEUE_CHAT_EVENTS + '.message_delete'
  })
  handleMessageDelete(payload: {
    type: string;
    topicId: string;
    message: { id: string; topicId: string };
  }) {
    // Для удаления просто уведомляем ботов
    const botsInTopic = this.topicBotRegistry.get(payload.topicId);
    if (!botsInTopic || botsInTopic.size === 0) return;

    for (const botId of botsInTopic) {
      this.eventEmitter.emit('bot.update', {
        botId,
        type: 'deleted_message',
        payload: {
          deleted_message: {
            message_id: payload.message.id,
            chat: { id: payload.topicId }
          }
        }
      });
    }
  }

  private async dispatchToBot(
    topicId: string,
    message: ChatMessage,
    updateType: string
  ) {
    try {
      // Пропускаем системные сообщения
      if (message.isSystem) return;

      // Пропускаем сообщения от ботов (иначе бот получит свои же)
      const senderUserId =
        message.senderUserId || (message as any).senderUser?.id;
      if (senderUserId && this.chatUserBotMap.has(senderUserId)) return;

      // Ищем ботов в этом топике; при промахе — лениво подтягиваем состав
      // топика (новый диалог, созданный уже после старта бота).
      let botsInTopic = this.topicBotRegistry.get(topicId);
      if (!botsInTopic || botsInTopic.size === 0) {
        botsInTopic = await this.resolveBotsInTopic(topicId);
      }
      if (!botsInTopic || botsInTopic.size === 0) return;

      for (const botId of botsInTopic) {
        const telegramStyleMessage = this.formatMessageToTelegramStyle(
          message,
          topicId
        );

        this.eventEmitter.emit('bot.update', {
          botId,
          type: updateType,
          payload: { [updateType]: telegramStyleMessage }
        });
      }
    } catch (err) {
      this.logger.error(
        err instanceof Error ? err : new Error(String(err)),
        'ChatBridge.dispatchToBot'
      );
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  RPC — отправка команд через RabbitMQ → chat_server
  // ═══════════════════════════════════════════════════════════

  async sendMessage(
    botId: number,
    topicId: string,
    text: string,
    options?: {
      replyMessageId?: string;
      ex?: any;
      taggedUserIds?: string[];
      medias?: BotMedia[];
    }
  ): Promise<ChatApiResponse<ChatMessage>> {
    const chatUserId = this.botChatUserMap.get(botId);
    if (!chatUserId) throw new Error(`Bot ${botId} not found in registry`);

    return this.amqp.request<ChatApiResponse<ChatMessage>>({
      exchange: BOT_COMMANDS_EXCHANGE,
      routingKey: RK_BOT_SEND_MESSAGE,
      payload: {
        senderUserId: chatUserId,
        topicId,
        text,
        replyMessageId: options?.replyMessageId,
        ex: options?.ex,
        taggedUserIds: options?.taggedUserIds,
        medias: options?.medias
      },
      timeout: 10000
    });
  }

  /**
   * Запросить у chat_server presigned-URL для прямой загрузки файла в MinIO.
   * Файл НЕ проходит через шину — SDK льёт его напрямую в хранилище.
   */
  async getUploadUrl(
    filename: string,
    mimeType?: string
  ): Promise<GetUploadUrlResult> {
    const response = await this.amqp.request<
      ChatApiResponse<GetUploadUrlResult>
    >({
      exchange: BOT_COMMANDS_EXCHANGE,
      routingKey: RK_BOT_GET_UPLOAD_URL,
      payload: { filename, mimeType },
      timeout: 10000
    });

    if (!response.ok || !response.result)
      throw new Error((response as any).error || 'Failed to get upload URL');
    return response.result;
  }

  async editMessage(
    botId: number,
    messageId: string,
    text: string
  ): Promise<ChatApiResponse<ChatMessage>> {
    const chatUserId = this.botChatUserMap.get(botId);
    if (!chatUserId) throw new Error(`Bot ${botId} not found in registry`);

    return this.amqp.request<ChatApiResponse<ChatMessage>>({
      exchange: BOT_COMMANDS_EXCHANGE,
      routingKey: RK_BOT_EDIT_MESSAGE,
      payload: { senderUserId: chatUserId, messageId, text },
      timeout: 10000
    });
  }

  async deleteMessage(
    botId: number,
    messageId: string,
    topicId: string
  ): Promise<ChatApiResponse> {
    const chatUserId = this.botChatUserMap.get(botId);
    if (!chatUserId) throw new Error(`Bot ${botId} not found in registry`);

    return this.amqp.request<ChatApiResponse>({
      exchange: BOT_COMMANDS_EXCHANGE,
      routingKey: RK_BOT_DELETE_MESSAGE,
      payload: { senderUserId: chatUserId, messageId, topicId },
      timeout: 10000
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  RPC — управление пользователями-ботами
  // ═══════════════════════════════════════════════════════════

  async createBotUser(
    nickname: string,
    displayName: string
  ): Promise<ChatUser> {
    const response = await this.amqp.request<ChatApiResponse<ChatUser>>({
      exchange: BOT_COMMANDS_EXCHANGE,
      routingKey: RK_BOT_CREATE_USER,
      payload: { nickname, displayName },
      timeout: 10000
    });

    if (!response.ok)
      throw new Error((response as any).error || 'Failed to create bot user');
    return response.result;
  }

  // ═══════════════════════════════════════════════════════════
  //  RPC — топики
  // ═══════════════════════════════════════════════════════════

  async getTopicInfo(topicId: string): Promise<any> {
    const response = await this.amqp.request<ChatApiResponse>({
      exchange: BOT_COMMANDS_EXCHANGE,
      routingKey: RK_BOT_GET_TOPIC_INFO,
      payload: { topicId },
      timeout: 10000
    });
    return response.result;
  }

  async getTopicMembers(topicId: string): Promise<string[]> {
    const response = await this.amqp.request<ChatApiResponse<string[]>>({
      exchange: BOT_COMMANDS_EXCHANGE,
      routingKey: RK_BOT_GET_TOPIC_MEMBERS,
      payload: { topicId },
      timeout: 10000
    });
    return response.result || [];
  }

  async getUserTopicIds(userId: string): Promise<string[]> {
    const response = await this.amqp.request<ChatApiResponse<string[]>>({
      exchange: BOT_COMMANDS_EXCHANGE,
      routingKey: RK_BOT_GET_USER_TOPICS,
      payload: { userId },
      timeout: 10000
    });
    return response.result || [];
  }

  async addBotToTopic(
    topicId: string,
    botUserId: string,
    actorId: string
  ): Promise<boolean> {
    const response = await this.amqp.request<ChatApiResponse>({
      exchange: BOT_COMMANDS_EXCHANGE,
      routingKey: RK_BOT_ADD_TO_TOPIC,
      payload: { topicId, botUserId, actorId },
      timeout: 10000
    });
    return response.ok;
  }

  async removeBotFromTopic(
    topicId: string,
    botUserId: string,
    actorId: string
  ): Promise<boolean> {
    const response = await this.amqp.request<ChatApiResponse>({
      exchange: BOT_COMMANDS_EXCHANGE,
      routingKey: RK_BOT_REMOVE_FROM_TOPIC,
      payload: { topicId, botUserId, actorId },
      timeout: 10000
    });
    return response.ok;
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

  /**
   * Ленивая регистрация: спрашиваем у chat_server состав топика и находим в нём
   * известных ботов. Нужно для топиков, созданных уже после старта Сеп-бота
   * (например, новый диалог пользователя с ботом из клиента).
   */
  private async resolveBotsInTopic(
    topicId: string
  ): Promise<Set<number> | undefined> {
    if (this.chatUserBotMap.size === 0) return undefined;
    try {
      const memberIds = await this.getTopicMembers(topicId);
      for (const memberId of memberIds) {
        const botId = this.chatUserBotMap.get(memberId);
        if (botId !== undefined) {
          this.registerBotInTopic(topicId, botId);
        }
      }
      return this.topicBotRegistry.get(topicId);
    } catch (err) {
      this.logger.error(
        err instanceof Error ? err : new Error(String(err)),
        `ChatBridge.resolveBotsInTopic(${topicId})`
      );
      return undefined;
    }
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
        type: 'unknown'
      },
      date: Math.floor(new Date(message.createdAt).getTime() / 1000),
      text: message.text || '',
      ...(message.replyMessageId
        ? { reply_to_message: { message_id: message.replyMessageId } }
        : {})
    };
  }
}
