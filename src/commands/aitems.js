import {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    PermissionFlagsBits,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} from 'discord.js';
import { Item } from '../models/index.js';

export default {
    data: new SlashCommandBuilder()
        .setName('aitems')
        .setDescription('Admin: View and manage all items'),

    async execute(interaction) {
        // 1. SECURITY FIX: Use PermissionFlagsBits constant
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
        }

        const items = await Item.findAll();
        if (!items.length) {
             // Change to ephemeral since all admin output should be private
            return interaction.reply({ content: 'The item list is empty.', ephemeral: true });
        }

        const pageSize = 5;
        let page = 0;
        const totalPages = Math.ceil(items.length / pageSize);

        const generateEmbed = () => {
            const embed = new EmbedBuilder()
                .setTitle('📦 All Items')
                .setDescription(`All items in the database (Page ${page + 1}/${totalPages})`)
                .setColor('#00b0f4');

            const start = page * pageSize;
            const end = start + pageSize;
            const pageItems = items.slice(start, end);

            for (const item of pageItems) {
                let value = `Type: \`${item.type}\``;
                value += item.seasonal ? ' | **Seasonal**' : '';
                value += item.effect ? `\nEffect: \`${item.effect}\`` : '';
                
                embed.addFields({
                    name: `${item.name} (ID: ${item.id}) – ${item.cost} coins`,
                    value: value,
                    inline: false
                });
            }

            return embed;
        };

        const getActionRow = () => {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('admin_item_add')
                    .setLabel('➕ Add Item')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('admin_item_remove')
                    .setLabel('🗑️ Remove Item')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('admin_item_edit')
                    .setLabel('✏️ Edit Item')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('page_prev')
                    .setLabel('⬅️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page === 0),
                new ButtonBuilder()
                    .setCustomId('page_next')
                    .setLabel('➡️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page === totalPages - 1)
            );
        };

        const message = await interaction.reply({
            embeds: [generateEmbed()],
            components: [getActionRow()],
            fetchReply: true,
            ephemeral: true
        });

        const collector = message.createMessageComponentCollector({
            time: 5 * 60 * 1000
        });

        collector.on('collect', async (i) => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: 'These buttons are not for you.', ephemeral: true });
            }

            if (i.customId === 'page_prev') {
                page = Math.max(0, page - 1);
                await i.update({ embeds: [generateEmbed()], components: [getActionRow()] });
            } else if (i.customId === 'page_next') {
                page = Math.min(totalPages - 1, page + 1);
                await i.update({ embeds: [generateEmbed()], components: [getActionRow()] });
            } else if (i.customId === 'admin_item_add') {
                // Launch the modal for adding an item (unchanged, still correct)
                const modal = new ModalBuilder()
                    .setCustomId('admin_add_item_modal')
                    .setTitle('Add New Item')
                    .addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('name')
                                .setLabel('Item Name')
                                .setStyle(TextInputStyle.Short)
                                .setRequired(true)
                        ),
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('type')
                                .setLabel('Item Type')
                                .setStyle(TextInputStyle.Short)
                                .setRequired(true)
                        ),
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('cost')
                                .setLabel('Cost (Coins)')
                                .setStyle(TextInputStyle.Short)
                                .setRequired(true)
                        ),
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('effect')
                                .setLabel('Effect (optional)')
                                .setStyle(TextInputStyle.Short)
                                .setRequired(false)
                        ),
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('seasonal')
                                .setLabel('Seasonal? (yes or no)')
                                .setStyle(TextInputStyle.Short)
                                .setRequired(true)
                                .setValue('no') 
                        )
                    );
                await i.showModal(modal);
                collector.stop(); // Stop collector after launching modal
            } else if (i.customId === 'admin_item_edit') {
                // IMPROVEMENT: Guide admin to the correct command and stop the current collector
                await i.update({ 
                    content: '➡️ Use the dedicated slash command **`/aitemedit`** to select and modify an existing item.',
                    components: [new ActionRowBuilder().addComponents(getActionRow().components.slice(-2))] // Keep only pagination buttons
                });
                collector.stop();
            } else if (i.customId === 'admin_item_remove') {
                // IMPROVEMENT: Guide admin to the correct command and stop the current collector
                 await i.update({ 
                    content: '➡️ Use the dedicated slash command **`/aitemremove`** to select and permanently delete an item.',
                    components: [new ActionRowBuilder().addComponents(getActionRow().components.slice(-2))] // Keep only pagination buttons
                });
                collector.stop();
            }
        });
        
        collector.on('end', collected => {
            // Disable buttons if the collector times out or is stopped
            if (collected.size === 0) {
                 message.edit({ 
                    content: 'Item viewer timed out.', 
                    components: [] 
                }).catch(() => {});
            }
        });
    }
};