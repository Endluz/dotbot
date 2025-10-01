// src/commands/forge.js (FINAL)

import { SlashCommandBuilder } from 'discord.js';
import { ActiveForge, User } from '../models/index.js'; 
import { FORGEABLE_ITEMS } from '../utils/forgeItems.js'; 
import { calculateWaitTime } from '../utils/skillUtils.js'; 

export default {
    data: new SlashCommandBuilder()
        .setName('forge')
        .setDescription('Start forging an item to sell later')
        .addStringOption(option =>
            option.setName('item')
                .setDescription('The item you want to forge')
                .setRequired(true)
                .addChoices(
                    ...FORGEABLE_ITEMS.map(item => ({ name: item.name, value: item.name }))
                )
        )
        .addIntegerOption(option =>
            option.setName('duration')
                .setDescription('Forging duration in minutes (min 1, max 1440)')
                .setRequired(true)
        ),

    async execute(interaction) {
        const userId = interaction.user.id;
        const itemName = interaction.options.getString('item');
        let duration = interaction.options.getInteger('duration');

        if (duration < 1 || duration > 1440) {
            return interaction.reply({ content: '❌ Duration must be between 1 and 1440 minutes (24 hours).', ephemeral: true });
        }
        
        const forgeItem = FORGEABLE_ITEMS.find(i => i.name === itemName);
        if (!forgeItem) {
            return interaction.reply({ content: '❌ Invalid item selected.', ephemeral: true });
        }

        const existingJob = await ActiveForge.findOne({ where: { user_id: userId, is_complete: false } });
        if (existingJob) {
             return interaction.reply({ 
                content: `⏳ You are already forging a **${existingJob.item_name}**. Use \`/collect\` to finish it!`, 
                ephemeral: true 
            });
        }

        // Fetch user's level and calculate time reduction
        const user = await User.findByPk(userId); 
        
        const { actualWaitMinutes, reductionPercent } = calculateWaitTime(duration, user.forge_level);
        
        // Create the new forging job (store the full committed duration)
        await ActiveForge.create({
            user_id: userId,
            item_name: itemName,
            start_time: new Date(),
            duration_minutes: duration 
        });

        const finishTime = new Date(Date.now() + actualWaitMinutes * 60 * 1000); 
        
        await interaction.reply({
            content: `🔨 You started forging a **${itemName}** for **${duration} minutes**. 
            Thanks to your **Forge Level ${user.forge_level}** (a ${reductionPercent}% reduction), 
            you only have to wait **${Math.ceil(actualWaitMinutes)} minutes**! 
            Ready to collect at ${finishTime.toLocaleTimeString()}.`,
            ephemeral: true
        });
    }
};