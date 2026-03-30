import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Bot } from './model/bots.model';
import { CreateBotDto, SetWebhookDto, UpdateBotDto } from './dto/bots.dto';
import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { ConfigConstains } from 'src/configs/env.config';
import { LoggerService } from '../logger/logger.service';
import { User } from '../users/model/users.model';

@Injectable()
export class BotsService {
  private readonly encryptionKey: Buffer;

  constructor(
    @InjectModel(Bot) private botRepository: typeof Bot,
    private configService: ConfigService,
    private logger: LoggerService
  ) {
    const key = this.configService.get<string>(ConfigConstains.botTokenEncryptionKey);
    // Используем SHA-256 от ключа чтобы получить ровно 32 байта
    this.encryptionKey = createHash('sha256').update(key || 'default-key').digest();
  }

  /**
   * Генерирует токен формата: {botId}:{randomHex64}
   */
  private generateRawToken(botId: number): string {
    const secret = randomBytes(32).toString('hex');
    return `${botId}:${secret}`;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private encryptToken(token: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  private decryptToken(encryptedData: string): string {
    const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  async createBot(dto: CreateBotDto, ownerId: number): Promise<{ bot: Bot; token: string }> {
    const existing = await this.botRepository.findOne({ where: { username: dto.username } });
    if (existing) {
      throw new HttpException('Бот с таким username уже существует', HttpStatus.CONFLICT);
    }

    // Создаём бота сначала с placeholder токеном
    const bot = await this.botRepository.create({
      ownerId,
      username: dto.username,
      displayName: dto.displayName,
      description: dto.description,
      apiToken: 'placeholder',
      apiTokenHash: 'placeholder'
    } as any);

    // Генерируем реальный токен с botId
    const rawToken = this.generateRawToken(bot.id);
    const tokenHash = this.hashToken(rawToken);
    const encryptedToken = this.encryptToken(rawToken);

    await bot.update({
      apiToken: encryptedToken,
      apiTokenHash: tokenHash
    });

    return { bot, token: rawToken };
  }

  async regenerateToken(botId: number, ownerId: number): Promise<{ token: string }> {
    const bot = await this.botRepository.findOne({ where: { id: botId, ownerId } });
    if (!bot) throw new HttpException('Бот не найден', HttpStatus.NOT_FOUND);

    const rawToken = this.generateRawToken(bot.id);
    const tokenHash = this.hashToken(rawToken);
    const encryptedToken = this.encryptToken(rawToken);

    await bot.update({
      apiToken: encryptedToken,
      apiTokenHash: tokenHash
    });

    return { token: rawToken };
  }

  /**
   * Верификация токена из Bot API запроса.
   * 1. Парсим botId из первой части токена
   * 2. Вычисляем SHA-256(token)
   * 3. Ищем бота по id + hash
   */
  async verifyToken(token: string): Promise<Bot | null> {
    try {
      const parts = token.split(':');
      if (parts.length !== 2) return null;

      const botId = parseInt(parts[0], 10);
      if (isNaN(botId)) return null;

      const tokenHash = this.hashToken(token);

      const bot = await this.botRepository.findOne({
        where: { id: botId, apiTokenHash: tokenHash, isActive: true }
      });

      return bot;
    } catch (error) {
      this.logger.error(error instanceof Error ? error : new Error(String(error)), BotsService.name);
      return null;
    }
  }

  async findById(id: number): Promise<Bot> {
    const bot = await this.botRepository.findByPk(id, {
      attributes: { exclude: ['apiToken', 'apiTokenHash'] },
      include: [{ model: User, as: 'owner', attributes: ['id', 'username'] }]
    });
    if (!bot) throw new HttpException('Бот не найден', HttpStatus.NOT_FOUND);
    return bot;
  }

  async getUserBots(ownerId: number): Promise<Bot[]> {
    return this.botRepository.findAll({
      where: { ownerId },
      attributes: { exclude: ['apiToken', 'apiTokenHash'] }
    });
  }

  async updateBot(botId: number, ownerId: number, dto: UpdateBotDto): Promise<Bot> {
    const bot = await this.botRepository.findOne({ where: { id: botId, ownerId } });
    if (!bot) throw new HttpException('Бот не найден', HttpStatus.NOT_FOUND);
    await bot.update(dto);
    return this.findById(bot.id);
  }

  async deactivateBot(botId: number, ownerId: number): Promise<void> {
    const bot = await this.botRepository.findOne({ where: { id: botId, ownerId } });
    if (!bot) throw new HttpException('Бот не найден', HttpStatus.NOT_FOUND);
    await bot.update({ isActive: false });
  }

  async setWebhook(botId: number, dto: SetWebhookDto): Promise<boolean> {
    const bot = await this.botRepository.findByPk(botId);
    if (!bot) throw new HttpException('Бот не найден', HttpStatus.NOT_FOUND);
    await bot.update({
      webhookConfig: {
        url: dto.url,
        secret: dto.secret,
        allowedUpdates: dto.allowed_updates,
        maxConnections: dto.max_connections
      }
    });
    return true;
  }

  async deleteWebhook(botId: number): Promise<boolean> {
    const bot = await this.botRepository.findByPk(botId);
    if (!bot) throw new HttpException('Бот не найден', HttpStatus.NOT_FOUND);
    await bot.update({ webhookConfig: null });
    return true;
  }

  async getWebhookInfo(botId: number): Promise<object> {
    const bot = await this.botRepository.findByPk(botId);
    if (!bot) throw new HttpException('Бот не найден', HttpStatus.NOT_FOUND);
    return bot.webhookConfig || { url: '', has_custom_certificate: false, pending_update_count: 0 };
  }
}
