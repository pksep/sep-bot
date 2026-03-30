import {
  Model,
  Column,
  DataType,
  Table,
  HasMany,
  BeforeCreate
} from 'sequelize-typescript';
import { ApiProperty } from '@nestjs/swagger';
import * as bcrypt from 'bcryptjs';

@Table({ tableName: 'users', timestamps: true })
export class User extends Model<User> {
  @ApiProperty({ example: 1, description: 'Уникальный идентификатор' })
  @Column({
    type: DataType.INTEGER,
    unique: true,
    autoIncrement: true,
    primaryKey: true
  })
  id: number;

  @ApiProperty({ example: 'john_doe', description: 'Уникальный username' })
  @Column({
    type: DataType.STRING,
    unique: true,
    allowNull: false
  })
  username: string;

  @ApiProperty({ example: 'john@example.com', description: 'Email' })
  @Column({
    type: DataType.STRING,
    unique: true,
    allowNull: false
  })
  email: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    field: 'password_hash'
  })
  passwordHash: string;

  @ApiProperty({ example: 'John', description: 'Имя' })
  @Column({
    type: DataType.STRING,
    allowNull: false,
    field: 'first_name'
  })
  firstName: string;

  @ApiProperty({ example: 'Doe', description: 'Фамилия' })
  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'last_name'
  })
  lastName: string;

  @ApiProperty({ description: 'URL аватара' })
  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'avatar_url'
  })
  avatarUrl: string;

  @ApiProperty({ example: true, description: 'Активен ли пользователь' })
  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  })
  isActive: boolean;

  @BeforeCreate
  static async hashPassword(instance: User) {
    if (instance.passwordHash) {
      instance.passwordHash = await bcrypt.hash(instance.passwordHash, 10);
    }
  }
}
