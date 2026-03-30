import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BotApiService } from './bot-api.service';
import { BotApiAuthGuard } from './guards/bot-api-auth.guard';
import { CurrentBot } from './decorators/bot.decorator';
import { Bot } from '../bots/model/bots.model';

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
  sendMessage(
    @CurrentBot() bot: Bot,
    @Body()
    body: {
      chat_id: string;
      text: string;
      reply_to_message_id?: string;
      reply_markup?: any;
    }
  ) {
    return this.botApiService.sendMessage(bot, body);
  }

  @ApiOperation({ summary: 'editMessageText — редактировать сообщение' })
  @Post('editMessageText')
  editMessageText(
    @CurrentBot() bot: Bot,
    @Body()
    body: {
      chat_id: string;
      message_id: string;
      text: string;
      reply_markup?: any;
    }
  ) {
    return this.botApiService.editMessageText(bot, body);
  }

  @ApiOperation({ summary: 'deleteMessage — удалить сообщение' })
  @Post('deleteMessage')
  deleteMessage(
    @CurrentBot() bot: Bot,
    @Body()
    body: {
      chat_id: string;
      message_id: string;
    }
  ) {
    return this.botApiService.deleteMessage(bot, body);
  }

  // ─── Updates ──────────────────────────────────────────
  @ApiOperation({ summary: 'getUpdates — long polling обновлений' })
  @Post('getUpdates')
  getUpdates(
    @CurrentBot() bot: Bot,
    @Body()
    body: {
      offset?: number;
      limit?: number;
      timeout?: number;
    }
  ) {
    return this.botApiService.getUpdates(bot, body);
  }

  // ─── Webhooks ─────────────────────────────────────────
  @ApiOperation({ summary: 'setWebhook — настроить webhook' })
  @Post('setWebhook')
  setWebhook(
    @CurrentBot() bot: Bot,
    @Body()
    body: {
      url: string;
      secret?: string;
      allowed_updates?: string[];
    }
  ) {
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
  getChat(@CurrentBot() bot: Bot, @Body() body: { chat_id: string }) {
    return this.botApiService.getChat(bot, body);
  }

  @ApiOperation({ summary: 'getChatMembersCount — количество участников' })
  @Post('getChatMembersCount')
  getChatMembersCount(
    @CurrentBot() bot: Bot,
    @Body() body: { chat_id: string }
  ) {
    return this.botApiService.getChatMembersCount(bot, body);
  }
}
