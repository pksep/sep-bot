import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Headers,
  BadRequestException,
  ParseIntPipe
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BotsService } from './bots.service';
import { CreateBotDto, UpdateBotDto } from './dto/bots.dto';
import { UserId } from '../auth/user-id.decorator';

@ApiTags('Bots Management')
@ApiBearerAuth()
@Controller('bots')
export class BotsController {
  constructor(private botsService: BotsService) {}

  @ApiOperation({ summary: 'Создать нового бота' })
  @Post()
  async createBot(
    @UserId() userId: string,
    @Headers('x-owner-id') ownerHeader: string,
    @Body() dto: CreateBotDto
  ) {
    // В проде владелец берётся из JWT (req.user). Для локального dev-режима,
    // где гард пропускает запрос без user, владельца передаёт клиент в X-Owner-Id.
    const ownerUserId = userId || ownerHeader;
    if (!ownerUserId) {
      throw new BadRequestException(
        'Не удалось определить владельца бота: нет авторизации и заголовка X-Owner-Id'
      );
    }
    const { bot, token } = await this.botsService.createBot(
      ownerUserId,
      dto.username,
      dto.displayName,
      dto.description,
      dto.avatarUrl
    );
    return {
      ok: true,
      result: {
        id: bot.id,
        chat_user_id: bot.chatUserId,
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
        chat_user_id: b.chatUserId,
        username: b.username,
        display_name: b.displayName,
        description: b.description,
        is_active: b.isActive,
        webhook: b.webhookConfig ? { url: b.webhookConfig.url } : null
      }))
    };
  }

  @ApiOperation({ summary: 'Обновить профиль бота' })
  @Patch(':id')
  async updateBot(
    @UserId() userId: string,
    @Headers('x-owner-id') ownerHeader: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBotDto
  ) {
    const ownerUserId = userId || ownerHeader;
    if (!ownerUserId) {
      throw new BadRequestException(
        'Не удалось определить владельца бота: нет авторизации и заголовка X-Owner-Id'
      );
    }

    const bot = await this.botsService.updateBot(id, ownerUserId, dto);

    return {
      ok: true,
      result: {
        id: bot.id,
        chat_user_id: bot.chatUserId,
        username: bot.username,
        display_name: bot.displayName,
        description: bot.description,
        is_active: bot.isActive,
        webhook: bot.webhookConfig ? { url: bot.webhookConfig.url } : null
      }
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
