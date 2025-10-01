// src/models/User.js (UPDATED with Skill and Daily Give Tracking)

import { DataTypes } from 'sequelize';

/**
 * User model definition. Each user holds currency balances and timestamps for
 * passive reward tracking, skill levels, and daily limits.
 * @param {import('sequelize').Sequelize} sequelize
 */
export default function UserModel(sequelize) {
  return sequelize.define(
    'User',
    {
      user_id: {
        type: DataTypes.STRING,
        primaryKey: true
      },
      coins: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      pixie_pouches: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      stardust: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      // ⬅️ FIELDS FOR SKILL TRACKING
      forge_level: { 
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      enchant_level: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      // ⬅️ FIELDS FOR DAILY COIN GIVE LIMIT TRACKING (NEW)
      daily_give_amount: { 
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      daily_give_date: {
        // We use DATEONLY to store just the date (e.g., '2025-10-01') for easy daily resets
        type: DataTypes.DATEONLY, 
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      // ⬅️ END NEW FIELDS
      lastTextAward: {
        type: DataTypes.DATE,
        allowNull: true
      },
      lastVoiceAward: {
        type: DataTypes.DATE,
        allowNull: true
      },
      lastStreamAward: {
        type: DataTypes.DATE,
        allowNull: true
      }
    },
    {
      timestamps: false
    }
  );
}