import {
    SlashCommandBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    PermissionFlagsBits, // ⬅️ NEW: Import for robust permission checking
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} from 'discord.js';
import { Item } from '../models/index.js';

export default {
    data: new SlashCommandBuilder()
        .setName('aitemedit')
        .setDescription('Admin: Edit an existing item in the database'),

    async execute(interaction) {
        // 1. Permission Check (using robust constant)
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: '❌ You do not have permission to use this command.',
                ephemeral: true
            });
        }

        const items = await Item.findAll();

        if (!items.length) {
            return interaction.reply({
                content: '❌ No items found in the database.',
                ephemeral: true
            });
        }

        // Discord Select Menus are limited to 25 options.
        // If you have more than 25 items, this needs pagination or an autocomplete text input.
        const options = items.slice(0, 25).map(item =>
            new StringSelectMenuOptionBuilder()
                .setLabel(`${item.name} (ID: ${item.id})`) // ⬅️ Displaying ID is helpful for Admins
                .setValue(item.id.toString())
        );

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('admin_edit_item_select')
            .setPlaceholder('Select an item to edit')
            .addOptions(options);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        // 2. Send the selection menu
        const message = await interaction.reply({
            content: '✏️ Select an item to edit (showing first 25 items):',
            components: [row],
            ephemeral: true,
            fetchReply: true // Needed to create the collector
        });

        // 3. Implement Collector to handle the selection and show the modal
        const collector = message.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id && i.customId === 'admin_edit_item_select',
            time: 60 * 1000 // 60 seconds to make a selection
        });

        collector.on('collect', async (i) => {
            const itemId = i.values[0];
            const selectedItem = items.find(item => item.id.toString() === itemId);

            if (!selectedItem) {
                return i.update({ content: '❌ Item not found in the current session. Try again.', components: [] });
            }

            // Create the Modal, pre-filled with the item's current data
            const modal = new ModalBuilder()
                // Use a dynamic custom ID to pass the item ID for processing
                .setCustomId(`admin_edit_modal_${itemId}`) 
                .setTitle(`Editing: ${selectedItem.name} (ID: ${itemId})`)
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('name')
                            .setLabel('Item Name')
                            .setStyle(TextInputStyle.Short)
                            .setValue(selectedItem.name)
                            .setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('type')
                            .setLabel('Item Type')
                            .setStyle(TextInputStyle.Short)
                            .setValue(selectedItem.type)
                            .setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('cost')
                            .setLabel('Cost (Coins)')
                            .setStyle(TextInputStyle.Short)
                            .setValue(String(selectedItem.cost))
                            .setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('effect')
                            .setLabel('Effect (optional)')
                            .setStyle(TextInputStyle.Short)
                            .setValue(selectedItem.effect || '') // Use empty string if null
                            .setRequired(false)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('seasonal')
                            .setLabel('Seasonal? (yes or no)')
                            .setStyle(TextInputStyle.Short)
                            .setValue(selectedItem.seasonal ? 'yes' : 'no') // Pre-fill
                            .setRequired(true)
                    )
                );

            await i.showModal(modal);

            // Stop the collector once the modal is shown
            collector.stop();
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                // Remove the menu if the admin takes too long
                message.edit({ content: 'Selection timed out.', components: [] }).catch(() => {}); 
            }
        });
    }
};