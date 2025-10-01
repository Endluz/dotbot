import { SlashCommandBuilder } from 'discord.js';
import { getOrCreateUser } from '../utils/userUtils.js';

export default {
  data: new SlashCommandBuilder()
    .setName('bank')
    .setDescription('View your currency, skill levels, and progress'),
  /**
   * Shows the user’s full currency balances and skill levels.
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const user = await getOrCreateUser(interaction.user.id);

    const content = 
        `## 💰 Currency Balances\n` +
        `Coins: **${user.coins}**\n` +
        `Pixie Pouches: **${user.pixie_pouches}**\n` +
        `Stardust: **${user.stardust}**\n\n` +
        `## ⚔️ Skill Levels\n` +
        `Forge Level: **${user.forge_level}**\n` +
        `Enchant Level: **${user.enchant_level}**`;

    await interaction.reply({ content, ephemeral: true });
  }
};