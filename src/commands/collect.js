// src/commands/collect.js (FINAL)

import { SlashCommandBuilder } from 'discord.js';
import { ActiveForge, UserItem, Item, User } from '../models/index.js'; 
import { FORGEABLE_ITEMS } from '../utils/forgeItems.js';
import { calculateForgeXP, awardXPAndCheckLevelUp } from '../utils/skillUtils.js';

// --- CORE QUALITY DETERMINATION FUNCTION (Remains the same) ---
function determineQuality(forgeItem, timeElapsedMinutes, minDuration) {
    const quality = { level: 'Average', sell_multiplier: 1.0, rarity_color: 0x888888 }; 

    if (timeElapsedMinutes < minDuration) {
        quality.level = 'Shoddy (Bad 👎)';
        quality.sell_multiplier = 0.5; 
        quality.rarity_color = 0xAAAAAA;
        return quality;
    }

    const extraTimeRatio = (timeElapsedMinutes - minDuration) / minDuration;
    
    const legendaryChance = 0.005 + Math.min(extraTimeRatio, 2.0) * 0.005; 
    if (Math.random() < legendaryChance) {
        quality.level = 'Legendary 🌟';
        quality.sell_multiplier = 3.0; 
        quality.rarity_color = 0xFFD700; 
        return quality;
    }

    const epicChance = 0.02 + Math.min(extraTimeRatio, 2.0) * 0.015; 
    if (Math.random() < epicChance) {
        quality.level = 'Epic ✨';
        quality.sell_multiplier = 2.0; 
        quality.rarity_color = 0x9900FF; 
        return quality;
    }

    quality.level = 'Average (Standard)';
    quality.rarity_color = 0x00FF00;
    return quality;
}

export default {
    data: new SlashCommandBuilder()
        .setName('collect')
        .setDescription('Collect your finished forged item.'),

    async execute(interaction) {
        const userId = interaction.user.id;

        const forgeJob = await ActiveForge.findOne({ where: { user_id: userId, is_complete: false } });

        if (!forgeJob) {
            return interaction.reply({ content: '❌ You are not currently forging an item.', ephemeral: true });
        }

        const now = new Date();
        const startTime = new Date(forgeJob.start_time);
        const timeElapsedMinutes = (now.getTime() - startTime.getTime()) / (1000 * 60);
        const forgeItem = FORGEABLE_ITEMS.find(i => i.name === forgeJob.item_name);

        // Check against the full COMMITTED duration, not the reduced wait time
        if (timeElapsedMinutes < forgeJob.duration_minutes) {
            const remaining = forgeJob.duration_minutes - timeElapsedMinutes;
            return interaction.reply({ 
                content: `⏳ Your **${forgeJob.item_name}** isn't done yet! You have **${Math.ceil(remaining)} minutes** left on your full timer.`, 
                ephemeral: true 
            });
        }
        
        const qualityResult = determineQuality(forgeItem, timeElapsedMinutes, forgeItem.minimum_forge_time_minutes);
        
        // 1. Mark job as complete
        await ActiveForge.update({ is_complete: true }, { where: { id: forgeJob.id } });
        
        // 2. AWARD XP and check level up
        const xpGained = calculateForgeXP(forgeJob.duration_minutes);
        const user = await User.findByPk(userId); 
        
        let levelUpMessage = awardXPAndCheckLevelUp(user, xpGained, 'forge');
        
        await user.save(); 

        // 3. Create the final inventory item
        const finalItemName = `${forgeItem.name} (${qualityResult.level})`;

        let [itemDefinition] = await Item.findOrCreate({
            where: { name: finalItemName },
            defaults: {
                description: `A forged ${forgeItem.name}. Quality: ${qualityResult.level}`,
                cost: Math.round(forgeItem.base_sell_value * qualityResult.sell_multiplier), 
                type: forgeItem.inventory_type,
                role_id: null,
                seasonal: false,
            }
        });
        
        await UserItem.addItem(userId, itemDefinition.id, 1);
        
        let replyContent = `🎉 You collected your **${forgeItem.name}**! 
            Its final quality is **${qualityResult.level}**! 
            It is worth **${itemDefinition.cost} coins** at the shop.
            \n+${xpGained} Forge XP awarded!`;
            
        if (levelUpMessage) {
            replyContent += `\n${levelUpMessage}`;
        }
        
        await interaction.reply({ content: replyContent });
    }
};