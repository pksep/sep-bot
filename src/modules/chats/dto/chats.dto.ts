import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ChatType } from 'src/core/enums/entity.enum';

export class CreateChatDto {
  @ApiProperty({ enum: ChatType, example: 'group' })
  @IsEnum(ChatType)
  readonly type: ChatType;

  @ApiProperty({ example: 'My Group', required: false })
  @IsString()
  @IsOptional()
  readonly title?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  readonly description?: string;
}

export class CreatePrivateChatDto {
  @ApiProperty({ example: 42, description: 'ID собеседника' })
  @IsNotEmpty()
  readonly targetUserId: number;
}

export class UpdateChatDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  readonly title?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  readonly description?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  readonly avatarUrl?: string;
}
