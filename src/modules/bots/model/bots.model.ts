import {
  Model,
  Column,
  DataType,
  Table,
  CreatedAt,
  UpdatedAt
} from 'sequelize-typescript';

export interface BotWebhookConfig {
  url: string;
  secret?: string;
  allowedUpdates?: string[];
  maxConnections?: number;
}

export interface BotCommand {
  command: string;
  description: string;
}

export interface BotCreationAttributes {
  chatUserId: string;
  ownerUserId: string;
  username: string;
  displayName: string;
  description?: string;
  commands?: BotCommand[];
  apiToken: string;
  apiTokenHash: string;
  isActive?: boolean;
  webhookConfig?: BotWebhookConfig | null;
}

@Table({ tableName: 'bots', timestamps: true })
export class Bot extends Model<Bot, BotCreationAttributes> {
  @Column({
    type: DataType.INTEGER,
    unique: true,
    autoIncrement: true,
    primaryKey: true
  })
  id: number;

  /** UUID пользователя-бота в chat_server */
  @Column({
    type: DataType.UUID,
    allowNull: false,
    unique: true,
    field: 'chat_user_id'
  })
  chatUserId: string;

  /** UUID владельца бота (пользователь chat_server) */
  @Column({
    type: DataType.UUID,
    allowNull: false,
    field: 'owner_user_id'
  })
  ownerUserId: string;

  @Column({ type: DataType.STRING, allowNull: false, unique: true })
  username: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    field: 'display_name'
  })
  displayName: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  description: string;

  @Column({
    type: DataType.JSONB,
    allowNull: false,
    defaultValue: []
  })
  commands: BotCommand[];

  /** AES-256-GCM зашифрованный токен */
  @Column({
    type: DataType.TEXT,
    allowNull: false,
    field: 'api_token'
  })
  apiToken: string;

  /** SHA-256 хеш токена для быстрого поиска */
  @Column({
    type: DataType.STRING,
    allowNull: false,
    unique: true,
    field: 'api_token_hash'
  })
  apiTokenHash: string;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  })
  isActive: boolean;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
    field: 'webhook_config'
  })
  webhookConfig: BotWebhookConfig | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}
