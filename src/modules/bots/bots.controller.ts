import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BotsService } from './bots.service';
import { CreateBotDto, UpdateBotDto } from './dto/bots.dto';
import { TokenAuth } from '../auth/jwt-auth.guard';
import { UserId } from '../auth/user-id.decorator';

@ApiTags('Bots')
@UseGuards(TokenAuth)
@Controller('bots')
export class BotsController {
  constructor(private botsService: BotsService) {}

  @ApiOperation({ summary: 'Создать бота' })
  @Post('/')
  async createBot(@Body() dto: CreateBotDto, @UserId() userId: number) {
    const { bot, token } = await this.botsService.createBot(dto, userId);
    return {
      ok: true,
      result: {
        bot: { id: bot.id, username: bot.username, displayName: bot.displayName },
        token
      }
    };
  }

  @ApiOperation({ summary: 'Список моих ботов' })
  @Get('/')
  async getMyBots(@UserId() userId: number) {
    return { ok: true, result: await this.botsService.getUserBots(userId) };
  }

  @ApiOperation({ summary: 'Информация о боте' })
  @Get('/:id')
  async getBot(@Param('id') id: number) {
    return { ok: true, result: await this.botsService.findById(id) };
  }

  @ApiOperation({ summary: 'Обновить бота' })
  @Put('/:id')
  async updateBot(@Param('id') id: number, @Body() dto: UpdateBotDto, @UserId() userId: number) {
    return { ok: true, result: await this.botsService.updateBot(id, userId, dto) };
  }

  @ApiOperation({ summary: 'Перегенерировать токен' })
  @Post('/:id/regenerate-token')
  async regenerateToken(@Param('id') id: number, @UserId() userId: number) {
    return { ok: true, result: await this.botsService.regenerateToken(id, userId) };
  }

  @ApiOperation({ summary: 'Деактивировать бота' })
  @Delete('/:id')
  async deactivateBot(@Param('id') id: number, @UserId() userId: number) {
    await this.botsService.deactivateBot(id, userId);
    return { ok: true, result: true };
  }
}
