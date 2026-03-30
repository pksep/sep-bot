import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ChatMember } from './model/chat-members.model';
import { ChatMemberRole } from 'src/core/enums/entity.enum';
import { User } from '../users/model/users.model';

@Injectable()
export class ChatMembersService {
  constructor(
    @InjectModel(ChatMember) private chatMemberRepository: typeof ChatMember
  ) {}

  async addMember(chatId: number, userId: number, role = ChatMemberRole.MEMBER, botId?: number): Promise<ChatMember> {
    const existing = await this.chatMemberRepository.findOne({
      where: { chatId, ...(userId ? { userId } : { botId }) }
    });
    if (existing) {
      throw new HttpException('Участник уже в чате', HttpStatus.CONFLICT);
    }
    return this.chatMemberRepository.create({ chatId, userId, botId, role } as any);
  }

  async removeMember(chatId: number, userId: number): Promise<void> {
    const member = await this.chatMemberRepository.findOne({ where: { chatId, userId } });
    if (!member) throw new HttpException('Участник не найден', HttpStatus.NOT_FOUND);
    await member.destroy();
  }

  async getChatMembers(chatId: number): Promise<ChatMember[]> {
    return this.chatMemberRepository.findAll({
      where: { chatId, isBanned: false },
      include: [{ model: User, as: 'user', attributes: ['id', 'username', 'firstName', 'lastName', 'avatarUrl'] }]
    });
  }

  async getChatMember(chatId: number, userId: number): Promise<ChatMember> {
    const member = await this.chatMemberRepository.findOne({
      where: { chatId, userId },
      include: [{ model: User, as: 'user', attributes: ['id', 'username', 'firstName', 'lastName'] }]
    });
    if (!member) throw new HttpException('Участник не найден', HttpStatus.NOT_FOUND);
    return member;
  }

  async getChatMembersCount(chatId: number): Promise<number> {
    return this.chatMemberRepository.count({ where: { chatId, isBanned: false } });
  }

  async isMember(chatId: number, userId: number): Promise<boolean> {
    const member = await this.chatMemberRepository.findOne({ where: { chatId, userId, isBanned: false } });
    return !!member;
  }

  async banMember(chatId: number, userId: number): Promise<void> {
    const member = await this.getChatMember(chatId, userId);
    await member.update({ isBanned: true });
  }

  async unbanMember(chatId: number, userId: number): Promise<void> {
    const member = await this.chatMemberRepository.findOne({ where: { chatId, userId } });
    if (member) await member.update({ isBanned: false });
  }

  async promoteMember(chatId: number, userId: number, role: ChatMemberRole): Promise<void> {
    const member = await this.getChatMember(chatId, userId);
    await member.update({ role });
  }

  async getBotsInChat(chatId: number): Promise<ChatMember[]> {
    return this.chatMemberRepository.findAll({
      where: { chatId, botId: { $ne: null } as any, isBanned: false }
    });
  }

  async getUserChats(userId: number): Promise<ChatMember[]> {
    return this.chatMemberRepository.findAll({
      where: { userId, isBanned: false },
      include: ['chat']
    });
  }
}
