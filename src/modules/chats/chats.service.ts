import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Chat } from './model/chats.model';
import { CreateChatDto, CreatePrivateChatDto, UpdateChatDto } from './dto/chats.dto';
import { ChatType } from 'src/core/enums/entity.enum';
import { LoggerService } from '../logger/logger.service';
import { User } from '../users/model/users.model';

@Injectable()
export class ChatsService {
  constructor(
    @InjectModel(Chat) private chatRepository: typeof Chat,
    private logger: LoggerService
  ) {}

  async createGroup(dto: CreateChatDto, creatorId: number): Promise<Chat> {
    if (dto.type === ChatType.PRIVATE) {
      throw new HttpException('Используйте createPrivateChat для private чатов', HttpStatus.BAD_REQUEST);
    }
    return this.chatRepository.create({
      type: dto.type,
      title: dto.title,
      description: dto.description,
      creatorId
    } as any);
  }

  async createPrivateChat(dto: CreatePrivateChatDto, userId: number): Promise<Chat> {
    // TODO: проверить, не существует ли уже private чат между этими пользователями
    return this.chatRepository.create({
      type: ChatType.PRIVATE,
      creatorId: userId
    } as any);
  }

  async getChat(chatId: number): Promise<Chat> {
    const chat = await this.chatRepository.findByPk(chatId, {
      include: [{ model: User, as: 'creator', attributes: ['id', 'username', 'firstName', 'lastName'] }]
    });
    if (!chat) {
      throw new HttpException('Чат не найден', HttpStatus.NOT_FOUND);
    }
    return chat;
  }

  async updateChat(chatId: number, dto: UpdateChatDto, userId: number): Promise<Chat> {
    const chat = await this.getChat(chatId);
    // TODO: проверить права пользователя на обновление
    await chat.update(dto);
    return chat;
  }

  async getChatsByUserId(userId: number): Promise<Chat[]> {
    // Будет использовать ChatMembers для получения списка чатов
    return this.chatRepository.findAll({
      include: [{ model: User, as: 'creator', attributes: ['id', 'username'] }],
      order: [['updatedAt', 'DESC']]
    });
  }
}
