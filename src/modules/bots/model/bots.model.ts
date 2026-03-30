import { Model, Column, DataType, Table, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { ApiProperty } from '@nestjs/swagger';
import { User } from 'src/modules/users/model/users.model';

@Table({ tableName: 'bots', timestamps: true })
export class Bot extends Model<Bot> {
  @ApiProperty({ example: 1 })
  @Column({ type: DataType.INTEGER, unique: true, autoIncrement: true, primaryKey: true })
  id: number;

  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER, allowNull: false, field: 'owner_id' })
  ownerId: number;

  @BelongsTo(() => User, { foreignKey: 'owner_id', as: 'owner' })
  owner: User;

  @ApiProperty({ example: 'my_cool_bot' })
  @Column({ type: DataType.STRING, unique: true, allowNull: false })
  username: string;

  @ApiProperty({ example: 'My Cool Bot' })
  @Column({ type: DataType.STRING, allowNull: false, field: 'display_name' })
  displayName: string;

  @ApiProperty({ description: 'Описание бота' })
  @Column({ type: DataType.TEXT, allowNull: true })
  description: string;

  @Column({ type: DataType.STRING, allowNull: true, field: 'avatar_url' })
  avatarUrl: string;

  // Зашифрованный AES-256-GCM токен
  @Column({ type: DataType.TEXT, allowNull: false, field: 'api_token' })
  apiToken: string;

  // SHA-256 хеш для быстрого поиска по индексу
  @Column({ type: DataType.STRING, unique: true, allowNull: false, field: 'api_token_hash' })
  apiTokenHash: string;

  @Column({ type: DataType.BOOLEAN, defaultValue: true, field: 'is_active' })
  isActive: boolean;

  @ApiProperty({ description: 'Конфигурация webhook' })
  @Column({ type: DataType.JSONB, allowNull: true, field: 'webhook_config' })
  webhookConfig: {
    url: string;
    secret?: string;
    allowedUpdates?: string[];
    maxConnections?: number;
  };
}
