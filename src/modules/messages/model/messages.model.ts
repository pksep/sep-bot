import { Model, Column, DataType, Table, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { ApiProperty } from '@nestjs/swagger';
import { User } from 'src/modules/users/model/users.model';
import { Chat } from 'src/modules/chats/model/chats.model';
import { MessageType } from 'src/core/enums/entity.enum';

@Table({ tableName: 'messages', timestamps: true, updatedAt: 'edited_at' })
export class Message extends Model<Message> {
  @ApiProperty({ example: 1 })
  @Column({ type: DataType.INTEGER, unique: true, autoIncrement: true, primaryKey: true })
  id: number;

  @ForeignKey(() => Chat)
  @Column({ type: DataType.INTEGER, allowNull: false, field: 'chat_id' })
  chatId: number;

  @BelongsTo(() => Chat, { foreignKey: 'chat_id' })
  chat: Chat;

  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER, allowNull: true, field: 'sender_user_id' })
  senderUserId: number;

  @BelongsTo(() => User, { foreignKey: 'sender_user_id', as: 'senderUser' })
  senderUser: User;

  @ApiProperty({ description: 'ID бота-отправителя' })
  @Column({ type: DataType.INTEGER, allowNull: true, field: 'sender_bot_id' })
  senderBotId: number;

  @ApiProperty({ enum: MessageType })
  @Column({ type: DataType.ENUM(...Object.values(MessageType)), defaultValue: MessageType.TEXT })
  type: MessageType;

  @ApiProperty({ description: 'Текст сообщения' })
  @Column({ type: DataType.TEXT, allowNull: true })
  content: string;

  @ApiProperty({ description: 'Метаданные (file_id, caption, thumbnail и т.д.)' })
  @Column({ type: DataType.JSONB, defaultValue: {} })
  metadata: object;

  @ApiProperty({ description: 'InlineKeyboardMarkup JSON' })
  @Column({ type: DataType.JSONB, allowNull: true, field: 'reply_markup' })
  replyMarkup: object;

  @Column({ type: DataType.INTEGER, allowNull: true, field: 'reply_to_message_id' })
  replyToMessageId: number;

  @Column({ type: DataType.BOOLEAN, defaultValue: false, field: 'is_edited' })
  isEdited: boolean;

  @Column({ type: DataType.BOOLEAN, defaultValue: false, field: 'is_deleted' })
  isDeleted: boolean;
}
