import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getOrCreateUser } from '../utils/userUtils.js';
import { Item, UserItem, Pet } from '../models/index.js';

// NOTE: We assume the Item model is configured to access the Sequelize instance via Item.sequelize

// Assuming this utility is available and imported correctly
// import { createInventoryEmbed } from '../utils/embedBuilders.js'; 

export default {
    data: new SlashCommandBuilder()
        .setName('inventory')
        .setDescription('View your items and pets'),
    
    /**
     * Helper function to generate the button row
     * @param {number} mboxQuantity 
     * @returns {ActionRowBuilder[]}
     */
    getActionRows(mboxQuantity) {
        const rows = [];
        if (mboxQuantity > 0) {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('open_mbox')
                    .setLabel(`Open Mystery Box (${mboxQuantity} left)`) // Show quantity
                    .setStyle(ButtonStyle.Success)
            );
            rows.push(row);
        }
        return rows;
    },

    /**
     * Displays the user’s inventory and sets up collector for actions.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction
     */
    async execute(interaction) {
        const userId = interaction.user.id;
        
        // Function to fetch all data and generate the reply structure
        const refreshInventory = async () => {
            const user = await getOrCreateUser(userId);
            const userItems = await UserItem.findAll({ 
                where: { user_id: userId, quantity: { [Item.sequelize.Op.gt]: 0 } }, 
                include: Item 
            });
            
            const items = userItems.map((ui) => ({ name: ui.Item.name, quantity: ui.quantity, type: ui.Item.type }));
            const pets = await Pet.findAll({ where: { owner_id: userId } });
            
            // Assuming createInventoryEmbed is available
            const embed = createInventoryEmbed(user, items, pets); 
            
            const mbox = items.find((i) => i.type === 'mysteryBox');
            const mboxQuantity = mbox ? mbox.quantity : 0;
            const rows = this.getActionRows(mboxQuantity);
            
            return { user, embed, rows, mboxQuantity };
        };

        let { user, embed, rows, mboxQuantity } = await refreshInventory();

        const message = await interaction.reply({ 
            embeds: [embed], 
            components: rows, 
            ephemeral: true, 
            fetchReply: true // Important: Need the message object for the collector
        });

        if (mboxQuantity === 0) return; // Exit if no button is present

        // 1. Set up the collector to handle button presses
        const collector = message.createMessageComponentCollector({
            filter: i => i.user.id === userId && i.customId === 'open_mbox',
            time: 60 * 1000 // 60 seconds
        });

        collector.on('collect', async (i) => {
            await i.deferUpdate(); // Defer to avoid interaction time out
            collector.stop(); // Stop listening after one successful action

            const t = await Item.sequelize.transaction(); // Start transaction for safety

            try {
                // Fetch the sender's mystery box instance again
                const senderMbox = await UserItem.findOne({ 
                    where: { user_id: userId, '$Item.type$': 'mysteryBox', quantity: { [Item.sequelize.Op.gt]: 0 } },
                    include: Item, 
                    transaction: t 
                });

                if (!senderMbox) {
                    await t.rollback();
                    return interaction.editReply({ 
                        content: '❌ You no longer have a Mystery Box to open.', 
                        components: [] 
                    });
                }

                // 2. Consume the item
                senderMbox.quantity -= 1;
                await senderMbox.save({ transaction: t });

                // 3. Determine Prize (Placeholder: Award 1,000 to 5,000 coins)
                const prizeAmount = Math.floor(Math.random() * (5000 - 1000 + 1)) + 1000;
                
                // Update coins on the user object directly (assuming User model is included in Item.sequelize)
                await Item.sequelize.models.User.increment('coins', { 
                    by: prizeAmount, 
                    where: { user_id: userId }, 
                    transaction: t 
                });
                
                // 4. Commit the transaction: item is consumed and prize awarded
                await t.commit();
                
                // 5. Re-render the inventory with the updated state
                let { embed: newEmbed, rows: newRows } = await refreshInventory();
                
                await interaction.editReply({ 
                    embeds: [newEmbed], 
                    components: newRows, 
                    content: `🎉 You opened a Mystery Box and won **${prizeAmount} coins**! (Check your inventory embed for the updated total.)`
                });

            } catch (error) {
                await t.rollback();
                console.error('Error opening mystery box:', error);
                await interaction.editReply({ 
                    content: '❌ An error occurred while processing the box. Your item and coins were not affected.',
                    components: [] 
                });
            }
        });

        collector.on('end', async (collected) => {
            // If the collector times out and no action was taken, disable the button
            if (collected.size === 0) {
                 await interaction.editReply({ components: [] }).catch(() => {});
            }
        });
    }
};