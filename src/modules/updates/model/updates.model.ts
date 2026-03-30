import { Model, Column, DataType, Table, ForeignKey } from 'sequelize-typescript';
import { Bot } from 'src/modules/bots/model/bots.model';
import { UpdateType } from 'src/core/enums/entity.enum';

@Table({ tableName: 'updates', timestamps: true, createdAt: true, updatedAt: false })
export class Update extends Model<Update> {
  @Column({ type: DataType.BIGINT, unique: true, autoIncrement: true, primaryKey: true })
  id: number;

  @ForeignKey(() => Bot)
  @Column({ type: DataType.INTEGER, allowNull: false, field: 'bot_id' })
  botId: number;

  @Column({ type: DataType.ENUM(...Object.values(UpdateType)), allowNull: false })
  type: UpdateType;

  @Column({ type: DataType.JSONB, allowNull: false })
  payload: object;

  @Column({ type: DataType.BOOLEAN, defaultValue: false, field: 'is_delivered' })
  isDelivered: boolean;
}
