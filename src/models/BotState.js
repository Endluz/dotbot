import { DataTypes } from 'sequelize';

/**
 * Simple key/value storage for small pieces of bot state.
 * e.g., lastAnnouncedStreamId
 * @param {import('sequelize').Sequelize} sequelize
 */
export default function BotStateModel(sequelize) {
  return sequelize.define(
    'BotState',
    {
      key: { type: DataTypes.STRING(100), primaryKey: true },
      value: { type: DataTypes.TEXT, allowNull: true }
    },
    { timestamps: false }
  );
}
