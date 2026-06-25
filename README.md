# Сеп-бот (sep-bot)

**Бот-шлюз** для корпоративного чата **sep-chat**. Даёт боту Telegram-подобный опыт: с ботом
можно общаться откуда угодно через SDK или HTTP, а сам бот говорит с чатом через надёжную шину
**RabbitMQ** (durable-очереди, ack/redelivery — переживает реконнекты и рестарты).

```
код разработчика → @pksep/bot-api (SDK) → [HTTP /bot{token}/{method}] → sep-bot
                                                                           │  RabbitMQ
                                            chat.events (события чата) ◄────┤
                                            bot.commands (RPC-команды)  ────► chat_server → чат
```

- **Наружу** (для разработчиков ботов): Telegram-style Bot API — `getMe`, `sendMessage`,
  `editMessageText`, `deleteMessage`, `getUpdates` (long-polling), `setWebhook`, `sendDocument`/`sendPhoto`, …
- **Внутрь** (к chat_server): RabbitMQ, exchanges `chat.events` (pub/sub) и `bot.commands` (RPC).
- Полная архитектура — в [`../ARCHITECTURE.md`](../ARCHITECTURE.md).

Связанные пакеты: **`@pksep/bot-api`** (SDK, npm) и **`@pksep/contracts`** (общие типы/константы шины, npm).

## Стек

NestJS 10 · `@golevelup/nestjs-rabbitmq` · Sequelize + PostgreSQL · BullMQ + Redis (доставка webhook) ·
pm2 (прод). **Пакетный менеджер и рантайм — `bun`** (НЕ npm/pnpm/yarn). Локфайл — `bun.lock`.

## Требования

- **bun** (`curl -fsSL https://bun.sh/install | bash`), Node 20
- **PostgreSQL** — отдельная БД для sep-bot (таблицы `bots`, `updates`)
- **RabbitMQ** — тот же брокер, что у chat_server (обязательно)
- **Redis** — для очереди доставки webhook

## Переменные окружения

Источник истины — `env/.development.env.example`. Файл кладётся в `env/.${NODE_ENV}.env`
(`env/.production.env` для прода).

| Переменная | Назначение |
|---|---|
| `PORT` | Порт HTTP API/Swagger. **В контейнере = 5000** (см. `EXPOSE`), локально `3001` |
| `NODE_ENV` | `production` / `development` |
| `ALLOWED_ORIGIN` | CORS-origin (`*` или список) |
| `DATABASE_URL` | Postgres **собственной** БД sep-bot (`postgres://user:pass@host:5432/sep_bot`) |
| `CONNECT_TIMEOUT` / `DB_POOL_LIMIT` | Таймаут БД / размер пула |
| `RABBITMQ_URL` | **Общий** брокер с chat_server (`amqp://user:pass@rabbitmq:5672`) — обязателен |
| `REDIS_URL` | Redis для BullMQ (`redis://redis:6379`) |
| `JWT_SECRET` | Проверка JWT владельца бота (для `BotsController`); обычно общий с chat_server |
| `BOT_TOKEN_ENCRYPTION_KEY` | 32 байта в hex (AES-256-GCM для шифрования api-токенов ботов) |
| `MINIO_DISABLED` | `true` — s3 не нужен (presigned-URL выдаёт chat_server по RPC) |
| `INSTANCE_NAME` | Профиль pm2 из `ecosystem.config.js` (`instance1` и т.д.) |
| `RUN_DB_SETUP` | ⚠️ `true` — **пересоздаёт БД** при старте (см. ниже). В проде держать `false` |
| `INIT_SEP` | Сидирование при первом старте |

## Локальный запуск (bun)

```bash
# 1) зависимости (postgres + rabbitmq + redis)
docker compose up -d                     # или свой compose

# 2) env
cp env/.development.env.example env/.development.env   # поправить под себя

# 3) установка и запуск
bun install
bun run start:dev                        # watch-режим
```

Swagger (Telegram-style методы и CRUD ботов): **`http://localhost:3001/api/docs`**.

## Сборка

```bash
bun run build                            # nest build → dist/
```

> sep-bot зависит от `@pksep/contracts` (npm, `^1.0.2`) — подтягивается автоматически при `bun install`.

Запуск собранного: `bun run start` (или `node dist/main.js` с нужным `NODE_ENV`).

## Миграции

```bash
bun run migrate:up        # применить
bun run migrate:down      # откатить
bun run migrate:status    # статус
```

---

# Деплой в Kubernetes (для DevOps)

Образ собирается из **`Dockerfile-kuber`** (base `node:20-slim` + bun + postgresql-client), запускается
через **pm2-runtime**, слушает порт **5000**.

> ⚠️ **Важно про старт контейнера** (`docker-entrypoint.sh`):
> 1. образ по умолчанию `RUN_DB_SETUP=false` (БД не трогается). Для **первичной**
>    инициализации пустого окружения один раз выставьте `RUN_DB_SETUP=true` через env в k8s →
>    выполнится `bin/deploy/delete-create-db.mjs`, который **УДАЛЯЕТ и пересоздаёт БД** (имя берёт
>    из `DATABASE_URL`). После инициализации верните `false`. На проде с данными — всегда `false`.
> 2. на **каждом** старте выполняется `bun run migrate:up` (накат миграций).
> 3. затем стартует pm2 по профилю `INSTANCE_NAME` из `ecosystem.config.js`.

## 1. Сборка и публикация образа

```bash
docker build -f Dockerfile-kuber \
  --build-arg ENV_FILE=.production.env \
  -t <registry>/sep-bot:<tag> .
docker push <registry>/sep-bot:<tag>
```

`ENV_FILE` копирует `env/<ENV_FILE>` внутрь образа как `env/.production.env`. В k8s лучше **не**
зашивать секреты в образ, а прокидывать env из `Secret` (см. ниже) — тогда `ENV_FILE` можно оставить
шаблоном-плейсхолдером.

> ✅ Зависимости тянутся из npm (`@pksep/contracts` — из реестра), `../contracts` для сборки образа не нужен.

## 2. Инфраструктура

В `kuber/infra` лежит общий Helm-чарт (`infra-chart`) — поднимает **Postgres + Redis**
(StatefulSet'ы). Креды в `kuber/infra/values.yaml` дефолтные (`erp_user/erp_pass`) — **поменять**.

```bash
helm upgrade --install sep-infra ./kuber/infra -n sep --create-namespace \
  --set postgres.password=<СГЕНЕРИРОВАТЬ>
```

> Чарт **НЕ** содержит **RabbitMQ** — он общий с chat_server, его поднимают/подключают отдельно.
> БД `sep_bot` создать заранее (или однократно `RUN_DB_SETUP=true` на первом деплое).

## 3. Секрет с переменными окружения

```bash
kubectl -n sep create secret generic sep-bot-env \
  --from-literal=PORT=5000 \
  --from-literal=NODE_ENV=production \
  --from-literal=DATABASE_URL='postgres://user:pass@postgres:5432/sep_bot' \
  --from-literal=RABBITMQ_URL='amqp://user:pass@rabbitmq:5672' \
  --from-literal=REDIS_URL='redis://redis:6379' \
  --from-literal=JWT_SECRET='<...>' \
  --from-literal=BOT_TOKEN_ENCRYPTION_KEY='<64 hex>' \
  --from-literal=MINIO_DISABLED=true
```

## 4. Деплой приложения (пример манифестов)

В репозитории манифеста приложения нет (есть только инфра-чарт и SSH-CI/CD ниже) — вот рабочий шаблон:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sep-bot
  namespace: sep
spec:
  replicas: 2                     # масштабировать репликами (см. примечание про pm2)
  selector:
    matchLabels: { app: sep-bot }
  template:
    metadata:
      labels: { app: sep-bot }
    spec:
      containers:
        - name: sep-bot
          image: <registry>/sep-bot:<tag>
          ports:
            - containerPort: 5000
          envFrom:
            - secretRef: { name: sep-bot-env }
          env:
            - name: INSTANCE_NAME
              value: "instance1"
            - name: RUN_DB_SETUP   # ⚠️ true ТОЛЬКО на первичной инициализации
              value: "false"
          readinessProbe:
            tcpSocket: { port: 5000 }
            initialDelaySeconds: 20
            periodSeconds: 10
          livenessProbe:
            tcpSocket: { port: 5000 }
            initialDelaySeconds: 40
            periodSeconds: 15
          resources:
            requests: { cpu: "250m", memory: "512Mi" }
            limits:   { cpu: "1",    memory: "2Gi" }
---
apiVersion: v1
kind: Service
metadata:
  name: sep-bot
  namespace: sep
spec:
  selector: { app: sep-bot }
  ports:
    - port: 80
      targetPort: 5000
```

```bash
kubectl apply -f sep-bot.k8s.yaml
kubectl -n sep rollout status deploy/sep-bot
```

> **HTTP-эндпоинта `/health` пока нет** — пробы сделаны по TCP на `:5000`. Для нормальной
> readiness стоит добавить лёгкий `GET /health` (или использовать `GET /api/docs`).

> **pm2 vs реплики.** Образ по умолчанию запускает pm2-профиль `instance1` (`ecosystem.config.js`:
> 8 воркеров `cluster`, `max_old_space 3072` → нужен под с ~6–8 ГБ RAM). В k8s идиоматичнее запускать
> **1 процесс на под** и масштабировать `replicas`/HPA: переопредели команду на
> `node dist/main.js` (или заведи pm2-профиль с `instances: 1`) и снизь лимиты памяти.

## CI/CD

`.github/workflows/deploy.yml`: push в **`main`** → вызывает reusable-workflow
`Denis112345/actions/.github/workflows/deploy-template.yml` (`app_name: sp-server`, `deploy_env: dev`),
который по SSH (`DEV_SSH_*` secrets) разворачивает образ на dev-хосте. Для k8s-пайплайна замените этот
шаг на `docker build/push` + `kubectl apply`/`helm upgrade` из разделов выше.

## Тесты и линт

```bash
bun run test          # все тесты (jest)
bun run test:unit
bun run lint          # eslint --fix
```
