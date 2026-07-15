import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
  ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';

export class BotCommandDto {
  @ApiProperty({ example: '/start', description: 'Slash command name' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(/^\/?[a-zA-Z0-9_-]+$/, {
    message:
      'Command can contain only a-z, A-Z, 0-9, _, - and optional leading /'
  })
  command: string;

  @ApiProperty({ example: 'Start the bot', description: 'Command description' })
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  description: string;
}

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

  @ApiProperty({ example: 'avatars/weather_bot.png', required: false })
  @IsString()
  @IsOptional()
  avatarUrl?: string;
}

export class UpdateBotDto {
  @ApiProperty({
    example: 'weather_bot',
    description: 'Уникальный username бота',
    required: false
  })
  @IsString()
  @IsOptional()
  @MinLength(3)
  @MaxLength(32)
  @Matches(/^[a-z0-9_]+$/, {
    message: 'Username может содержать только a-z, 0-9, _'
  })
  username?: string;

  @ApiProperty({
    example: 'Weather Bot',
    description: 'Отображаемое имя',
    required: false
  })
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(64)
  displayName?: string;

  @ApiProperty({
    example: 'Бот прогноза погоды',
    description: 'Описание',
    required: false
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 'avatars/weather_bot.png', required: false })
  @IsString()
  @IsOptional()
  avatarUrl?: string;
}

export class SetMyCommandsDto {
  @ApiProperty({
    type: [BotCommandDto],
    description: 'Bot commands registered by the bot'
  })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => BotCommandDto)
  commands: BotCommandDto[];
}
