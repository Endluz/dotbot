import { SlashCommandBuilder } from 'discord.js';
import { getOrCreateUser } from '../utils/userUtils.js';
import { Item, UserItem } from '../models/index.js';

export default {
    data: new SlashCommandBuilder()
        .setName('gift')
        .setDescription('Gift an item to another user')
        .addUserOption((option) =>
            option
                .setName('recipient')
                .setDescription('User to receive the gift')
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName('item')
                .setDescription('Name of the item to gift')
                .setRequired(true)
        ),
    /**
     * Transfers an item from the invoker to another user.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction
     */
    async execute(interaction) {
        const senderId = interaction.user.id;
        const recipient = interaction.options.getUser('recipient');
        const itemName = interaction.options.getString('item');

        // Initial Checks
        if (recipient.bot) {
            return interaction.reply({ content: 'You cannot gift items to bots.', ephemeral: true });
        }
        if (senderId === recipient.id) {
            return interaction.reply({ content: 'You cannot gift an item to yourself.', ephemeral: true });
        }

        const item = await Item.findOne({ where: { name: itemName } });
        if (!item) {
            return interaction.reply({ content: `Item **${itemName}** does not exist.`, ephemeral: true });
        }

        // Start Transaction for Atomicity
        // (Assumes Item model has access to the Sequelize instance via Item.sequelize)
        const t = await Item.sequelize.transaction();

        try {
            // 1. Check sender's inventory within the transaction
            const senderItem = await UserItem.findOne({ 
                where: { user_id: senderId, item_id: item.id },
                transaction: t
            });

            if (!senderItem || senderItem.quantity < 1) {
                await t.rollback();
                return interaction.reply({ content: `You do not own the item **${item.name}** to gift.`, ephemeral: true });
            }

            // 2. Decrement sender's quantity
            senderItem.quantity -= 1;
            await senderItem.save({ transaction: t });

            // 3. Ensure recipient user exists in the Users table (safeguard for foreign key)
            await getOrCreateUser(recipient.id);

            // 4. Find or create recipient item record
            const [recipientItem] = await UserItem.findOrCreate({ 
                where: { user_id: recipient.id, item_id: item.id }, 
                defaults: { user_id: recipient.id, item_id: item.id, quantity: 0 },
                transaction: t 
            });

            // 5. Increment recipient's quantity
            recipientItem.quantity += 1;
            await recipientItem.save({ transaction: t });

            // 6. Commit the transaction: both operations succeeded
            await t.commit();

            // 7. Send public confirmation (better user experience for gifts)
            await interaction.reply({ 
                content: `🎁 ${interaction.user} gifted **1x ${item.name}** to ${recipient}!`, 
                allowedMentions: { repliedUser: false } // Avoid mentioning the sender in the response text
            });

        } catch (error) {
            // If any error occurred, rollback all changes
            await t.rollback();
            console.error('Error during item gift transaction:', error);

            // Reply ephemerally with the failure
            await interaction.reply({ 
                content: '❌ An error occurred while transferring the item. The item has not been moved.', 
                ephemeral: true 
            });
        }
    }
};