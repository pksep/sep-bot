import { Injectable } from '@nestjs/common';
import { MessagesService } from '../messages/messages.service';
import { ChatsService } from '../chats/chats.service';
import { ChatMembersService } from '../chat-members/chat-members.service';
import { UpdatesService } from '../updates/updates.service';
import { BotsService } from '../bots/bots.service';
import { CallbackQueriesService } from '../callback-queries/callback-queries.service';
import { FilesService } from '../files/files.service';
import { Bot } from '../bots/model/bots.model';
import { SenderType, MessageType } from 'src/core/enums/entity.enum';
import { ITelegramApiResponse } from 'src/core/interface/pagination';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class BotApiService {
  constructor(
    private messagesService: MessagesService,
    private chatsService: ChatsService,
    private chatMembersService: ChatMembersService,
    private updatesService: UpdatesService,
    private botsService: BotsService,
    private callbackQueriesService: CallbackQueriesService,
    private filesService: FilesService,
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
  async sendMessage(bot: Bot, params: { chat_id: number; text: string; reply_markup?: object; reply_to_message_id?: number }): Promise<ITelegramApiResponse> {
    try {
      const message = await this.messagesService.sendMessage({
        chatId: params.chat_id,
        senderType: SenderType.BOT,
        senderId: bot.id,
        content: params.text,
        replyMarkup: params.reply_markup,
        replyToMessageId: params.reply_to_message_id
      });
      return this.ok(this.formatMessage(message));
    } catch (e) {
      return this.error(400, e.message);
    }
  }

  async editMessageText(bot: Bot, params: { chat_id: number; message_id: number; text: string; reply_markup?: object }): Promise<ITelegramApiResponse> {
    try {
      const message = await this.messagesService.editMessage(params.message_id, params.chat_id, params.text, params.reply_markup);
      return this.ok(this.formatMessage(message));
    } catch (e) {
      return this.error(400, e.message);
    }
  }

  async deleteMessage(bot: Bot, params: { chat_id: number; message_id: number }): Promise<ITelegramApiResponse> {
    try {
      await this.messagesService.deleteMessage(params.message_id, params.chat_id);
      return this.ok(true);
    } catch (e) {
      return this.error(400, e.message);
    }
  }

  async forwardMessage(bot: Bot, params: { chat_id: number; from_chat_id: number; message_id: number }): Promise<ITelegramApiResponse> {
    try {
      const message = await this.messagesService.forwardMessage(params.from_chat_id, params.chat_id, params.message_id, bot.id, SenderType.BOT);
      return this.ok(this.formatMessage(message));
    } catch (e) {
      return this.error(400, e.message);
    }
  }

  async sendMedia(bot: Bot, params: { chat_id: number; type: MessageType; file_id: string; caption?: string; reply_markup?: object; reply_to_message_id?: number }): Promise<ITelegramApiResponse> {
    try {
      const message = await this.messagesService.sendMessage({
        chatId: params.chat_id,
        senderType: SenderType.BOT,
        senderId: bot.id,
        content: params.caption || '',
        type: params.type,
        metadata: { file_id: params.file_id },
        replyMarkup: params.reply_markup,
        replyToMessageId: params.reply_to_message_id
      });
      return this.ok(this.formatMessage(message));
    } catch (e) {
      return this.error(400, e.message);
    }
  }

  // ─── Updates ──────────────────────────────────────────
  async getUpdates(bot: Bot, params: { offset?: number; limit?: number; timeout?: number }): Promise<ITelegramApiResponse> {
    try {
      const updates = await this.updatesService.getUpdates(bot.id, params.offset, params.limit, params.timeout);
      return this.ok(updates.map(u => ({
        update_id: u.id,
        ...u.payload as any
      })));
    } catch (e) {
      return this.error(400, e.message);
    }
  }

  // ─── Webhooks ─────────────────────────────────────────
  async setWebhook(bot: Bot, params: { url: string; secret?: string; allowed_updates?: string[]; max_connections?: number }): Promise<ITelegramApiResponse> {
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
    try {
      const info = await this.botsService.getWebhookInfo(bot.id);
      return this.ok(info);
    } catch (e) {
      return this.error(400, e.message);
    }
  }

  // ─── Chats ────────────────────────────────────────────
  async getChat(bot: Bot, params: { chat_id: number }): Promise<ITelegramApiResponse> {
    try {
      const chat = await this.chatsService.getChat(params.chat_id);
      return this.ok(chat);
    } catch (e) {
      return this.error(400, e.message);
    }
  }

  async getChatMember(bot: Bot, params: { chat_id: number; user_id: number }): Promise<ITelegramApiResponse> {
    try {
      const member = await this.chatMembersService.getChatMember(params.chat_id, params.user_id);
      return this.ok(member);
    } catch (e) {
      return this.error(400, e.message);
    }
  }

  async getChatMembersCount(bot: Bot, params: { chat_id: number }): Promise<ITelegramApiResponse> {
    try {
      const count = await this.chatMembersService.getChatMembersCount(params.chat_id);
      return this.ok(count);
    } catch (e) {
      return this.error(400, e.message);
    }
  }

  async banChatMember(bot: Bot, params: { chat_id: number; user_id: number }): Promise<ITelegramApiResponse> {
    try {
      await this.chatMembersService.banMember(params.chat_id, params.user_id);
      return this.ok(true);
    } catch (e) {
      return this.error(400, e.message);
    }
  }

  async unbanChatMember(bot: Bot, params: { chat_id: number; user_id: number }): Promise<ITelegramApiResponse> {
    try {
      await this.chatMembersService.unbanMember(params.chat_id, params.user_id);
      return this.ok(true);
    } catch (e) {
      return this.error(400, e.message);
    }
  }

  async setChatTitle(bot: Bot, params: { chat_id: number; title: string }): Promise<ITelegramApiResponse> {
    try {
      await this.chatsService.updateChat(params.chat_id, { title: params.title }, null);
      return this.ok(true);
    } catch (e) {
      return this.error(400, e.message);
    }
  }

  async setChatDescription(bot: Bot, params: { chat_id: number; description: string }): Promise<ITelegramApiResponse> {
    try {
      await this.chatsService.updateChat(params.chat_id, { description: params.description }, null);
      return this.ok(true);
    } catch (e) {
      return this.error(400, e.message);
    }
  }

  // ─── Callbacks ────────────────────────────────────────
  async answerCallbackQuery(bot: Bot, params: { callback_query_id: string; text?: string; show_alert?: boolean }): Promise<ITelegramApiResponse> {
    try {
      await this.callbackQueriesService.answerCallbackQuery(params.callback_query_id, {
        text: params.text,
        showAlert: params.show_alert
      });
      return this.ok(true);
    } catch (e) {
      return this.error(400, e.message);
    }
  }

  // ─── Files ────────────────────────────────────────────
  async getFile(bot: Bot, params: { file_id: string }): Promise<ITelegramApiResponse> {
    try {
      const { file, url } = await this.filesService.getFile(params.file_id);
      return this.ok({
        file_id: file.fileId,
        file_unique_id: file.fileUniqueId,
        file_size: file.fileSize,
        file_path: url
      });
    } catch (e) {
      return this.error(400, e.message);
    }
  }

  // ─── Helpers ──────────────────────────────────────────
  private formatMessage(msg: any) {
    const json = msg.toJSON ? msg.toJSON() : msg;
    return {
      message_id: json.id,
      from: json.senderBotId ? { id: json.senderBotId, is_bot: true } : { id: json.senderUserId, is_bot: false },
      chat: { id: json.chatId },
      date: Math.floor(new Date(json.createdAt).getTime() / 1000),
      text: json.content,
      ...(json.replyMarkup ? { reply_markup: json.replyMarkup } : {}),
      ...(json.replyToMessageId ? { reply_to_message: { message_id: json.replyToMessageId } } : {})
    };
  }
}
