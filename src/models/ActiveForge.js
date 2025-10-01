// src/models/ActiveForge.js

import { DataTypes } from 'sequelize';

export default (sequelize) => {
    const ActiveForge = sequelize.define('ActiveForge', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        user_id: {
            type: DataTypes.STRING,
            allowNull: false,
            references: {
                model: 'Users',
                key: 'user_id',
            }
        },
        item_name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        start_time: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        duration_minutes: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        is_complete: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
    }, {
        tableName: 'ActiveForges',
        timestamps: false,
    });
    
    return ActiveForge;
};