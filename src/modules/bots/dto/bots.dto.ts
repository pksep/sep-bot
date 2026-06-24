import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  Matches
} from 'class-validator';

export class CreateBotDto {
  @ApiProperty({
    example: 'weather_bot',
    description: 'Уникальный username бота'
  })
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  @Matches(/^[a-z0-9_]+$/, {
    message: 'Username может содержать только a-z, 0-9, _'
  })
  username: string;

  @ApiProperty({ example: 'Weather Bot', description: 'Отображаемое имя' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  displayName: string;

  @ApiProperty({
    example: 'Бот прогноза погоды',
    description: 'Описание',
    required: false
  })
  @IsString()
  @IsOptional()
  description?: string;
}
