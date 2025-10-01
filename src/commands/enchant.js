// src/commands/enchant.js (UPDATED FOR FREE/SKILL-BASED ENCHANTING)

import { SlashCommandBuilder } from 'discord.js';
import { User, UserItem, Item } from '../models/index.js';
import { getOrCreateUser } from '../utils/userUtils.js';
import { ENCHANTMENTS } from '../utils/enchantItems.js'; 
import { awardXPAndCheckLevelUp } from '../utils/skillUtils.js'; 

// --- NEW FUNCTION: Determines Enchantment Quality Based on Level ---
function determineEnchantQuality(enchantLevel) {
    const quality = { level: 'Average', sell_multiplier: 1.0, level_boost: 0 };
    const random = Math.random();

    // Base Chance: Level 1 has a very low chance for anything good.
    // Chance increases linearly with level.

    // Legendary Chance: Starts low, grows slowly
    const legendaryChance = 0.005 + (enchantLevel * 0.002); // e.g., Lvl 10 has 2.5% chance
    if (random < legendaryChance) {
        quality.level = 'Legendary 🌟';
        quality.sell_multiplier = 3.0; 
        quality.level_boost = 3; // Example: 3x value boost
        return quality;
    }

    // Epic Chance: Starts slightly higher, grows moderately
    const epicChance = 0.03 + (enchantLevel * 0.005); // e.g., Lvl 10 has 8% chance
    if (random < epicChance) {
        quality.level = 'Epic ✨';
        quality.sell_multiplier = 2.0; 
        quality.level_boost = 2; // Example: 2x value boost
        return quality;
    }

    // Good Chance: More common
    const goodChance = 0.15 + (enchantLevel * 0.01); // e.g., Lvl 10 has 25% chance
    if (random < goodChance) {
        quality.level = 'Good 👍';
        quality.sell_multiplier = 1.5; 
        quality.level_boost = 1; // Example: 1.5x value boost
        return quality;
    }

    // Default: Average/Standard
    quality.level = 'Standard';
    quality.sell_multiplier = 1.2; // Even a standard enchant gives a small boost
    return quality;
}
// -------------------------------------------------------------------


export default {
    data: new SlashCommandBuilder()
        .setName('enchant')
        .setDescription('Bestow an enchantment on a non-enchanted item (Free, skill-based chance)')
        .addStringOption(option =>
            option.setName('item_name')
                .setDescription('The EXACT name of the item to enchant (e.g., Iron Sword (Average))')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('enchantment')
                .setDescription('The base enchantment to apply (e.g., Flame Aura)')
                .setRequired(true)
                .addChoices(
                    // Note: Removed cost from the display choice since it's now free
                    ...ENCHANTMENTS.map(e => ({ name: `${e.name}`, value: e.name }))
                )
        ),

    async execute(interaction) {
        const userId = interaction.user.id;
        const targetItemName = interaction.options.getString('item_name');
        const enchantName = interaction.options.getString('enchantment');

        const enchantment = ENCHANTMENTS.find(e => e.name === enchantName);
        if (!enchantment) {
            return interaction.reply({ content: '❌ Invalid enchantment selected.', ephemeral: true });
        }

        const user = await getOrCreateUser(userId);
        
        // 1. ***COIN CHECK REMOVED: Enchanting is now FREE***

        // 2. FIND AND VALIDATE ITEM
        const userItemRecord = await UserItem.findOne({
            where: { user_id: userId },
            include: Item,
        });

        if (!userItemRecord || userItemRecord.Item.name !== targetItemName || userItemRecord.quantity < 1) {
            return interaction.reply({ content: `❌ You do not have an item named **${targetItemName}** in your inventory.`, ephemeral: true });
        }
        
        // Prevent double enchanting
        if (userItemRecord.Item.name.includes(' of ')) {
            return interaction.reply({ content: `❌ **${targetItemName}** appears to be already enchanted!`, ephemeral: true });
        }

        // 3. PROCESS ENCHANTMENT AND QUALITY
        const enchantLevel = user.enchant_level;
        const qualityResult = determineEnchantQuality(enchantLevel);

        // Determine new sell value based on quality multiplier
        const originalCost = userItemRecord.Item.cost;
        const newCost = Math.round(originalCost * qualityResult.sell_multiplier);
        
        // New item name includes base enchantment and quality level
        const finalItemName = `${targetItemName} (${qualityResult.level})${enchantment.result_name_suffix}`;

        // 4. DATABASE TRANSACTIONS
        // a. Consume old item
        await UserItem.removeItem(userId, userItemRecord.item_id, 1);
        
        // b. ***COIN DEDUCTION REMOVED: No cost***

        // c. Find/Create new enchanted item definition in 'Items' table
        let [newItemDefinition] = await Item.findOrCreate({
            where: { name: finalItemName },
            defaults: {
                description: `${userItemRecord.Item.description} - Enchanted with ${qualityResult.level} power.`,
                cost: newCost,
                type: userItemRecord.Item.type,
                role_id: null,
                seasonal: false,
            }
        });

        // d. Add new item to inventory
        await UserItem.addItem(userId, newItemDefinition.id, 1);
        
        // e. Award XP and save user
        const xpGained = 50 + (enchantLevel * 10); // Increased XP to reward free action
        let levelUpMessage = awardXPAndCheckLevelUp(user, xpGained, 'enchant');
        await user.save(); 

        // 5. Confirmation
        let replyContent = `✨ You attempted to enchant **${targetItemName}** with **${enchantName}**!
        \nYour **Enchant Level ${enchantLevel}** resulted in a **${qualityResult.level}** enchantment!
        \n**New Item:** ${finalItemName} (Sell Value: **${newCost} coins**).
        \n+${xpGained} Enchant XP awarded!`;
        
        if (levelUpMessage) {
            replyContent += `\n${levelUpMessage}`;
        }

        await interaction.reply({ content: replyContent });
    }
};