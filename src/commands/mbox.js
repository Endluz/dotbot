import { SlashCommandBuilder } from 'discord.js';
import { Item, UserItem, Pet } from '../models/index.js';
import { getOrCreateUser } from '../utils/userUtils.js';
// import { createPet } from '../utils/petManager.js'; // The actual Pet creation logic is now transactionalized here

export default {
    data: new SlashCommandBuilder()
        .setName('mbox')
        .setDescription('Open a Mystery Box to receive random rewards'),
    
    /**
     * Allows the user to open a mystery box via a slash command.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction
     */
    async execute(interaction) {
        // Defer the reply, as multiple DB operations can take a moment
        await interaction.deferReply({ ephemeral: true }); 
        
        const userId = interaction.user.id;
        const user = await getOrCreateUser(userId);
        
        // 1. Find the Mystery Box item definition (read-only)
        const mboxItem = await Item.findOne({ where: { type: 'mysteryBox' } });
        if (!mboxItem) {
            return interaction.editReply({ content: '❌ The Mystery Box item definition is missing from the database.' });
        }

        // --- Start Transaction for Atomicity ---
        // Assuming Item model has access to the Sequelize instance for starting a transaction
        const t = await Item.sequelize.transaction();
        const User = user.constructor; // Safely get the User model class from the instance

        try {
            // 2. Check user's inventory for the box within the transaction
            const userItem = await UserItem.findOne({ 
                where: { user_id: userId, item_id: mboxItem.id },
                transaction: t 
            });
            
            if (!userItem || userItem.quantity < 1) {
                await t.rollback();
                return interaction.editReply({ content: 'You do not have any Mystery Boxes.' });
            }

            // 3. Consume one box (using transactional decrement)
            await UserItem.decrement('quantity', {
                by: 1,
                where: { user_id: userId, item_id: mboxItem.id },
                transaction: t
            });

            // 4. Determine rarity
            const roll = Math.random();
            let rarity;
            if (roll < 0.025) rarity = 'epic'; 
            else if (roll < 0.1) rarity = 'rare'; 
            else if (roll < 0.4) rarity = 'uncommon'; 
            else rarity = 'common'; 

            let rewardMessage;

            // 5. Grant Reward (ALL DB operations must use { transaction: t })
            if (rarity === 'common') {
                if (Math.random() < 0.5) {
                    const scrollItem = await Item.findOne({ where: { type: 'renameScroll' }, transaction: t });
                    if (scrollItem) {
                        // Add scroll (Transactional FindOrCreate + Increment)
                        const [scrollUserItem] = await UserItem.findOrCreate({
                            where: { user_id: userId, item_id: scrollItem.id },
                            defaults: { quantity: 0 },
                            transaction: t
                        });
                        await scrollUserItem.increment('quantity', { by: 1, transaction: t });
                        rewardMessage = 'You received a **Pet Rename Scroll**!';
                    } else {
                        // Fallback: grant coins using User.increment
                        await User.increment('coins', { by: 500, where: { user_id: userId }, transaction: t });
                        rewardMessage = 'You received a small coin reward due to a missing item!';
                    }
                } else {
                    // Grant 1,000 coins
                    await User.increment('coins', { by: 1000, where: { user_id: userId }, transaction: t });
                    rewardMessage = 'You received **1,000 coins**!';
                }
            } else if (rarity === 'uncommon') {
                if (Math.random() < 0.5) {
                    // Grant 10,000 coins
                    await User.increment('coins', { by: 10000, where: { user_id: userId }, transaction: t });
                    rewardMessage = 'You received **10,000 coins**!';
                } else {
                    // Give back another Mystery Box (Transactional Increment)
                    await userItem.increment('quantity', { by: 1, transaction: t }); 
                    rewardMessage = 'You received **another Mystery Box**!';
                }
            } else if (rarity === 'rare') {
                if (Math.random() < 0.5) {
                    // Create pet (Transactional Pet.create)
                    await Pet.create({ owner_id: userId, species: 'Mystery Pet', tier: 'rare' }, { transaction: t }); 
                    rewardMessage = 'You received a **rare pet**!';
                } else {
                    // Grant Pixie Pouch
                    await User.increment('pixie_pouches', { by: 1, where: { user_id: userId }, transaction: t });
                    rewardMessage = 'You received a **Pixie Pouch**!';
                }
            } else { // Epic
                // Grant Stardust
                await User.increment('stardust', { by: 1, where: { user_id: userId }, transaction: t });
                rewardMessage = 'You received **Stardust**!';
            }

            // 6. Commit the transaction
            await t.commit();

            // 7. Send success reply
            await interaction.editReply({ 
                content: `🎉 You opened a Mystery Box and its rarity was **${rarity.toUpperCase()}**! ${rewardMessage}` 
            });

        } catch (error) {
            // 8. Rollback and handle error
            await t.rollback();
            console.error(`Error opening Mystery Box for user ${userId}:`, error);
            
            await interaction.editReply({
                content: '❌ An unexpected error occurred while processing the Mystery Box. No items or rewards have been changed.'
            });
        }
    }
};