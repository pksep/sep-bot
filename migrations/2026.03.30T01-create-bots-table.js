'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('bots', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      chat_user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true
      },
      owner_user_id: {
        type: Sequelize.UUID,
        allowNull: false
      },
      username: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      display_name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      api_token: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      api_token_hash: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      },
      webhook_config: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()')
      }
    });

    // Индекс для быстрого поиска по токену
    await queryInterface.addIndex('bots', ['api_token_hash'], {
      unique: true,
      name: 'idx_bots_api_token_hash'
    });

    await queryInterface.addIndex('bots', ['owner_user_id'], {
      name: 'idx_bots_owner_user_id'
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('bots');
  }
};
