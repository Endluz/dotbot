// src/models/UserItem.js (UPDATED with Inventory Helper Methods)

import { DataTypes } from 'sequelize';

/**
 * UserItem model definition, handling the many-to-many relationship
 * between Users and Items, specifically tracking quantity.
 * @param {import('sequelize').Sequelize} sequelize
 */
export default function UserItemModel(sequelize) {
    const UserItem = sequelize.define(
        'UserItem',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            user_id: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            item_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            quantity: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
        },
        {
            timestamps: false,
            tableName: 'UserItems',
        }
    );

    /**
     * Adds a quantity of a specific item to a user's inventory.
     * Creates the record if it doesn't exist, otherwise updates quantity.
     * @param {string} userId The ID of the user.
     * @param {number} itemId The ID of the item.
     * @param {number} quantity The amount to add (default 1).
     */
    UserItem.addItem = async (userId, itemId, quantity = 1) => {
        const itemRecord = await UserItem.findOne({
            where: { user_id: userId, item_id: itemId },
        });

        if (itemRecord) {
            // Item exists: update the quantity
            itemRecord.quantity += quantity;
            await itemRecord.save();
        } else {
            // Item is new: create a new record
            await UserItem.create({
                user_id: userId,
                item_id: itemId,
                quantity: quantity,
            });
        }
    };

    /**
     * Removes a quantity of a specific item from a user's inventory.
     * Destroys the record if the quantity hits zero.
     * @param {string} userId The ID of the user.
     * @param {number} itemId The ID of the item.
     * @param {number} quantity The amount to remove (default 1).
     */
    UserItem.removeItem = async (userId, itemId, quantity = 1) => {
        const itemRecord = await UserItem.findOne({
            where: { user_id: userId, item_id: itemId },
        });

        if (!itemRecord) {
            // Cannot remove an item that doesn't exist
            return; 
        }

        itemRecord.quantity -= quantity;

        if (itemRecord.quantity <= 0) {
            // Quantity zero or less: destroy the record
            await itemRecord.destroy();
        } else {
            // Quantity still positive: save the updated count
            await itemRecord.save();
        }
    };

    return UserItem;
}