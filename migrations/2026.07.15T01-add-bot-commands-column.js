'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('bots');

    if (table.commands) {
      return;
    }

    await queryInterface.addColumn('bots', 'commands', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: []
    });
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('bots');

    if (!table.commands) {
      return;
    }

    await queryInterface.removeColumn('bots', 'commands');
  }
};
