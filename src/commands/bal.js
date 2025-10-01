// src/commands/bal.js
import { SlashCommandBuilder } from 'discord.js';
import { getOrCreateUser } from '../utils/userUtils.js';

export default {
  data: new SlashCommandBuilder()
    .setName('bal')
    .setDescription('View your coin balance'),
  /**
   * Shows the user’s coin balance.
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const user = await getOrCreateUser(interaction.user.id);
    
    // ⬅️ Use the existing currency info
    await interaction.reply({ 
        content: `You have **${user.coins}** coins.`, 
        ephemeral: true 
    });
  }
};