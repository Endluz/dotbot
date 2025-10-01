import { DataTypes } from 'sequelize';

/**
 * Pet model definition. Users can own multiple pets but only one active at a time.
 * @param {import('sequelize').Sequelize} sequelize
 */
export default function PetModel(sequelize) {
  return sequelize.define(
    'Pet',
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      owner_id: {
        type: DataTypes.STRING,
        allowNull: false
      },
      species: {
        type: DataTypes.STRING,
        allowNull: false
      },
      tier: {
        type: DataTypes.STRING,
        allowNull: false
      },
      name: {
        type: DataTypes.STRING,
        allowNull: true
      },
      level: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 1
      },
      acquired_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      }
    },
    {
      timestamps: false
    }
  );
}