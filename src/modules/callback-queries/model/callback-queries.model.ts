import { Model, Column, DataType, Table, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { User } from 'src/modules/users/model/users.model';
import { Message } from 'src/modules/messages/model/messages.model';

@Table({ tableName: 'callback_queries', timestamps: true, createdAt: true, updatedAt: false })
export class CallbackQuery extends Model<CallbackQuery> {
  @Column({ type: DataType.INTEGER, unique: true, autoIncrement: true, primaryKey: true })
  id: number;

  @Column({ type: DataType.UUID, unique: true, defaultValue: DataType.UUIDV4, field: 'callback_id' })
  callbackId: string;

  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER, allowNull: false, field: 'from_user_id' })
  fromUserId: number;

  @BelongsTo(() => User, { foreignKey: 'from_user_id', as: 'fromUser' })
  fromUser: User;

  @ForeignKey(() => Message)
  @Column({ type: DataType.INTEGER, allowNull: false, field: 'message_id' })
  messageId: number;

  @BelongsTo(() => Message, { foreignKey: 'message_id' })
  message: Message;

  @Column({ type: DataType.INTEGER, allowNull: false, field: 'bot_id' })
  botId: number;

  @Column({ type: DataType.STRING, allowNull: false })
  data: string;

  @Column({ type: DataType.BOOLEAN, defaultValue: false, field: 'is_answered' })
  isAnswered: boolean;
}
