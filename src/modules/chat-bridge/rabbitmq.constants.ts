/**
 * RabbitMQ exchanges and routing keys — shared contract between services
 */

// Exchanges
export const CHAT_EVENTS_EXCHANGE = 'chat.events';
export const BOT_COMMANDS_EXCHANGE = 'bot.commands';

// Routing keys — Chat Server publishes these
export const RK_MESSAGE_NEW = 'message.new';
export const RK_MESSAGE_EDIT = 'message.edit';
export const RK_MESSAGE_DELETE = 'message.delete';

// Routing keys — Bot Gateway publishes these (RPC)
export const RK_BOT_SEND_MESSAGE = 'bot.send_message';
export const RK_BOT_EDIT_MESSAGE = 'bot.edit_message';
export const RK_BOT_DELETE_MESSAGE = 'bot.delete_message';
export const RK_BOT_CREATE_USER = 'bot.create_user';
export const RK_BOT_GET_TOPIC_INFO = 'bot.get_topic_info';
export const RK_BOT_GET_TOPIC_MEMBERS = 'bot.get_topic_members';
export const RK_BOT_GET_USER_TOPICS = 'bot.get_user_topics';
export const RK_BOT_ADD_TO_TOPIC = 'bot.add_to_topic';
export const RK_BOT_REMOVE_FROM_TOPIC = 'bot.remove_from_topic';

// Queue names
export const QUEUE_BOT_COMMANDS = 'chat-server.bot-commands';
export const QUEUE_CHAT_EVENTS = 'bot-gateway.chat-events';
