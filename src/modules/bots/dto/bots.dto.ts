import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateBotDto {
  @ApiProperty({ example: 'my_cool_bot' })
  @IsString()
  @IsNotEmpty()
  readonly username: string;

  @ApiProperty({ example: 'My Cool Bot' })
  @IsString()
  @IsNotEmpty()
  readonly displayName: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  readonly description?: string;
}

export class UpdateBotDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  readonly displayName?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  readonly description?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  readonly avatarUrl?: string;
}

export class SetWebhookDto {
  @ApiProperty({ example: 'https://example.com/webhook' })
  @IsUrl()
  @IsNotEmpty()
  readonly url: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  readonly secret?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsArray()
  @IsOptional()
  readonly allowed_updates?: string[];

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  readonly max_connections?: number;
}
