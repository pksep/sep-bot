import { Model, Column, DataType, Table, ForeignKey } from 'sequelize-typescript';
import { User } from 'src/modules/users/model/users.model';

@Table({ tableName: 'files', timestamps: true, createdAt: true, updatedAt: false })
export class FileRecord extends Model<FileRecord> {
  @Column({ type: DataType.INTEGER, unique: true, autoIncrement: true, primaryKey: true })
  id: number;

  @Column({ type: DataType.STRING, unique: true, allowNull: false, field: 'file_id' })
  fileId: string;

  @Column({ type: DataType.STRING, unique: true, allowNull: false, field: 'file_unique_id' })
  fileUniqueId: string;

  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER, allowNull: true, field: 'uploader_user_id' })
  uploaderUserId: number;

  @Column({ type: DataType.INTEGER, allowNull: true, field: 'uploader_bot_id' })
  uploaderBotId: number;

  @Column({ type: DataType.STRING, allowNull: true, field: 'original_name' })
  originalName: string;

  @Column({ type: DataType.STRING, allowNull: true, field: 'mime_type' })
  mimeType: string;

  @Column({ type: DataType.INTEGER, allowNull: true, field: 'file_size' })
  fileSize: number;

  @Column({ type: DataType.STRING, allowNull: false, field: 's3_object_key' })
  s3ObjectKey: string;

  @Column({ type: DataType.STRING, allowNull: false, field: 's3_bucket' })
  s3Bucket: string;
}
