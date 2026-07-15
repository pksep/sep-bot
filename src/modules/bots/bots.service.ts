import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  OnModuleInit
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Bot, BotCommand, BotWebhookConfig } from './model/bots.model';
import { ChatBridgeService } from '../chat-bridge/chat-bridge.service';
import { ConfigService } from '@nestjs/config';
import {
  createHash,
  randomBytes,
  createCipheriv,
  createDecipheriv
} from 'crypto';
import { LoggerService } from '../logger/logger.service';
import { UpdateBotDto } from './dto/bots.dto';

@Injectable()
export class BotsService implements OnModuleInit {
  private readonly encryptionKey: Buffer;

  constructor(
    @InjectModel(Bot) private readonly botRepository: typeof Bot,
    private readonly chatBridge: ChatBridgeService,
    private readonly configService: ConfigService,
    private readonly logger: LoggerService
  ) {
    const keyHex = this.configService.get<string>('botTokenEncryptionKey');
    this.encryptionKey = keyHex ? Buffer.from(keyHex, 'hex') : randomBytes(32);
  }

  async onModuleInit(): Promise<void> {
    const bots = await this.botRepository.findAll({
      where: { isActive: true }
    });

    for (const bot of bots) {
      this.chatBridge.registerBot(bot.id, bot.chatUserId);
      this.chatBridge.loadBotTopics(bot.id, bot.chatUserId).catch(err => {
        this.logger.error(
          err instanceof Error ? err : new Error(String(err)),
          `BotsService.loadBotTopics(${bot.id})`
        );
      });
    }

    this.logger.log(`Loaded ${bots.length} bots into registry`, 'BotsService');
  }

  // ─── Create ─────────────────────────────────────────────

  async createBot(
    ownerUserId: string,
    username: string,
    displayName: string,
    description?: string,
    avatarUrl?: string
  ): Promise<{ bot: Bot; token: string }> {
    const existing = await this.botRepository.findOne({
      where: { username }
    });
    if (existing) {
      throw new HttpException(
        'Бот с таким username уже существует',
        HttpStatus.CONFLICT
      );
    }

    // 1. Создать пользователя-бота в chat_server
    const chatUser = await this.chatBridge.createBotUser(
      username,
      displayName,
      ownerUserId,
      avatarUrl
    );

    // 2. Создать запись бота (с временным токеном)
    const tempToken = this.generateRawToken(0);
    const tempHash = createHash('sha256').update(tempToken).digest('hex');
    const tempEncrypted = this.encryptToken(tempToken);

    const bot = await this.botRepository.create({
      chatUserId: chatUser.id,
      ownerUserId,
      username,
      displayName,
      description,
      apiToken: tempEncrypted,
      apiTokenHash: tempHash,
      isActive: true
    });

    // 3. Перегенерировать токен с правильным botId
    const finalToken = this.generateRawToken(bot.id);
    const finalHash = createHash('sha256').update(finalToken).digest('hex');
    const finalEncrypted = this.encryptToken(finalToken);

    await bot.update({
      apiToken: finalEncrypted,
      apiTokenHash: finalHash
    });

    await this.chatBridge.updateBotUser(chatUser.id, {
      ex: {
        botOwnerUserId: ownerUserId,
        botId: bot.id,
        isBot: true,
        botUsername: username
      }
    });

    // 4. Зарегистрировать в bridge
    this.chatBridge.registerBot(bot.id, chatUser.id);

    return { bot, token: finalToken };
  }

  // ─── Token verification ─────────────────────────────────

  async verifyToken(rawToken: string): Promise<Bot | null> {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    return this.botRepository.findOne({
      where: { apiTokenHash: tokenHash, isActive: true }
    });
  }

  // ─── Find ───────────────────────────────────────────────

  async findById(id: number): Promise<Bot | null> {
    return this.botRepository.findByPk(id);
  }

  async findByOwner(ownerUserId: string): Promise<Bot[]> {
    return this.botRepository.findAll({ where: { ownerUserId } });
  }

  async findByChatUserId(chatUserId: string): Promise<Bot | null> {
    return this.botRepository.findOne({ where: { chatUserId, isActive: true } });
  }

  async updateBot(
    botId: number,
    ownerUserId: string,
    dto: UpdateBotDto
  ): Promise<Bot> {
    const bot = await this.findOwnedBot(botId, ownerUserId);
    const updateData: Partial<Bot> = {};
    const nextUsername = dto.username?.trim().toLowerCase();
    const nextDisplayName = dto.displayName?.trim();

    if (nextUsername && nextUsername !== bot.username) {
      const existing = await this.botRepository.findOne({
        where: { username: nextUsername }
      });

      if (existing && existing.id !== bot.id) {
        throw new HttpException(
          'Бот с таким username уже существует',
          HttpStatus.CONFLICT
        );
      }

      updateData.username = nextUsername;
    }

    if (nextDisplayName !== undefined && nextDisplayName !== bot.displayName) {
      updateData.displayName = nextDisplayName;
    }

    if (dto.description !== undefined) {
      updateData.description = dto.description;
    }

    if (
      nextUsername !== undefined ||
      nextDisplayName !== undefined ||
      dto.avatarUrl !== undefined
    ) {
      await this.chatBridge.updateBotUser(bot.chatUserId, {
        ...(nextUsername !== undefined ? { nickname: nextUsername } : {}),
        ...(nextDisplayName !== undefined
          ? { displayName: nextDisplayName }
          : {}),
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
        ex: {
          botOwnerUserId: ownerUserId,
          botId: bot.id,
          isBot: true,
          botUsername: nextUsername || bot.username
        }
      });
    }

    if (Object.keys(updateData).length > 0) {
      await bot.update(updateData);
    }

    return bot.reload();
  }

  // ─── Webhook ────────────────────────────────────────────

  async setCommands(botId: number, commands: BotCommand[]): Promise<void> {
    const normalizedCommands = this.normalizeBotCommands(commands);

    await this.botRepository.update(
      { commands: normalizedCommands },
      { where: { id: botId } }
    );
  }

  async getCommands(botId: number): Promise<BotCommand[]> {
    const bot = await this.botRepository.findByPk(botId);
    return bot?.commands || [];
  }

  async getCommandsByChatUserId(chatUserId: string): Promise<BotCommand[]> {
    const bot = await this.findByChatUserId(chatUserId);
    return bot?.commands || [];
  }

  async setWebhook(botId: number, config: BotWebhookConfig): Promise<void> {
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

  async getWebhookInfo(
    botId: number
  ): Promise<BotWebhookConfig | { url: string }> {
    const bot = await this.botRepository.findByPk(botId);
    if (!bot) return { url: '' };
    return bot.webhookConfig || { url: '' };
  }

  // ─── Token ──────────────────────────────────────────────

  async regenerateToken(botId: number, ownerUserId: string): Promise<string> {
    const bot = await this.findOwnedBot(botId, ownerUserId);
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
    const bot = await this.findOwnedBot(botId, ownerUserId);
    const topicIds = await this.chatBridge.getUserTopicIds(bot.chatUserId);
    const failedTopicIds: string[] = [];

    for (const topicId of topicIds) {
      const removed = await this.chatBridge.removeBotFromTopic(
        topicId,
        bot.chatUserId,
        ownerUserId,
        { force: true }
      );

      if (!removed) {
        failedTopicIds.push(topicId);
      }
    }

    if (failedTopicIds.length > 0) {
      throw new HttpException(
        `Не удалось удалить бота из топиков: ${failedTopicIds.join(', ')}`,
        HttpStatus.BAD_GATEWAY
      );
    }

    const isUserDeleted = await this.chatBridge.deleteBotUser(bot.chatUserId);

    if (!isUserDeleted) {
      throw new HttpException(
        'Не удалось удалить пользователя-бота из chat_server',
        HttpStatus.BAD_GATEWAY
      );
    }

    this.chatBridge.unregisterBot(botId);
    await bot.destroy();
  }

  async activateBot(botId: number, ownerUserId: string): Promise<void> {
    const bot = await this.findOwnedBot(botId, ownerUserId);
    await bot.update({ isActive: true });
    this.chatBridge.registerBot(bot.id, bot.chatUserId);
    await this.chatBridge.loadBotTopics(bot.id, bot.chatUserId);
  }

  // ─── Private helpers ────────────────────────────────────

  private async findOwnedBot(botId: number, ownerUserId: string): Promise<Bot> {
    const bot = await this.botRepository.findOne({
      where: { id: botId, ownerUserId }
    });
    if (!bot) {
      throw new HttpException('Бот не найден', HttpStatus.NOT_FOUND);
    }
    return bot;
  }

  private normalizeBotCommands(commands?: BotCommand[]): BotCommand[] {
    if (!commands) {
      return [];
    }

    if (!Array.isArray(commands) || commands.length > 50) {
      throw new BadRequestException('Invalid bot commands');
    }

    const seenCommands = new Set<string>();
    const normalizedCommands: BotCommand[] = [];

    for (const command of commands) {
      const commandName = this.normalizeBotCommandName(command.command);
      const description = command.description?.trim();

      if (!commandName || !description) {
        throw new BadRequestException('Invalid bot command');
      }

      const commandKey = commandName.toLowerCase();

      if (seenCommands.has(commandKey)) {
        throw new BadRequestException(`Duplicate bot command: ${commandName}`);
      }

      seenCommands.add(commandKey);
      normalizedCommands.push({
        command: commandName,
        description
      });
    }

    return normalizedCommands;
  }

  private normalizeBotCommandName(command: string): string {
    const normalized = command
      .trim()
      .replace(/^\/+/, '')
      .split(/\s+/)[0]
      ?.replace(/[^a-zA-Z0-9_-]/g, '');

    return normalized ? `/${normalized}` : '';
  }

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
    return [
      iv.toString('hex'),
      authTag.toString('hex'),
      encrypted.toString('hex')
    ].join(':');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private decryptToken(encrypted: string): string {
    const [ivHex, authTagHex, encryptedHex] = encrypted.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encryptedBuf = Buffer.from(encryptedHex, 'hex');
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    return (
      decipher.update(encryptedBuf).toString('utf8') + decipher.final('utf8')
    );
  }
}
