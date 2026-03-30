import { Model, Column, DataType, Table, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { ApiProperty } from '@nestjs/swagger';
import { User } from 'src/modules/users/model/users.model';
import { Chat } from 'src/modules/chats/model/chats.model';
import { ChatMemberRole } from 'src/core/enums/entity.enum';

@Table({ tableName: 'chat_members', timestamps: true, createdAt: 'joined_at', updatedAt: false })
export class ChatMember extends Model<ChatMember> {
  @Column({ type: DataType.INTEGER, unique: true, autoIncrement: true, primaryKey: true })
  id: number;

  @ForeignKey(() => Chat)
  @Column({ type: DataType.INTEGER, allowNull: false, field: 'chat_id' })
  chatId: number;

  @BelongsTo(() => Chat, { foreignKey: 'chat_id' })
  chat: Chat;

  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER, allowNull: true, field: 'user_id' })
  userId: number;

  @BelongsTo(() => User, { foreignKey: 'user_id', as: 'user' })
  user: User;

  @ApiProperty({ description: 'ID бота (если участник — бот)' })
  @Column({ type: DataType.INTEGER, allowNull: true, field: 'bot_id' })
  botId: number;

  @ApiProperty({ enum: ChatMemberRole })
  @Column({ type: DataType.ENUM(...Object.values(ChatMemberRole)), defaultValue: ChatMemberRole.MEMBER })
  role: ChatMemberRole;

  @Column({ type: DataType.BOOLEAN, defaultValue: false, field: 'is_muted' })
  isMuted: boolean;

  @Column({ type: DataType.BOOLEAN, defaultValue: false, field: 'is_banned' })
  isBanned: boolean;
}
