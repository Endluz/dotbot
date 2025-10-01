// src/models/index.js (UPDATED)

import { Sequelize } from 'sequelize';
import UserModel from './User.js';
import ItemModel from './Item.js';
import UserItemModel from './UserItem.js';
import PetModel from './Pet.js';
import BotStateModel from './BotState.js';
import ActiveForgeModel from './ActiveForge.js'; // ⬅️ ADDED IMPORT

// Create a Sequelize instance pointing to an SQLite file.
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'database.sqlite',
  logging: false
});

// Initialize models
const User = UserModel(sequelize);
const Item = ItemModel(sequelize);
const UserItem = UserItemModel(sequelize);
const Pet = PetModel(sequelize);
const BotState = BotStateModel(sequelize);
const ActiveForge = ActiveForgeModel(sequelize); // ⬅️ ADDED INITIALIZATION

// Define relations
User.hasMany(UserItem, { foreignKey: 'user_id', as: 'items' });
UserItem.belongsTo(User, { foreignKey: 'user_id' });

Item.hasMany(UserItem, { foreignKey: 'item_id', as: 'userItems' });
UserItem.belongsTo(Item, { foreignKey: 'item_id' });

User.hasMany(Pet, { foreignKey: 'owner_id', as: 'pets' });
Pet.belongsTo(User, { foreignKey: 'owner_id' });

// Define relation for the new model
User.hasMany(ActiveForge, { foreignKey: 'user_id', as: 'activeForges' }); // ⬅️ ADDED RELATION

export { sequelize, User, Item, UserItem, Pet, BotState, ActiveForge }; // ⬅️ ADDED EXPORT