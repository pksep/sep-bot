import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Message } from './model/messages.model';
import { MessageType, SenderType } from 'src/core/enums/entity.enum';
import { User } from '../users/model/users.model';
import { LoggerService } from '../logger/logger.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class MessagesService {
  constructor(
    @InjectModel(Message) private messageRepository: typeof Message,
    private logger: LoggerService,
    private eventEmitter: EventEmitter2
  ) {}

  async sendMessage(params: {
    chatId: number;
    senderType: SenderType;
    senderId: number;
    content: string;
    type?: MessageType;
    metadata?: object;
    replyMarkup?: object;
    replyToMessageId?: number;
  }): Promise<Message> {
    const message = await this.messageRepository.create({
      chatId: params.chatId,
      senderUserId: params.senderType === SenderType.USER ? params.senderId : null,
      senderBotId: params.senderType === SenderType.BOT ? params.senderId : null,
      type: params.type || MessageType.TEXT,
      content: params.content,
      metadata: params.metadata || {},
      replyMarkup: params.replyMarkup || null,
      replyToMessageId: params.replyToMessageId || null
    } as any);

    // Эмитим событие для WebSocket gateway и Update системы
    this.eventEmitter.emit('message.created', {
      message: message.toJSON(),
      senderType: params.senderType
    });

    return this.getMessageById(message.id);
  }

  async editMessage(messageId: number, chatId: number, newContent: string, replyMarkup?: object): Promise<Message> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId, chatId }
    });
    if (!message) throw new HttpException('Сообщение не найдено', HttpStatus.NOT_FOUND);

    await message.update({
      content: newContent,
      isEdited: true,
      ...(replyMarkup !== undefined ? { replyMarkup } : {})
    });

    this.eventEmitter.emit('message.edited', { message: message.toJSON() });

    return this.getMessageById(message.id);
  }

  async deleteMessage(messageId: number, chatId: number): Promise<boolean> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId, chatId }
    });
    if (!message) throw new HttpException('Сообщение не найдено', HttpStatus.NOT_FOUND);

    await message.update({ isDeleted: true });

    this.eventEmitter.emit('message.deleted', { messageId, chatId });

    return true;
  }

  async getMessageById(id: number): Promise<Message> {
    const message = await this.messageRepository.findByPk(id, {
      include: [
        { model: User, as: 'senderUser', attributes: ['id', 'username', 'firstName', 'lastName', 'avatarUrl'] }
      ]
    });
    if (!message) throw new HttpException('Сообщение не найдено', HttpStatus.NOT_FOUND);
    return message;
  }

  async getMessages(chatId: number, limit = 50, offset = 0): Promise<{ rows: Message[]; count: number }> {
    return this.messageRepository.findAndCountAll({
      where: { chatId, isDeleted: false },
      include: [
        { model: User, as: 'senderUser', attributes: ['id', 'username', 'firstName', 'lastName', 'avatarUrl'] }
      ],
      order: [['id', 'DESC']],
      limit,
      offset
    });
  }

  async forwardMessage(fromChatId: number, toChatId: number, messageId: number, senderId: number, senderType: SenderType): Promise<Message> {
    const original = await this.messageRepository.findOne({
      where: { id: messageId, chatId: fromChatId, isDeleted: false }
    });
    if (!original) throw new HttpException('Оригинальное сообщение не найдено', HttpStatus.NOT_FOUND);

    return this.sendMessage({
      chatId: toChatId,
      senderType,
      senderId,
      content: original.content,
      type: original.type,
      metadata: { ...original.metadata as any, forwarded_from: { chat_id: fromChatId, message_id: messageId } }
    });
  }
}
