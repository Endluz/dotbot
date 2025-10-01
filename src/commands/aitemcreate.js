import {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  PermissionFlagsBits // ⬅️ NEW: Import for robust permission checking
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('aitemcreate')
    .setDescription('Admin: Create a new item (modal form)'),

  async execute(interaction) {
    // ⬅️ USE PermissionFlagsBits CONSTANT for robust checking
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: '❌ You do not have permission to use this command.',
        ephemeral: true
      });
    }

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
            .setValue('no') // ⬅️ Enhancement: Pre-fill to guide the admin
        )
      );

    await interaction.showModal(modal);
    
    // NOTE: The submission handling logic (saving the item to the database)
    // must be implemented in your main interaction listener for modal submissions 
    // using the custom ID: 'admin_add_item_modal'.
  }
};