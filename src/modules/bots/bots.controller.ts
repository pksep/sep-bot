import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Delete,
  UseGuards,
  ParseIntPipe
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BotsService } from './bots.service';
import { CreateBotDto } from './dto/bots.dto';
import { UserId } from '../auth/user-id.decorator';

@ApiTags('Bots Management')
@ApiBearerAuth()
@Controller('bots')
export class BotsController {
  constructor(private botsService: BotsService) {}

  @ApiOperation({ summary: 'Создать нового бота' })
  @Post()
  async createBot(@UserId() userId: string, @Body() dto: CreateBotDto) {
    const { bot, token } = await this.botsService.createBot(
      userId,
      dto.username,
      dto.displayName,
      dto.description
    );
    return {
      ok: true,
      result: {
        id: bot.id,
        username: bot.username,
        display_name: bot.displayName,
        description: bot.description,
        token // показывается ОДИН РАЗ
      }
    };
  }

  @ApiOperation({ summary: 'Получить список моих ботов' })
  @Get()
  async getMyBots(@UserId() userId: string) {
    const bots = await this.botsService.findByOwner(userId);
    return {
      ok: true,
      result: bots.map(b => ({
        id: b.id,
        username: b.username,
        display_name: b.displayName,
        description: b.description,
        is_active: b.isActive,
        webhook: b.webhookConfig ? { url: b.webhookConfig.url } : null
      }))
    };
  }

  @ApiOperation({ summary: 'Перегенерировать API-токен бота' })
  @Post(':id/regenerate-token')
  async regenerateToken(
    @UserId() userId: string,
    @Param('id', ParseIntPipe) id: number
  ) {
    const token = await this.botsService.regenerateToken(id, userId);
    return { ok: true, result: { token } };
  }

  @ApiOperation({ summary: 'Деактивировать бота' })
  @Post(':id/deactivate')
  async deactivateBot(
    @UserId() userId: string,
    @Param('id', ParseIntPipe) id: number
  ) {
    await this.botsService.deactivateBot(id, userId);
    return { ok: true, result: true };
  }

  @ApiOperation({ summary: 'Активировать бота' })
  @Post(':id/activate')
  async activateBot(
    @UserId() userId: string,
    @Param('id', ParseIntPipe) id: number
  ) {
    await this.botsService.activateBot(id, userId);
    return { ok: true, result: true };
  }
}
