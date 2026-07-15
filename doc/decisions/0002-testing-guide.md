# Bot API Gateway — Руководство по тестированию

## 1. Подготовка среды

### 1.1. Инфраструктура (Docker Compose)

```bash
# Поднять зависимости
docker compose up -d postgres rabbitmq redis

# Убедиться что всё работает
docker compose ps
```

Минимальный `docker-compose.yml` для тестирования:

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  rabbitmq:
    image: rabbitmq:3-management
    ports:
      - "5672:5672"    # AMQP
      - "15672:15672"  # Management UI
    environment:
      RABBITMQ_DEFAULT_USER: guest
      RABBITMQ_DEFAULT_PASS: guest

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  pgdata:
```

### 1.2. Базы данных

```bash
# Создать БД для chat-bot
createdb -U postgres chat_bot

# Создать БД для chat_server (если нет)
createdb -U postgres chat_server
```

### 1.3. Environment

```bash
# chat-bot (скопировать и настроить)
cp .env.example env/.development.env

# Обязательные переменные:
# RABBITMQ_URL=amqp://guest:guest@localhost:5672
# BOT_TOKEN_ENCRYPTION_KEY=$(openssl rand -hex 32)
# DATABASE_URL=postgres://postgres:postgres@localhost:5432/chat_bot

# chat_server — добавить в свой env файл:
# RABBITMQ_URL=amqp://guest:guest@localhost:5672
```

### 1.4. Миграции

```bash
# chat_server
cd ../chat_server
npm run migration -- --to up

# chat-bot
cd ../chat-bot
npm run migration -- --to up
```

### 1.5. Запуск

```bash
# Терминал 1: chat_server
cd ../chat_server && npm run start:dev

# Терминал 2: chat-bot
cd ../chat-bot && npm run start:dev
```

---

## 2. Функциональное тестирование

### 2.1. Проверка RabbitMQ

Открыть http://localhost:15672 (guest/guest). Убедиться:
- Видны exchanges: `chat.events`, `bot.commands`
- Есть очереди: `chat-server.bot-commands.*`, `bot-gateway.chat-events.*`
- Оба сервиса подключены (вкладка Connections)

### 2.2. Создать бота

> **Важно:** для создания бота нужна JWT-авторизация владельца. Предварительно залогиньтесь в chat_server и получите cookie `access_token`.

```bash
# Создание бота
curl -X POST http://localhost:3001/api/bots \
  -H "Content-Type: application/json" \
  -H "Cookie: access_token=<YOUR_JWT>" \
  -d '{
    "username": "test_bot",
    "displayName": "Тестовый Бот",
    "description": "Бот для тестирования",
    "commands": [
      { "command": "/start", "description": "Начать работу"Ш },
      { "command": "help", "description": "Показать помощь" }
    ]
  }'

# Ответ содержит token — СОХРАНИТЕ ЕГО!
# { "ok": true, "result": { "commands": [...], "token": "1:abc123..." } }
```

Запишите:
```bash
export BOT_TOKEN="<полученный токен>"
```

### 2.3. Проверить getMe

```bash
curl -X POST http://localhost:3001/api/bot${BOT_TOKEN}/getMe
# { "ok": true, "result": { "id": 1, "is_bot": true, "first_name": "Тестовый Бот", "username": "test_bot" } }
```

### 2.4. Отправить сообщение

```bash
# Подставьте UUID топика из chat_server
export TOPIC_ID="<uuid топика куда добавлен бот>"

curl -X POST http://localhost:3001/api/bot${BOT_TOKEN}/sendMessage \
  -H "Content-Type: application/json" \
  -d "{
    \"chat_id\": \"${TOPIC_ID}\",
    \"text\": \"Привет из Bot API! 🤖\"
  }"
# { "ok": true, "result": { "message_id": "...", "chat": {...}, "date": ..., "text": "..." } }
```

### 2.5. Получить обновления (Long Polling)

```bash
# В одном терминале — ждём обновления
curl -X POST http://localhost:3001/api/bot${BOT_TOKEN}/getUpdates \
  -H "Content-Type: application/json" \
  -d '{ "timeout": 30 }'

# В другом терминале / через UI — отправьте сообщение в тот же топик обычным пользователем
# Первый запрос вернёт update с этим сообщением
```

### 2.6. Редактировать/удалить сообщение

```bash
# Используйте message_id из ответа sendMessage
export MSG_ID="<message_id>"

# Редактировать
curl -X POST http://localhost:3001/api/bot${BOT_TOKEN}/editMessageText \
  -H "Content-Type: application/json" \
  -d "{
    \"chat_id\": \"${TOPIC_ID}\",
    \"message_id\": \"${MSG_ID}\",
    \"text\": \"Отредактировано ботом ✏️\"
  }"

# Удалить
curl -X POST http://localhost:3001/api/bot${BOT_TOKEN}/deleteMessage \
  -H "Content-Type: application/json" \
  -d "{
    \"chat_id\": \"${TOPIC_ID}\",
    \"message_id\": \"${MSG_ID}\"
  }"
```

### 2.7. Webhook

```bash
# Установить webhook (используйте webhook.site для тестирования)
curl -X POST http://localhost:3001/api/bot${BOT_TOKEN}/setWebhook \
  -H "Content-Type: application/json" \
  -d '{ "url": "https://webhook.site/<your-uuid>" }'

# Проверить
curl -X POST http://localhost:3001/api/bot${BOT_TOKEN}/getWebhookInfo

# Удалить
curl -X POST http://localhost:3001/api/bot${BOT_TOKEN}/deleteWebhook
```

---

## 3. Чеклист E2E тестирования

| # | Тест | Как проверить | Ожидание |
|---|------|---------------|----------|
| 1 | Создание бота | POST /api/bots | 200 + token в ответе |
| 1a | Команды бота | POST/PATCH /api/bots с `commands` → GET /api/bots | Команды сохраняются в `bots.commands` и возвращаются в ответе |
| 2 | getMe | POST /bot{token}/getMe | Данные бота |
| 3 | sendMessage | POST /bot{token}/sendMessage | message_id в ответе + сообщение видно в чате |
| 4 | getUpdates (пустые) | POST /bot{token}/getUpdates {timeout:5} | [] через 5 сек |
| 5 | getUpdates (с данными) | Отправить сообщение в топик → getUpdates | update с message |
| 6 | editMessageText | Редактировать → проверить в чате | Текст изменился |
| 7 | deleteMessage | Удалить → проверить в чате | Сообщение удалено |
| 8 | setWebhook | Установить → отправить сообщение | POST на webhook.site |
| 9 | deleteWebhook | Удалить → отправить → getUpdates | Updates приходят через polling |
| 10 | Невалидный токен | POST /bot{invalid}/getMe | 401 Unauthorized |
| 11 | Деактивация бота | POST /api/bots/:id/deactivate → getMe | 401 Unauthorized |
| 12 | Реактивация бота | POST /api/bots/:id/activate → getMe | 200 OK |

---

## 4. Нагрузочное тестирование

### 4.1. Инструменты

- **[k6](https://k6.io/)** — рекомендуется, нативная поддержка HTTP, скрипты на JS
- **[autocannon](https://github.com/mcollina/autocannon)** — простой HTTP бенчмарк из npm
- **[wrk](https://github.com/wg/wrk)** — высокопроизводительный C-based бенчмарк

### 4.2. Установка k6

```bash
# macOS
brew install k6

# или через Docker
docker run --rm -i grafana/k6 run - < script.js
```

### 4.3. Сценарий 1: sendMessage throughput

Файл `tests/load/send-message.js`:

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

const BOT_TOKEN = __ENV.BOT_TOKEN;
const TOPIC_ID = __ENV.TOPIC_ID;
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // ramp up до 10 VU
    { duration: '1m',  target: 10 },   // steady 10 VU
    { duration: '30s', target: 50 },   // ramp up до 50 VU
    { duration: '1m',  target: 50 },   // steady 50 VU
    { duration: '30s', target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],  // 95% запросов < 2 сек
    http_req_failed: ['rate<0.01'],     // менее 1% ошибок
  },
};

export default function () {
  const payload = JSON.stringify({
    chat_id: TOPIC_ID,
    text: `Load test message ${Date.now()} from VU ${__VU}`,
  });

  const res = http.post(
    `${BASE_URL}/api/bot${BOT_TOKEN}/sendMessage`,
    payload,
    { headers: { 'Content-Type': 'application/json' } }
  );

  check(res, {
    'status 200': (r) => r.status === 200,
    'ok is true': (r) => JSON.parse(r.body).ok === true,
  });

  sleep(0.1); // 100ms пауза между запросами
}
```

Запуск:

```bash
k6 run \
  -e BOT_TOKEN="1:abc123..." \
  -e TOPIC_ID="uuid-of-topic" \
  tests/load/send-message.js
```

### 4.4. Сценарий 2: getUpdates long polling concurrency

```javascript
import http from 'k6/http';
import { check } from 'k6';

const BOT_TOKEN = __ENV.BOT_TOKEN;
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

export const options = {
  vus: 100,           // 100 параллельных long-polling соединений
  duration: '2m',
  thresholds: {
    http_req_duration: ['p(95)<35000'],  // timeout 30s + overhead
  },
};

export default function () {
  const payload = JSON.stringify({
    offset: 0,
    timeout: 30,
    limit: 10,
  });

  const res = http.post(
    `${BASE_URL}/api/bot${BOT_TOKEN}/getUpdates`,
    payload,
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: '35s',
    }
  );

  check(res, {
    'status 200': (r) => r.status === 200,
  });
}
```

### 4.5. Сценарий 3: mixed workload

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

const BOT_TOKEN = __ENV.BOT_TOKEN;
const TOPIC_ID = __ENV.TOPIC_ID;
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

export const options = {
  scenarios: {
    send_messages: {
      executor: 'constant-arrival-rate',
      rate: 50,              // 50 сообщений/сек
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 20,
      maxVUs: 100,
    },
    poll_updates: {
      executor: 'constant-vus',
      vus: 10,               // 10 параллельных polling
      duration: '2m',
    },
  },
};

export default function () {
  // 80% — sendMessage, 20% — getUpdates
  if (Math.random() < 0.8) {
    const res = http.post(
      `${BASE_URL}/api/bot${BOT_TOKEN}/sendMessage`,
      JSON.stringify({ chat_id: TOPIC_ID, text: `load ${Date.now()}` }),
      { headers: { 'Content-Type': 'application/json' } }
    );
    check(res, { 'send ok': (r) => r.status === 200 });
  } else {
    const res = http.post(
      `${BASE_URL}/api/bot${BOT_TOKEN}/getUpdates`,
      JSON.stringify({ offset: 0, timeout: 5, limit: 10 }),
      { headers: { 'Content-Type': 'application/json' }, timeout: '10s' }
    );
    check(res, { 'poll ok': (r) => r.status === 200 });
  }
  sleep(0.05);
}
```

### 4.6. На что смотреть

| Метрика | Норма | Проблема |
|---------|-------|----------|
| `http_req_duration p(95)` | < 500ms (send), < 31s (poll) | RabbitMQ деградация или БД тормозит |
| `http_req_failed` | < 1% | Ошибки подключения к RabbitMQ |
| RabbitMQ queues depth | < 1000 | chat_server не успевает обрабатывать |
| DB connections | < pool max (50) | Утечка соединений |
| Memory (RSS) | Стабильный | Утечка памяти при long polling |

### 4.7. Мониторинг во время нагрузки

```bash
# RabbitMQ — очереди
curl -s http://guest:guest@localhost:15672/api/queues | jq '.[].messages'

# PostgreSQL — активные соединения
psql -c "SELECT count(*) FROM pg_stat_activity WHERE datname='chat_bot';"

# Node.js процесс
# Встроенный /health endpoint или process metrics
```

### 4.8. Быстрый тест с autocannon

```bash
# Установка
npm install -g autocannon

# 10 секунд, 10 параллельных соединений
autocannon \
  -c 10 -d 10 \
  -m POST \
  -H "Content-Type=application/json" \
  -b '{"chat_id":"<TOPIC_UUID>","text":"bench test"}' \
  "http://localhost:3001/api/bot<TOKEN>/sendMessage"
```

---

## 5. Отладка проблем

| Симптом | Где смотреть | Причина |
|---------|-------------|---------|
| 401 на все запросы | `bots` таблица, `api_token_hash` | Неверный токен, бот деактивирован |
| sendMessage зависает | RabbitMQ Management → Queues | `chat_server` не consumes bot.commands |
| getUpdates всегда [] | RabbitMQ → chat.events binding | chat_server не публикует events |
| Updates дублируются | `topicBotRegistry` в ChatBridge | Бот зарегистрирован дважды |
| Connection refused | docker compose ps | RabbitMQ/Postgres/Redis не запущен |
