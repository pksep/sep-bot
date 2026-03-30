import {
  Model, Column, DataType, Table, ForeignKey, BelongsTo, HasMany
} from 'sequelize-typescript';
import { ApiProperty } from '@nestjs/swagger';
import { User } from 'src/modules/users/model/users.model';
import { ChatType } from 'src/core/enums/entity.enum';

@Table({ tableName: 'chats', timestamps: true })
export class Chat extends Model<Chat> {
  @ApiProperty({ example: 1 })
  @Column({ type: DataType.INTEGER, unique: true, autoIncrement: true, primaryKey: true })
  id: number;

  @ApiProperty({ example: 'private', enum: ChatType })
  @Column({ type: DataType.ENUM(...Object.values(ChatType)), allowNull: false })
  type: ChatType;

  @ApiProperty({ example: 'My Group Chat', description: 'Название чата (для групп/каналов)' })
  @Column({ type: DataType.STRING, allowNull: true })
  title: string;

  @ApiProperty({ description: 'Описание чата' })
  @Column({ type: DataType.TEXT, allowNull: true })
  description: string;

  @ApiProperty({ description: 'URL аватара чата' })
  @Column({ type: DataType.STRING, allowNull: true, field: 'avatar_url' })
  avatarUrl: string;

  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER, allowNull: true, field: 'creator_id' })
  creatorId: number;

  @BelongsTo(() => User, { foreignKey: 'creator_id', as: 'creator' })
  creator: User;

  @ApiProperty({ description: 'Настройки чата' })
  @Column({ type: DataType.JSONB, defaultValue: {} })
  settings: object;
}
