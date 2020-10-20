'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Update Current Hosts to the previous default which was platformFeePercent=5
    await queryInterface.sequelize.query(`
      UPDATE "Collectives" as pm
      SET "platformFeePercent" = 5
      WHERE "isHostAccount" IS TRUE
      AND "platformFeePercent" IS NULL
    `);
    // Update Current Hosts to hostFeePercent=0 if they have a bogus value
    await queryInterface.sequelize.query(`
      UPDATE "Collectives" as pm
      SET "hostFeePercent" = 0
      WHERE "isHostAccount" IS TRUE
      AND "hostFeePercent" IS NULL
    `);

    // Update all unhosted collectives to null
    await queryInterface.sequelize.query(`
      UPDATE "Collectives"
      SET "platformFeePercent" = NULL, "hostFeePercent" = NULL
      WHERE "hostCollectiveId" IS NULL
      AND "type" IN ("COLLECTIVE", "FUND")
    `);
  },

  down: async (queryInterface, Sequelize) => {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
  },
};
