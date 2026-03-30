import {
  Body,
  Controller,
  Post
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @ApiOperation({ summary: 'Проверить токен' })
  @Post('/check')
  check(@Body() body: { token: string }) {
    return this.authService.checkToken(body.token);
  }
}
