'use strict';

const OFFICE_VPN_COMMANDS = [
  {
    command: '/vpn',
    description: 'получить ссылку подключения'
  },
  {
    command: '/vpn_status',
    description: 'проверить устройства и трафик'
  },
  {
    command: '/vpn_reset',
    description: 'сбросить только свои устройства и получить новую ссылку'
  }
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('bots');

    if (!table.commands) {
      return;
    }

    await queryInterface.sequelize.query(
      `
        UPDATE "bots"
        SET
          "commands" = CAST(:commands AS jsonb),
          "updatedAt" = NOW()
        WHERE "username" = :username
      `,
      {
        replacements: {
          username: 'office_vpn_bot',
          commands: JSON.stringify(OFFICE_VPN_COMMANDS)
        }
      }
    );
  },

  async down(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('bots');

    if (!table.commands) {
      return;
    }

    await queryInterface.sequelize.query(
      `
        UPDATE "bots"
        SET
          "commands" = '[]'::jsonb,
          "updatedAt" = NOW()
        WHERE "username" = :username
          AND "commands" = CAST(:commands AS jsonb)
      `,
      {
        replacements: {
          username: 'office_vpn_bot',
          commands: JSON.stringify(OFFICE_VPN_COMMANDS)
        }
      }
    );
  }
};
