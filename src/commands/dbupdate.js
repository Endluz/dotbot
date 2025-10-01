// src/commands/dbupdate.js

import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
// Import your sequelize instance and models for schema manipulation
import { sequelize, ActiveForge } from '../models/index.js'; 

export default {
    data: new SlashCommandBuilder()
        .setName('dbupdate')
        .setDescription('ADMIN: Runs necessary database schema updates for new features.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // ONLY ADMINS

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const queryInterface = sequelize.getQueryInterface();
        let log = [];

        // 1. Create the ActiveForges table (for /forge and /collect)
        try {
            // Check if the table already exists before attempting to create it
            const tables = await queryInterface.showAllTables();
            if (!tables.includes('ActiveForges')) {
                await ActiveForge.sync({ force: true }); // Sync creates the table if it doesn't exist
                log.push('✅ Table "ActiveForges" created successfully.');
            } else {
                log.push('ℹ️ Table "ActiveForges" already exists. Skipped creation.');
            }
        } catch (error) {
            log.push(`❌ Error creating ActiveForges table: ${error.message}`);
        }

        // 2. Add forge_level column to Users table
        try {
            await queryInterface.addColumn('Users', 'forge_level', {
                type: sequelize.Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 1,
            });
            log.push('✅ Column "forge_level" added to Users.');
        } catch (error) {
            // The column likely already exists, which is fine
            if (!error.message.includes('duplicate column name')) {
                 log.push(`❌ Error adding forge_level: ${error.message}`);
            } else {
                 log.push('ℹ️ Column "forge_level" already exists. Skipped creation.');
            }
        }

        // 3. Add enchant_level column to Users table
        try {
            await queryInterface.addColumn('Users', 'enchant_level', {
                type: sequelize.Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 1,
            });
            log.push('✅ Column "enchant_level" added to Users.');
        } catch (error) {
            // The column likely already exists, which is fine
            if (!error.message.includes('duplicate column name')) {
                 log.push(`❌ Error adding enchant_level: ${error.message}`);
            } else {
                 log.push('ℹ️ Column "enchant_level" already exists. Skipped creation.');
            }
        }

        await interaction.editReply({ 
            content: `**Database Update Report:**\n\n${log.join('\n')}`, 
            ephemeral: true 
        });
    }
};