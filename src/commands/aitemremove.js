import {
    SlashCommandBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    PermissionFlagsBits, // ⬅️ NEW: Import for robust permission checking
} from 'discord.js';
import { Item } from '../models/index.js';

export default {
    data: new SlashCommandBuilder()
        .setName('aitemremove')
        .setDescription('Admin: Remove an item from the database'),

    async execute(interaction) {
        // 1. Permission Check
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: '❌ You do not have permission to use this command.',
                ephemeral: true,
            });
        }

        // Fetch items from DB
        const items = await Item.findAll();

        if (!items.length) {
            return interaction.reply({
                content: '❌ No items found in the database.',
                ephemeral: true,
            });
        }

        // Build dropdown options (limited to 25)
        const options = items.slice(0, 25).map(item =>
            new StringSelectMenuOptionBuilder()
                .setLabel(`${item.name} (ID: ${item.id})`)
                .setValue(item.id.toString()) // Use ID as value
        );

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('admin_remove_item_select')
            .setPlaceholder('Select an item to remove')
            .addOptions(options);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        // 2. Send the selection menu
        const message = await interaction.reply({
            content: '🗑️ Select an item to **permanently remove** from the database (showing first 25 items):',
            components: [row],
            ephemeral: true,
            fetchReply: true, // Needed to create the collector
        });

        // 3. Implement Collector to handle the selection
        const collector = message.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id && i.customId === 'admin_remove_item_select',
            time: 60 * 1000, // 60 seconds to make a selection
        });

        collector.on('collect', async (i) => {
            const itemId = i.values[0];
            const itemToDelete = await Item.findByPk(itemId);

            if (!itemToDelete) {
                // If the item somehow disappeared between the initial fetch and the click
                return i.update({ content: '❌ The selected item could not be found.', components: [] });
            }

            // Perform the deletion
            const itemName = itemToDelete.name;
            await itemToDelete.destroy();
            
            // NOTE: Deleting an Item will likely invalidate all related UserItem records 
            // due to foreign key constraints, which is correct behavior.

            await i.update({ 
                content: `✅ Successfully removed item **${itemName}** (ID: ${itemId}) from the database.`, 
                components: [] 
            });

            collector.stop();
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                // Remove the menu if the admin takes too long
                message.edit({ content: 'Selection timed out. Item removal cancelled.', components: [] }).catch(() => {});
            }
        });
    },
};