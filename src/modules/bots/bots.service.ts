import {
  HttpException,
  HttpStatus,
  Injectable,
  OnModuleInit
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Bot } from './model/bots.model';
import { ChatBridgeService } from '../chat-bridge/chat-bridge.service';
import { ConfigService } from '@nestjs/config';
import {
  createHash,
  randomBytes,
  createCipheriv,
  createDecipheriv
} from 'crypto';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class BotsService implements OnModuleInit {
  private encryptionKey: Buffer;

  constructor(
    @InjectModel(Bot) private botRepository: typeof Bot,
    private chatBridge: ChatBridgeService,
    private configService: ConfigService,
    private logger: LoggerService
  ) {
    const keyHex = this.configService.get<string>('botTokenEncryptionKey');
    this.encryptionKey = keyHex ? Buffer.from(keyHex, 'hex') : randomBytes(32);
  }

  async onModuleInit() {
    // При старте загружаем всех активных ботов в bridge registry
    const bots = await this.botRepository.findAll({
      where: { isActive: true }
    });
    for (const bot of bots) {
      this.chatBridge.registerBot(bot.id, bot.chatUserId);
      // Загружаем топики бота асинхронно
      this.chatBridge.loadBotTopics(bot.id, bot.chatUserId).catch(err => {
        this.logger.error(err, `BotsService.loadBotTopics(${bot.id})`);
      });
    }
    this.logger.log(`Loaded ${bots.length} bots into registry`, 'BotsService');
  }

  // ─── Create ─────────────────────────────────────────────

  async createBot(
    ownerUserId: string,
    username: string,
    displayName: string,
    description?: string
  ): Promise<{ bot: Bot; token: string }> {
    // Проверка уникальности username
    const existing = await this.botRepository.findOne({ where: { username } });
    if (existing) {
      throw new HttpException(
        'Бот с таким username уже существует',
        HttpStatus.CONFLICT
      );
    }

    // 1. Создать пользователя-бота в chat_server
    const chatUser = await this.chatBridge.createBotUser(username, displayName);

    // 2. Создать запись бота
    const rawToken = this.generateRawToken(0); // temporary, will update
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const encryptedToken = this.encryptToken(rawToken);

    const bot = await this.botRepository.create({
      chatUserId: chatUser.id,
      ownerUserId,
      username,
      displayName,
      description,
      apiToken: encryptedToken,
      apiTokenHash: tokenHash,
      isActive: true
    } as any);

    // 3. Перегенерировать токен с правильным botId
    const finalToken = this.generateRawToken(bot.id);
    const finalHash = createHash('sha256').update(finalToken).digest('hex');
    const finalEncrypted = this.encryptToken(finalToken);

    await bot.update({
      apiToken: finalEncrypted,
      apiTokenHash: finalHash
    });

    // 4. Зарегистрировать в bridge
    this.chatBridge.registerBot(bot.id, chatUser.id);

    return { bot, token: finalToken };
  }

  // ─── Token verification ─────────────────────────────────

  async verifyToken(rawToken: string): Promise<Bot | null> {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const bot = await this.botRepository.findOne({
      where: { apiTokenHash: tokenHash, isActive: true }
    });
    return bot || null;
  }

  // ─── Find ───────────────────────────────────────────────

  async findById(id: number): Promise<Bot | null> {
    return this.botRepository.findByPk(id);
  }

  async findByOwner(ownerUserId: string): Promise<Bot[]> {
    return this.botRepository.findAll({ where: { ownerUserId } });
  }

  // ─── Webhook ────────────────────────────────────────────

  async setWebhook(
    botId: number,
    config: {
      url: string;
      secret?: string;
      allowedUpdates?: string[];
      maxConnections?: number;
    }
  ): Promise<void> {
    await this.botRepository.update(
      { webhookConfig: config },
      { where: { id: botId } }
    );
  }

  async deleteWebhook(botId: number): Promise<void> {
    await this.botRepository.update(
      { webhookConfig: null },
      { where: { id: botId } }
    );
  }

  async getWebhookInfo(botId: number): Promise<any> {
    const bot = await this.botRepository.findByPk(botId);
    if (!bot) return { url: '' };
    return bot.webhookConfig || { url: '' };
  }

  // ─── Token ──────────────────────────────────────────────

  async regenerateToken(botId: number, ownerUserId: string): Promise<string> {
    const bot = await this.botRepository.findOne({
      where: { id: botId, ownerUserId }
    });
    if (!bot) throw new HttpException('Бот не найден', HttpStatus.NOT_FOUND);

    const rawToken = this.generateRawToken(bot.id);
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const encryptedToken = this.encryptToken(rawToken);

    await bot.update({
      apiToken: encryptedToken,
      apiTokenHash: tokenHash
    });

    return rawToken;
  }

  // ─── Activate/Deactivate ────────────────────────────────

  async deactivateBot(botId: number, ownerUserId: string): Promise<void> {
    const bot = await this.botRepository.findOne({
      where: { id: botId, ownerUserId }
    });
    if (!bot) throw new HttpException('Бот не найден', HttpStatus.NOT_FOUND);
    await bot.update({ isActive: false });
    this.chatBridge.unregisterBot(botId);
  }

  async activateBot(botId: number, ownerUserId: string): Promise<void> {
    const bot = await this.botRepository.findOne({
      where: { id: botId, ownerUserId }
    });
    if (!bot) throw new HttpException('Бот не найден', HttpStatus.NOT_FOUND);
    await bot.update({ isActive: true });
    this.chatBridge.registerBot(bot.id, bot.chatUserId);
    await this.chatBridge.loadBotTopics(bot.id, bot.chatUserId);
  }

  // ─── Crypto helpers ─────────────────────────────────────

  private generateRawToken(botId: number): string {
    const secret = randomBytes(32).toString('hex');
    return `${botId}:${secret}`;
  }

  private encryptToken(token: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(token, 'utf8'),
      cipher.final()
    ]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  private decryptToken(encrypted: string): string {
    const [ivHex, authTagHex, encryptedHex] = encrypted.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encryptedBuf = Buffer.from(encryptedHex, 'hex');
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(encryptedBuf) + decipher.final('utf8');
  }
}
