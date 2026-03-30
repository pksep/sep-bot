import { Injectable } from '@nestjs/common';
import { ChatBridgeService } from '../chat-bridge/chat-bridge.service';
import { UpdatesService } from '../updates/updates.service';
import { BotsService } from '../bots/bots.service';
import { Bot } from '../bots/model/bots.model';
import { ITelegramApiResponse } from 'src/core/interface/pagination';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class BotApiService {
  constructor(
    private chatBridge: ChatBridgeService,
    private updatesService: UpdatesService,
    private botsService: BotsService,
    private logger: LoggerService
  ) {}

  private ok<T>(result: T): ITelegramApiResponse<T> {
    return { ok: true, result };
  }

  private error(code: number, description: string): ITelegramApiResponse {
    return { ok: false, error_code: code, description };
  }

  // ─── Info ─────────────────────────────────────────────
  async getMe(bot: Bot): Promise<ITelegramApiResponse> {
    return this.ok({
      id: bot.id,
      is_bot: true,
      first_name: bot.displayName,
      username: bot.username
    });
  }

  // ─── Messages ─────────────────────────────────────────
  async sendMessage(bot: Bot, params: {
    chat_id: string; text: string;
    reply_to_message_id?: string;
    reply_markup?: any;
  }): Promise<ITelegramApiResponse> {
    try {
      const result = await this.chatBridge.sendMessage(bot.id, params.chat_id, params.text, {
        replyMessageId: params.reply_to_message_id,
        ex: params.reply_markup ? { reply_markup: params.reply_markup } : undefined
      });
      return this.ok(this.formatMessage(result.result));
    } catch (e) {
      return this.error(400, e.message);
    }
  }

  async editMessageText(bot: Bot, params: {
    chat_id: string; message_id: string; text: string;
    reply_markup?: any;
  }): Promise<ITelegramApiResponse> {
    try {
      const result = await this.chatBridge.editMessage(bot.id, params.message_id, params.text);
      return this.ok(this.formatMessage(result.result));
    } catch (e) {
      return this.error(400, e.message);
    }
  }

  async deleteMessage(bot: Bot, params: {
    chat_id: string; message_id: string;
  }): Promise<ITelegramApiResponse> {
    try {
      await this.chatBridge.deleteMessage(bot.id, params.message_id, params.chat_id);
      return this.ok(true);
    } catch (e) {
      return this.error(400, e.message);
    }
  }

  // ─── Updates ──────────────────────────────────────────
  async getUpdates(bot: Bot, params: {
    offset?: number; limit?: number; timeout?: number;
  }): Promise<ITelegramApiResponse> {
    try {
      const updates = await this.updatesService.getUpdates(
        bot.id, params.offset, params.limit, params.timeout
      );
      return this.ok(updates.map(u => ({
        update_id: u.id,
        ...u.payload as any
      })));
    } catch (e) {
      return this.error(400, e.message);
    }
  }

  // ─── Webhooks ─────────────────────────────────────────
  async setWebhook(bot: Bot, params: {
    url: string; secret?: string; allowed_updates?: string[];
  }): Promise<ITelegramApiResponse> {
    try {
      await this.botsService.setWebhook(bot.id, params);
      return this.ok(true);
    } catch (e) {
      return this.error(400, e.message);
    }
  }

  async deleteWebhook(bot: Bot): Promise<ITelegramApiResponse> {
    try {
      await this.botsService.deleteWebhook(bot.id);
      return this.ok(true);
    } catch (e) {
      return this.error(400, e.message);
    }
  }

  async getWebhookInfo(bot: Bot): Promise<ITelegramApiResponse> {
    const info = await this.botsService.getWebhookInfo(bot.id);
    return this.ok(info);
  }

  // ─── Chats ────────────────────────────────────────────
  async getChat(bot: Bot, params: { chat_id: string }): Promise<ITelegramApiResponse> {
    try {
      const topic = await this.chatBridge.getTopicInfo(params.chat_id);
      return this.ok({
        id: topic.id,
        type: topic.type === 'DM' ? 'private' : 'group'
      });
    } catch (e) {
      return this.error(400, e.message);
    }
  }

  async getChatMembersCount(bot: Bot, params: { chat_id: string }): Promise<ITelegramApiResponse> {
    try {
      const members = await this.chatBridge.getTopicMembers(params.chat_id);
      return this.ok(members.length);
    } catch (e) {
      return this.error(400, e.message);
    }
  }

  // ─── Helpers ──────────────────────────────────────────
  private formatMessage(msg: any) {
    if (!msg) return null;
    const json = msg.toJSON ? msg.toJSON() : msg;
    return {
      message_id: json.id,
      from: {
        id: json.senderUserId,
        is_bot: json.senderUser?.isBot || true
      },
      chat: { id: json.topicId },
      date: Math.floor(new Date(json.createdAt).getTime() / 1000),
      text: json.text,
      ...(json.replyMessageId ? { reply_to_message: { message_id: json.replyMessageId } } : {})
    };
  }
}
