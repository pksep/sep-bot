import { Body, Controller, Get, Param, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto, LoginUserDto, UpdateUserDto } from './dto/users.dto';
import { TokenAuth } from '../auth/jwt-auth.guard';
import { UserId } from '../auth/user-id.decorator';
import { Response } from 'express';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @ApiOperation({ summary: 'Регистрация пользователя' })
  @Post('/register')
  register(
    @Body() dto: CreateUserDto,
    @Res({ passthrough: true }) res: Response
  ) {
    return this.usersService.register(dto, res);
  }

  @ApiOperation({ summary: 'Авторизация пользователя' })
  @Post('/login')
  login(
    @Body() dto: LoginUserDto,
    @Res({ passthrough: true }) res: Response
  ) {
    return this.usersService.login(dto, res);
  }

  @ApiOperation({ summary: 'Получить текущего пользователя' })
  @UseGuards(TokenAuth)
  @Get('/me')
  getMe(@UserId() userId: number) {
    return this.usersService.findById(userId);
  }

  @ApiOperation({ summary: 'Получить пользователя по ID' })
  @UseGuards(TokenAuth)
  @Get('/:id')
  getById(@Param('id') id: number) {
    return this.usersService.findById(id);
  }

  @ApiOperation({ summary: 'Найти пользователей' })
  @UseGuards(TokenAuth)
  @Get('/search')
  search(@Query('q') query: string, @Query('limit') limit?: number) {
    return this.usersService.search(query, limit);
  }

  @ApiOperation({ summary: 'Обновить профиль' })
  @UseGuards(TokenAuth)
  @Put('/me')
  update(@UserId() userId: number, @Body() dto: UpdateUserDto) {
    return this.usersService.update(userId, dto);
  }
}
