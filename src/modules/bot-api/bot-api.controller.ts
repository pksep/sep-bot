import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BotApiService } from './bot-api.service';
import { BotApiAuthGuard } from './guards/bot-api-auth.guard';
import { CurrentBot } from './decorators/bot.decorator';
import { Bot } from '../bots/model/bots.model';
import { SetMyCommandsDto } from '../bots/dto/bots.dto';

@ApiTags('Bot API')
@UseGuards(BotApiAuthGuard)
@Controller('bot:token')
export class BotApiController {
  constructor(private botApiService: BotApiService) {}

  @ApiOperation({ summary: 'getMe - get bot info' })
  @Post('getMe')
  getMe(@CurrentBot() bot: Bot) {
    return this.botApiService.getMe(bot);
  }

  @ApiOperation({ summary: 'setMyCommands - register bot commands' })
  @Post('setMyCommands')
  setMyCommands(@CurrentBot() bot: Bot, @Body() body: SetMyCommandsDto) {
    return this.botApiService.setMyCommands(bot, body);
  }

  @ApiOperation({ summary: 'getMyCommands - get bot commands' })
  @Post('getMyCommands')
  getMyCommands(@CurrentBot() bot: Bot) {
    return this.botApiService.getMyCommands(bot);
  }

  @ApiOperation({ summary: 'sendMessage - send a message' })
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

  @ApiOperation({ summary: 'editMessageText - edit a message' })
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

  @ApiOperation({ summary: 'deleteMessage - delete a message' })
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

  @ApiOperation({ summary: 'getUploadUrl - get a presigned upload URL' })
  @Post('getUploadUrl')
  getUploadUrl(
    @CurrentBot() bot: Bot,
    @Body() body: { file_name: string; mime_type?: string }
  ) {
    return this.botApiService.getUploadUrl(bot, body);
  }

  @ApiOperation({ summary: 'sendDocument - send a file by file_id' })
  @Post('sendDocument')
  sendDocument(
    @CurrentBot() bot: Bot,
    @Body()
    body: {
      chat_id: string;
      file_id: string;
      file_name: string;
      file_size: number;
      mime_type?: string;
      thumbnail_path?: string;
      type?: 'IMAGE' | 'VIDEO' | 'FILE';
      caption?: string;
      reply_to_message_id?: string;
    }
  ) {
    return this.botApiService.sendDocument(bot, body);
  }

  @ApiOperation({ summary: 'sendPhoto - send an image by file_id' })
  @Post('sendPhoto')
  sendPhoto(
    @CurrentBot() bot: Bot,
    @Body()
    body: {
      chat_id: string;
      file_id: string;
      file_name: string;
      file_size: number;
      mime_type?: string;
      thumbnail_path?: string;
      caption?: string;
      reply_to_message_id?: string;
    }
  ) {
    return this.botApiService.sendDocument(bot, { ...body, type: 'IMAGE' });
  }

  @ApiOperation({ summary: 'getUpdates - long polling updates' })
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

  @ApiOperation({ summary: 'setWebhook - configure webhook' })
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

  @ApiOperation({ summary: 'deleteWebhook - delete webhook' })
  @Post('deleteWebhook')
  deleteWebhook(@CurrentBot() bot: Bot) {
    return this.botApiService.deleteWebhook(bot);
  }

  @ApiOperation({ summary: 'getWebhookInfo - get webhook info' })
  @Post('getWebhookInfo')
  getWebhookInfo(@CurrentBot() bot: Bot) {
    return this.botApiService.getWebhookInfo(bot);
  }

  @ApiOperation({ summary: 'getChat - get chat info' })
  @Post('getChat')
  getChat(@CurrentBot() bot: Bot, @Body() body: { chat_id: string }) {
    return this.botApiService.getChat(bot, body);
  }

  @ApiOperation({ summary: 'getChatMembersCount - get member count' })
  @Post('getChatMembersCount')
  getChatMembersCount(
    @CurrentBot() bot: Bot,
    @Body() body: { chat_id: string }
  ) {
    return this.botApiService.getChatMembersCount(bot, body);
  }
}
