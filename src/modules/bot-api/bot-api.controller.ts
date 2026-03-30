import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BotApiService } from './bot-api.service';
import { BotApiAuthGuard } from './guards/bot-api-auth.guard';
import { CurrentBot } from './decorators/bot.decorator';
import { Bot } from '../bots/model/bots.model';
import { MessageType } from 'src/core/enums/entity.enum';

@ApiTags('Bot API')
@UseGuards(BotApiAuthGuard)
@Controller('bot:token')
export class BotApiController {
  constructor(private botApiService: BotApiService) {}

  // ─── Info ─────────────────────────────────────────────
  @ApiOperation({ summary: 'getMe — информация о боте' })
  @Post('getMe')
  getMe(@CurrentBot() bot: Bot) {
    return this.botApiService.getMe(bot);
  }

  // ─── Messages ─────────────────────────────────────────
  @ApiOperation({ summary: 'sendMessage — отправить сообщение' })
  @Post('sendMessage')
  sendMessage(@CurrentBot() bot: Bot, @Body() body: { chat_id: number; text: string; reply_markup?: object; reply_to_message_id?: number }) {
    return this.botApiService.sendMessage(bot, body);
  }

  @ApiOperation({ summary: 'editMessageText — редактировать сообщение' })
  @Post('editMessageText')
  editMessageText(@CurrentBot() bot: Bot, @Body() body: { chat_id: number; message_id: number; text: string; reply_markup?: object }) {
    return this.botApiService.editMessageText(bot, body);
  }

  @ApiOperation({ summary: 'deleteMessage — удалить сообщение' })
  @Post('deleteMessage')
  deleteMessage(@CurrentBot() bot: Bot, @Body() body: { chat_id: number; message_id: number }) {
    return this.botApiService.deleteMessage(bot, body);
  }

  @ApiOperation({ summary: 'forwardMessage — переслать сообщение' })
  @Post('forwardMessage')
  forwardMessage(@CurrentBot() bot: Bot, @Body() body: { chat_id: number; from_chat_id: number; message_id: number }) {
    return this.botApiService.forwardMessage(bot, body);
  }

  @ApiOperation({ summary: 'sendPhoto — отправить фото' })
  @Post('sendPhoto')
  sendPhoto(@CurrentBot() bot: Bot, @Body() body: { chat_id: number; photo: string; caption?: string; reply_markup?: object }) {
    return this.botApiService.sendMedia(bot, { chat_id: body.chat_id, type: MessageType.PHOTO, file_id: body.photo, caption: body.caption, reply_markup: body.reply_markup });
  }

  @ApiOperation({ summary: 'sendDocument — отправить документ' })
  @Post('sendDocument')
  sendDocument(@CurrentBot() bot: Bot, @Body() body: { chat_id: number; document: string; caption?: string; reply_markup?: object }) {
    return this.botApiService.sendMedia(bot, { chat_id: body.chat_id, type: MessageType.DOCUMENT, file_id: body.document, caption: body.caption, reply_markup: body.reply_markup });
  }

  @ApiOperation({ summary: 'sendAudio — отправить аудио' })
  @Post('sendAudio')
  sendAudio(@CurrentBot() bot: Bot, @Body() body: { chat_id: number; audio: string; caption?: string; reply_markup?: object }) {
    return this.botApiService.sendMedia(bot, { chat_id: body.chat_id, type: MessageType.AUDIO, file_id: body.audio, caption: body.caption, reply_markup: body.reply_markup });
  }

  @ApiOperation({ summary: 'sendVideo — отправить видео' })
  @Post('sendVideo')
  sendVideo(@CurrentBot() bot: Bot, @Body() body: { chat_id: number; video: string; caption?: string; reply_markup?: object }) {
    return this.botApiService.sendMedia(bot, { chat_id: body.chat_id, type: MessageType.VIDEO, file_id: body.video, caption: body.caption, reply_markup: body.reply_markup });
  }

  @ApiOperation({ summary: 'sendSticker — отправить стикер' })
  @Post('sendSticker')
  sendSticker(@CurrentBot() bot: Bot, @Body() body: { chat_id: number; sticker: string; reply_markup?: object }) {
    return this.botApiService.sendMedia(bot, { chat_id: body.chat_id, type: MessageType.STICKER, file_id: body.sticker, reply_markup: body.reply_markup });
  }

  @ApiOperation({ summary: 'sendLocation — отправить локацию' })
  @Post('sendLocation')
  sendLocation(@CurrentBot() bot: Bot, @Body() body: { chat_id: number; latitude: number; longitude: number; reply_markup?: object }) {
    return this.botApiService.sendMedia(bot, { chat_id: body.chat_id, type: MessageType.LOCATION, file_id: '', caption: JSON.stringify({ lat: body.latitude, lng: body.longitude }), reply_markup: body.reply_markup });
  }

  @ApiOperation({ summary: 'sendContact — отправить контакт' })
  @Post('sendContact')
  sendContact(@CurrentBot() bot: Bot, @Body() body: { chat_id: number; phone_number: string; first_name: string; last_name?: string; reply_markup?: object }) {
    return this.botApiService.sendMedia(bot, { chat_id: body.chat_id, type: MessageType.CONTACT, file_id: '', caption: JSON.stringify(body), reply_markup: body.reply_markup });
  }

  // ─── Updates ──────────────────────────────────────────
  @ApiOperation({ summary: 'getUpdates — long polling обновлений' })
  @Post('getUpdates')
  getUpdates(@CurrentBot() bot: Bot, @Body() body: { offset?: number; limit?: number; timeout?: number }) {
    return this.botApiService.getUpdates(bot, body);
  }

  // ─── Webhooks ─────────────────────────────────────────
  @ApiOperation({ summary: 'setWebhook — настроить webhook' })
  @Post('setWebhook')
  setWebhook(@CurrentBot() bot: Bot, @Body() body: { url: string; secret?: string; allowed_updates?: string[]; max_connections?: number }) {
    return this.botApiService.setWebhook(bot, body);
  }

  @ApiOperation({ summary: 'deleteWebhook — удалить webhook' })
  @Post('deleteWebhook')
  deleteWebhook(@CurrentBot() bot: Bot) {
    return this.botApiService.deleteWebhook(bot);
  }

  @ApiOperation({ summary: 'getWebhookInfo — информация о webhook' })
  @Post('getWebhookInfo')
  getWebhookInfo(@CurrentBot() bot: Bot) {
    return this.botApiService.getWebhookInfo(bot);
  }

  // ─── Chats ────────────────────────────────────────────
  @ApiOperation({ summary: 'getChat — информация о чате' })
  @Post('getChat')
  getChat(@CurrentBot() bot: Bot, @Body() body: { chat_id: number }) {
    return this.botApiService.getChat(bot, body);
  }

  @ApiOperation({ summary: 'getChatMember — информация об участнике' })
  @Post('getChatMember')
  getChatMember(@CurrentBot() bot: Bot, @Body() body: { chat_id: number; user_id: number }) {
    return this.botApiService.getChatMember(bot, body);
  }

  @ApiOperation({ summary: 'getChatMembersCount — количество участников' })
  @Post('getChatMembersCount')
  getChatMembersCount(@CurrentBot() bot: Bot, @Body() body: { chat_id: number }) {
    return this.botApiService.getChatMembersCount(bot, body);
  }

  @ApiOperation({ summary: 'banChatMember — заблокировать участника' })
  @Post('banChatMember')
  banChatMember(@CurrentBot() bot: Bot, @Body() body: { chat_id: number; user_id: number }) {
    return this.botApiService.banChatMember(bot, body);
  }

  @ApiOperation({ summary: 'unbanChatMember — разблокировать участника' })
  @Post('unbanChatMember')
  unbanChatMember(@CurrentBot() bot: Bot, @Body() body: { chat_id: number; user_id: number }) {
    return this.botApiService.unbanChatMember(bot, body);
  }

  @ApiOperation({ summary: 'setChatTitle — изменить название чата' })
  @Post('setChatTitle')
  setChatTitle(@CurrentBot() bot: Bot, @Body() body: { chat_id: number; title: string }) {
    return this.botApiService.setChatTitle(bot, body);
  }

  @ApiOperation({ summary: 'setChatDescription — изменить описание чата' })
  @Post('setChatDescription')
  setChatDescription(@CurrentBot() bot: Bot, @Body() body: { chat_id: number; description: string }) {
    return this.botApiService.setChatDescription(bot, body);
  }

  // ─── Callbacks ────────────────────────────────────────
  @ApiOperation({ summary: 'answerCallbackQuery — ответ на callback' })
  @Post('answerCallbackQuery')
  answerCallbackQuery(@CurrentBot() bot: Bot, @Body() body: { callback_query_id: string; text?: string; show_alert?: boolean }) {
    return this.botApiService.answerCallbackQuery(bot, body);
  }

  // ─── Files ────────────────────────────────────────────
  @ApiOperation({ summary: 'getFile — получить ссылку на файл' })
  @Post('getFile')
  getFile(@CurrentBot() bot: Bot, @Body() body: { file_id: string }) {
    return this.botApiService.getFile(bot, body);
  }
}
