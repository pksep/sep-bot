import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChatsService } from './chats.service';
import { CreateChatDto, CreatePrivateChatDto, UpdateChatDto } from './dto/chats.dto';
import { TokenAuth } from '../auth/jwt-auth.guard';
import { UserId } from '../auth/user-id.decorator';

@ApiTags('Chats')
@UseGuards(TokenAuth)
@Controller('chats')
export class ChatsController {
  constructor(private chatsService: ChatsService) {}

  @ApiOperation({ summary: 'Создать группу/канал' })
  @Post('/')
  createGroup(@Body() dto: CreateChatDto, @UserId() userId: number) {
    return this.chatsService.createGroup(dto, userId);
  }

  @ApiOperation({ summary: 'Создать приватный чат' })
  @Post('/private')
  createPrivate(@Body() dto: CreatePrivateChatDto, @UserId() userId: number) {
    return this.chatsService.createPrivateChat(dto, userId);
  }

  @ApiOperation({ summary: 'Получить чат' })
  @Get('/:id')
  getChat(@Param('id') id: number) {
    return this.chatsService.getChat(id);
  }

  @ApiOperation({ summary: 'Обновить чат' })
  @Put('/:id')
  updateChat(@Param('id') id: number, @Body() dto: UpdateChatDto, @UserId() userId: number) {
    return this.chatsService.updateChat(id, dto, userId);
  }
}
