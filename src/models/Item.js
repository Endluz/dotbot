import { DataTypes } from 'sequelize';

/**
 * Shop item model.
 * Tracks purchasable items for the store.
 * @param {import('sequelize').Sequelize} sequelize
 */
export default function ItemModel(sequelize) {
  return sequelize.define(
    'Item',
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: DataTypes.STRING(255), allowNull: false },
      description: { type: DataTypes.STRING(255), allowNull: true },
      cost: { type: DataTypes.INTEGER, allowNull: false },
      type: { type: DataTypes.STRING(255), allowNull: false },
      role_id: { type: DataTypes.STRING(255), allowNull: true },
      seasonal: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
    },
    { timestamps: false }
  );
}
