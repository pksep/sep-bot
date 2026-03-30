import { generateObjectPath } from 'src/utils/extensions/objects';

export type ConfigType = ReturnType<typeof configFactory>;

export default function configFactory() {
  return {
    port: process.env.PORT!,
    allowedOrigin: process.env.ALLOWED_ORIGIN,
    database: {
      url: process.env.DATABASE_URL!,
      timeout: Number(process.env.CONNECT_TIMEOUT) || 120000
    },
    privateKey: process.env.PRIVATE_KEY!,
    redisUrl: process.env.REDIS_URL!,
    jwtSecret: process.env.JWT_SECRET!,
    botTokenEncryptionKey: process.env.BOT_TOKEN_ENCRYPTION_KEY!,
    rabbitmqUrl: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
    minio: {
      user: process.env.MINIO_ROOT_USER!,
      password: process.env.MINIO_ROOT_PASSWORD!,
      bucketName: process.env.MINIO_BUCKET_NAME!,
      endpoint: process.env.MINIO_ENDPOINT!,
      port: process.env.MINIO_PORT!,
      ssl: process.env.MINIO_USE_SSL!,
      publicBaseUrl: process.env.MINIO_PUBLIC_BASE_URL!,
      isPathStyle: process.env.MINIO_PATH_STYLE!
    }
  } as const;
}

export const ConfigConstains = generateObjectPath(configFactory());
