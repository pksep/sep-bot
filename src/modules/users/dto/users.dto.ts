import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'john_doe', description: 'Уникальный username' })
  @IsString()
  @IsNotEmpty()
  readonly username: string;

  @ApiProperty({ example: 'john@example.com', description: 'Email' })
  @IsEmail()
  @IsNotEmpty()
  readonly email: string;

  @ApiProperty({ example: 'StrongPass123!', description: 'Пароль' })
  @IsString()
  @MinLength(6)
  readonly password: string;

  @ApiProperty({ example: 'John', description: 'Имя' })
  @IsString()
  @IsNotEmpty()
  readonly firstName: string;

  @ApiProperty({ example: 'Doe', description: 'Фамилия', required: false })
  @IsString()
  @IsOptional()
  readonly lastName?: string;
}

export class LoginUserDto {
  @ApiProperty({ example: 'john_doe', description: 'Username или email' })
  @IsString()
  @IsNotEmpty()
  readonly login: string;

  @ApiProperty({ example: 'StrongPass123!', description: 'Пароль' })
  @IsString()
  @IsNotEmpty()
  readonly password: string;
}

export class UpdateUserDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  readonly firstName?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  readonly lastName?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  readonly avatarUrl?: string;
}
