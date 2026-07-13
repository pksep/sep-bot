/**
 * RabbitMQ-константы Сеп-бота.
 *
 * Единый источник истины — общий пакет @pksep/contracts.
 * Локальные дубли удалены; здесь только реэкспорт, чтобы не плодить
 * расхождения между Сеп-ботом и chat_server.
 */
export * from '@pksep/contracts';

export const RK_BOT_UPDATE_USER = 'bot.update_user';
export const RK_BOT_DELETE_USER = 'bot.delete_user';
export const RK_BOT_HEALTH_CHECK = 'bot.health_check';
