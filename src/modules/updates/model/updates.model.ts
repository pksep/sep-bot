import {
  Model,
  Column,
  DataType,
  Table,
  CreatedAt
} from 'sequelize-typescript';

export interface UpdateCreationAttributes {
  botId: number;
  type: string;
  payload: Record<string, unknown>;
}

@Table({
  tableName: 'updates',
  timestamps: true,
  createdAt: true,
  updatedAt: false
})
export class Update extends Model<Update, UpdateCreationAttributes> {
  @Column({
    type: DataType.BIGINT,
    unique: true,
    autoIncrement: true,
    primaryKey: true
  })
  id: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'bot_id'
  })
  botId: number;

  @Column({ type: DataType.STRING, allowNull: false })
  type: string;

  @Column({ type: DataType.JSONB, allowNull: false })
  payload: Record<string, unknown>;

  @CreatedAt
  createdAt: Date;
}
