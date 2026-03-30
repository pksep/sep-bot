import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { User } from './model/users.model';
import { CreateUserDto, LoginUserDto, UpdateUserDto } from './dto/users.dto';
import { AuthService } from '../auth/auth.service';
import * as bcrypt from 'bcryptjs';
import { LoggerService } from '../logger/logger.service';
import { Op } from 'sequelize';
import { Response } from 'express';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User) private userRepository: typeof User,
    private authService: AuthService,
    private logger: LoggerService
  ) {}

  async register(dto: CreateUserDto, response: Response) {
    try {
      const existingUser = await this.userRepository.findOne({
        where: {
          [Op.or]: [{ username: dto.username }, { email: dto.email }]
        }
      });

      if (existingUser) {
        throw new HttpException(
          'Пользователь с таким username или email уже существует',
          HttpStatus.CONFLICT
        );
      }

      const user = await this.userRepository.create({
        username: dto.username,
        email: dto.email,
        passwordHash: dto.password,
        firstName: dto.firstName,
        lastName: dto.lastName
      } as any);

      const token = await this.authService.generateToken({
        id: user.id,
        username: user.username,
        email: user.email
      });

      this.authService.setTokenCookie(response, token);

      const userData = user.toJSON();
      delete userData.passwordHash;

      return { ...userData, token };
    } catch (error) {
      this.logger.error(
        error instanceof Error ? error : new Error(String(error)),
        UsersService.name
      );
      throw error;
    }
  }

  async login(dto: LoginUserDto, response: Response) {
    try {
      const user = await this.userRepository.findOne({
        where: {
          [Op.or]: [{ username: dto.login }, { email: dto.login }]
        }
      });

      if (!user) {
        throw new UnauthorizedException('Неверный логин или пароль');
      }

      if (!user.isActive) {
        throw new HttpException('Аккаунт деактивирован', HttpStatus.FORBIDDEN);
      }

      const passwordEquals = await bcrypt.compare(dto.password, user.passwordHash);
      if (!passwordEquals) {
        throw new UnauthorizedException('Неверный логин или пароль');
      }

      const token = await this.authService.generateToken({
        id: user.id,
        username: user.username,
        email: user.email
      });

      this.authService.setTokenCookie(response, token);

      const userData = user.toJSON();
      delete userData.passwordHash;

      return { ...userData, token };
    } catch (error) {
      this.logger.error(
        error instanceof Error ? error : new Error(String(error)),
        UsersService.name
      );
      throw error;
    }
  }

  async findById(id: number): Promise<User> {
    const user = await this.userRepository.findByPk(id, {
      attributes: { exclude: ['passwordHash'] }
    });
    if (!user) {
      throw new HttpException('Пользователь не найден', HttpStatus.NOT_FOUND);
    }
    return user;
  }

  async findByUsername(username: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { username },
      attributes: { exclude: ['passwordHash'] }
    });
    if (!user) {
      throw new HttpException('Пользователь не найден', HttpStatus.NOT_FOUND);
    }
    return user;
  }

  async update(id: number, dto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);
    await user.update(dto);
    return user;
  }

  async deactivate(id: number): Promise<void> {
    const user = await this.findById(id);
    await user.update({ isActive: false });
  }

  async search(query: string, limit = 20): Promise<User[]> {
    return this.userRepository.findAll({
      where: {
        [Op.or]: [
          { username: { [Op.iLike]: `%${query}%` } },
          { firstName: { [Op.iLike]: `%${query}%` } },
          { lastName: { [Op.iLike]: `%${query}%` } }
        ],
        isActive: true
      },
      attributes: { exclude: ['passwordHash'] },
      limit
    });
  }
}
