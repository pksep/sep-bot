import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';
import { MessageType } from 'src/core/enums/entity.enum';

export class SendMessageDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  readonly chat_id: number;

  @ApiProperty({ example: 'Hello, world!' })
  @IsString()
  readonly text: string;

  @ApiProperty({ required: false, description: 'InlineKeyboardMarkup' })
  @IsObject()
  @IsOptional()
  readonly reply_markup?: object;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  readonly reply_to_message_id?: number;
}

export class EditMessageDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  readonly chat_id: number;

  @ApiProperty({ example: 1 })
  @IsNumber()
  readonly message_id: number;

  @ApiProperty({ example: 'Updated text' })
  @IsString()
  readonly text: string;

  @ApiProperty({ required: false })
  @IsObject()
  @IsOptional()
  readonly reply_markup?: object;
}

export class DeleteMessageDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  readonly chat_id: number;

  @ApiProperty({ example: 1 })
  @IsNumber()
  readonly message_id: number;
}

export class ForwardMessageDto {
  @ApiProperty()
  @IsNumber()
  readonly chat_id: number;

  @ApiProperty()
  @IsNumber()
  readonly from_chat_id: number;

  @ApiProperty()
  @IsNumber()
  readonly message_id: number;
}

export class SendMediaDto {
  @ApiProperty()
  @IsNumber()
  readonly chat_id: number;

  @ApiProperty({ enum: MessageType })
  @IsEnum(MessageType)
  readonly type: MessageType;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  readonly caption?: string;

  @ApiProperty({ description: 'file_id или URL файла' })
  @IsString()
  readonly file_id: string;

  @ApiProperty({ required: false })
  @IsObject()
  @IsOptional()
  readonly reply_markup?: object;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  readonly reply_to_message_id?: number;
}
