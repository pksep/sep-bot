import { Injectable } from '@nestjs/common';
import { ChatBridgeService } from '../chat-bridge/chat-bridge.service';
import { UpdatesService } from '../updates/updates.service';
import { BotsService } from '../bots/bots.service';
import { Bot } from '../bots/model/bots.model';
import { ITelegramApiResponse } from 'src/core/interface/pagination';
import { ChatMessage } from '../chat-bridge/interfaces/chat-types';

// ─── DTO interfaces ──────────────────────────────────────

interface SendMessageParams {
  chat_id: string;
  text: string;
  reply_to_message_id?: string;
  reply_markup?: Record<string, unknown>;
}

interface EditMessageParams {
  chat_id: string;
  message_id: string;
  text: string;
  reply_markup?: Record<string, unknown>;
}

interface DeleteMessageParams {
  chat_id: string;
  message_id: string;
}

interface GetUpdatesParams {
  offset?: number;
  limit?: number;
  timeout?: number;
}

interface SetWebhookParams {
  url: string;
  secret?: string;
  allowed_updates?: string[];
}

interface ChatIdParam {
  chat_id: string;
}

interface FormattedMessage {
  message_id: string;
  from: { id: string; is_bot: boolean };
  chat: { id: string };
  date: number;
  text: string;
  reply_to_message?: { message_id: string };
}

// ─── Service ─────────────────────────────────────────────

@Injectable()
export class BotApiService {
  constructor(
    private readonly chatBridge: ChatBridgeService,
    private readonly updatesService: UpdatesService,
    private readonly botsService: BotsService
  ) {}

  private ok<T>(result: T): ITelegramApiResponse<T> {
    return { ok: true, result };
  }

  private error(code: number, description: string): ITelegramApiResponse {
    return { ok: false, error_code: code, description };
  }

  private getErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    return String(err);
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

  async sendMessage(
    bot: Bot,
    params: SendMessageParams
  ): Promise<ITelegramApiResponse> {
    try {
      const result = await this.chatBridge.sendMessage(
        bot.id,
        params.chat_id,
        params.text,
        {
          replyMessageId: params.reply_to_message_id,
          ex: params.reply_markup
            ? { reply_markup: params.reply_markup }
            : undefined
        }
      );
      return this.ok(this.formatMessage(result.result));
    } catch (err: unknown) {
      return this.error(400, this.getErrorMessage(err));
    }
  }

  async editMessageText(
    bot: Bot,
    params: EditMessageParams
  ): Promise<ITelegramApiResponse> {
    try {
      const result = await this.chatBridge.editMessage(
        bot.id,
        params.message_id,
        params.text
      );
      return this.ok(this.formatMessage(result.result));
    } catch (err: unknown) {
      return this.error(400, this.getErrorMessage(err));
    }
  }

  async deleteMessage(
    bot: Bot,
    params: DeleteMessageParams
  ): Promise<ITelegramApiResponse> {
    try {
      await this.chatBridge.deleteMessage(
        bot.id,
        params.message_id,
        params.chat_id
      );
      return this.ok(true);
    } catch (err: unknown) {
      return this.error(400, this.getErrorMessage(err));
    }
  }

  // ─── Updates ──────────────────────────────────────────

  async getUpdates(
    bot: Bot,
    params: GetUpdatesParams
  ): Promise<ITelegramApiResponse> {
    try {
      const updates = await this.updatesService.getUpdates(
        bot.id,
        params.offset,
        params.limit,
        params.timeout
      );
      return this.ok(
        updates.map(u => ({
          update_id: u.id,
          ...(u.payload as Record<string, unknown>)
        }))
      );
    } catch (err: unknown) {
      return this.error(400, this.getErrorMessage(err));
    }
  }

  // ─── Webhooks ─────────────────────────────────────────

  async setWebhook(
    bot: Bot,
    params: SetWebhookParams
  ): Promise<ITelegramApiResponse> {
    try {
      await this.botsService.setWebhook(bot.id, params);
      return this.ok(true);
    } catch (err: unknown) {
      return this.error(400, this.getErrorMessage(err));
    }
  }

  async deleteWebhook(bot: Bot): Promise<ITelegramApiResponse> {
    try {
      await this.botsService.deleteWebhook(bot.id);
      return this.ok(true);
    } catch (err: unknown) {
      return this.error(400, this.getErrorMessage(err));
    }
  }

  async getWebhookInfo(bot: Bot): Promise<ITelegramApiResponse> {
    const info = await this.botsService.getWebhookInfo(bot.id);
    return this.ok(info);
  }

  // ─── Chats ────────────────────────────────────────────

  async getChat(
    bot: Bot,
    params: ChatIdParam
  ): Promise<ITelegramApiResponse> {
    try {
      const topic = await this.chatBridge.getTopicInfo(params.chat_id);
      return this.ok({
        id: topic.id,
        type: topic.type === 'DM' ? 'private' : 'group'
      });
    } catch (err: unknown) {
      return this.error(400, this.getErrorMessage(err));
    }
  }

  async getChatMembersCount(
    bot: Bot,
    params: ChatIdParam
  ): Promise<ITelegramApiResponse> {
    try {
      const members = await this.chatBridge.getTopicMembers(params.chat_id);
      return this.ok(members.length);
    } catch (err: unknown) {
      return this.error(400, this.getErrorMessage(err));
    }
  }

  // ─── Helpers ──────────────────────────────────────────

  private formatMessage(
    msg: ChatMessage | undefined
  ): FormattedMessage | null {
    if (!msg) return null;
    return {
      message_id: msg.id,
      from: {
        id: msg.senderUserId,
        is_bot: msg.senderUser?.isBot ?? true
      },
      chat: { id: msg.topicId },
      date: Math.floor(new Date(msg.createdAt).getTime() / 1000),
      text: msg.text || '',
      ...(msg.replyMessageId
        ? { reply_to_message: { message_id: msg.replyMessageId } }
        : {})
    };
  }
}
