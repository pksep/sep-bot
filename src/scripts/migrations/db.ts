// Файл, где вы инициализируете Sequelize
import { Sequelize } from 'sequelize';
import * as dotenv from 'dotenv';
import configFactory from '../../configs/env.config';
import { URL } from 'url';

dotenv.config({
  path: `env/.${process.env.NODE_ENV}.env`
});

export function initializeSequelize() {
  const { url } = configFactory().database;
  const databaseUrl = new URL(url);

  const sequelize = new Sequelize(
    databaseUrl.pathname.replace('/', ''),
    databaseUrl.username,
    databaseUrl.password,
    {
      dialect: 'postgres',
      host: databaseUrl.hostname,
      port: Number(databaseUrl.port || 5432)
    }
  );

  return sequelize;
}
