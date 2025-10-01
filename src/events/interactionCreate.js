import {
    Events,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} from 'discord.js';
import { getOrCreateUser } from '../utils/userUtils.js';
import { Item, UserItem, Pet } from '../models/index.js';
// Assuming these utilities are available:
// import { createPet, getPetLore } from '../utils/petManager.js';
// import { awardVoiceCoin } from '../utils/coinManager.js';
// import { getTierEmoji } from '../utils/emojiUtils.js';

/**
 * Handles toggling between the Main and Seasonal stores and displays items with buy buttons.
 * @param {import('discord.js').ButtonInteraction} interaction
 * @param {boolean} seasonal 
 */
async function handleStoreButton(interaction, seasonal) {
    const items = await Item.findAll({ where: { seasonal } });
    const isSeasonal = seasonal === true;

    const embed = new EmbedBuilder()
        .setTitle(isSeasonal ? 'Seasonal Store' : 'Main Store')
        .setColor(isSeasonal ? '#00c8ff' : '#ffd700')
        .setDescription('Browse and buy items!');

    for (const item of items) {
        embed.addFields({
            name: `${item.name} – ${item.cost} coins`,
            value: item.description || 'No description',
            inline: false
        });
    }

    const toggleRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('store_regular')
            .setLabel('Main Store')
            .setStyle(isSeasonal ? ButtonStyle.Secondary : ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('store_seasonal')
            .setLabel('Seasonal Store')
            .setStyle(isSeasonal ? ButtonStyle.Primary : ButtonStyle.Secondary)
    );

    // --- ENHANCEMENT: Add dynamic Buy Buttons ---
    const buyButtonsRow = new ActionRowBuilder();
    // Only add up to 5 buy buttons to fit Discord limits
    for (const item of items.slice(0, 5)) {
        buyButtonsRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`buy_${item.id}`)
                .setLabel(`Buy ${item.name.split(' ')[0]}`) // Use first word of name for brevity
                .setStyle(ButtonStyle.Success)
        );
    }
    
    const components = [toggleRow];
    if (buyButtonsRow.components.length > 0) {
        components.push(buyButtonsRow);
    }

    await interaction.update({ embeds: [embed], components });
}


export default {
    name: Events.InteractionCreate,
    async execute(interaction) {
        const userId = interaction.user.id;

        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);
            if (!command) return;
            try {
                await command.execute(interaction);
            } catch (err) {
                console.error(err);
                const replyPayload = { content: 'There was an error executing this command.', ephemeral: true };
                if (interaction.replied || interaction.deferred) await interaction.followUp(replyPayload);
                else await interaction.reply(replyPayload);
            }
        }

        else if (interaction.isModalSubmit()) {
            const fields = interaction.fields;

            // --- ENHANCEMENT: Transactional Item Creation ---
            if (interaction.customId === 'admin_add_item_modal') {
                await interaction.deferReply({ ephemeral: true });
                const t = await Item.sequelize.transaction();
                
                try {
                    const name = fields.getTextInputValue('name');
                    const type = fields.getTextInputValue('type');
                    const costInput = fields.getTextInputValue('cost');
                    const description = fields.getTextInputValue('description') || null;
                    const seasonal = fields.getTextInputValue('seasonal')?.toLowerCase() === 'true';

                    const cost = parseInt(costInput);
                    if (isNaN(cost) || cost < 0) {
                        await t.rollback();
                        return interaction.editReply({ content: '❌ Cost must be a non-negative number.' });
                    }

                    // Check for item name uniqueness before creation
                    const existingItem = await Item.findOne({ where: { name }, transaction: t });
                    if (existingItem) {
                        await t.rollback();
                        return interaction.editReply({ content: `❌ An item named **${name}** already exists.` });
                    }

                    await Item.create({ name, type, cost, description, seasonal }, { transaction: t });
                    await t.commit();
                    return interaction.editReply({ content: `✅ Item **${name}** created successfully! (Type: ${type}, Cost: ${cost})` });
                } catch (error) {
                    await t.rollback();
                    console.error('Error creating item:', error);
                    return interaction.editReply({ content: '❌ Failed to create item due to a database error.' });
                }
            }

            else if (interaction.customId.startsWith('admin_edit_item_modal_')) {
                const itemId = interaction.customId.split('_').pop();
                const item = await Item.findByPk(itemId);
                if (!item) {
                    return interaction.reply({ content: '❌ Item not found.', ephemeral: true });
                }

                // Simplified, non-transactional edit is okay since it's admin tool and not tied to user currency
                const name = fields.getTextInputValue('new_name');
                const type = fields.getTextInputValue('new_type');
                const cost = fields.getTextInputValue('new_cost');
                const effect = fields.getTextInputValue('new_effect');

                if (name) item.name = name;
                if (type) item.type = type;
                // Only update cost if it's a valid number string
                if (cost !== null && cost !== undefined && cost.trim() !== '' && !isNaN(parseInt(cost))) {
                    item.cost = parseInt(cost);
                }
                if (effect) item.effect = effect;
                
                // Assuming `description` is available in the modal, otherwise it's just `effect`
                const description = fields.getTextInputValue('new_description');
                if (description) item.description = description;


                await item.save();

                return interaction.reply({ content: `✅ Item **${item.name}** updated.`, ephemeral: true });
            }
        }

        else if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'admin_remove_item_select') {
                const selectedId = interaction.values[0];
                const item = await Item.findByPk(selectedId);
                if (!item) {
                    return interaction.update({ content: '❌ Item not found.', components: [] });
                }
                await item.destroy();
                return interaction.update({ content: `🗑️ Item **${item.name}** removed.`, components: [] });
            }

            if (interaction.customId === 'admin_edit_item_select') {
                const selectedId = interaction.values[0];
                const item = await Item.findByPk(selectedId);
                if (!item) {
                    return interaction.update({ content: '❌ Item not found.', components: [] });
                }

                // Rebuilding modal for editing
                const modal = new ModalBuilder()
                    .setCustomId(`admin_edit_item_modal_${item.id}`)
                    .setTitle(`Edit ${item.name}`)
                    .addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder().setCustomId('new_name').setLabel('New Name').setStyle(TextInputStyle.Short).setValue(item.name || '').setRequired(false)
                        ),
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder().setCustomId('new_type').setLabel('New Type').setStyle(TextInputStyle.Short).setValue(item.type || '').setRequired(false)
                        ),
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder().setCustomId('new_cost').setLabel('New Cost').setStyle(TextInputStyle.Short).setValue(item.cost?.toString() || '').setRequired(false)
                        ),
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder().setCustomId('new_effect').setLabel('New Effect (Role ID)').setStyle(TextInputStyle.Short).setValue(item.effect || '').setRequired(false)
                        ),
                        new ActionRowBuilder().addComponents(
                             new TextInputBuilder().setCustomId('new_description').setLabel('New Description').setStyle(TextInputStyle.Paragraph).setValue(item.description || '').setRequired(false)
                        )
                    );

                return interaction.showModal(modal);
            }
        }

        else if (interaction.isButton()) {
            const { customId } = interaction;

            if (customId === 'store_regular') return handleStoreButton(interaction, false);
            if (customId === 'store_seasonal') return handleStoreButton(interaction, true);

            if (customId === 'admin_item_add') {
                // Rebuilding modal to include description and fix missing `effect` field from previous file state
                const modal = new ModalBuilder()
                    .setCustomId('admin_add_item_modal')
                    .setTitle('Add New Item')
                    .addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder().setCustomId('name').setLabel('Item Name').setStyle(TextInputStyle.Short).setRequired(true)
                        ),
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder().setCustomId('type').setLabel('Item Type').setStyle(TextInputStyle.Short).setRequired(true)
                        ),
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder().setCustomId('cost').setLabel('Item Cost (Number)').setStyle(TextInputStyle.Short).setRequired(true)
                        ),
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder().setCustomId('description').setLabel('Description (optional)').setStyle(TextInputStyle.Paragraph).setRequired(false)
                        ),
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder().setCustomId('seasonal').setLabel('Seasonal? (true/false)').setStyle(TextInputStyle.Short).setRequired(true)
                        )
                    );
                return interaction.showModal(modal);
            }

            // --- ENHANCEMENT: Transactional Purchase Logic ---
            if (customId.startsWith('buy_')) {
                await interaction.deferReply({ ephemeral: true });
                const itemId = customId.split('buy_')[1];
                const item = await Item.findByPk(itemId);
                
                if (!item) {
                    return interaction.editReply({ content: '❌ Item not found.' });
                }

                const user = await getOrCreateUser(interaction.user.id);

                if (user.coins < item.cost) {
                    return interaction.editReply({
                        content: `❌ You need ${item.cost} coins to buy **${item.name}**.`
                    });
                }
                
                const t = await Item.sequelize.transaction();
                
                try {
                    if (item.type === 'role') {
                        const roleId = item.effect;
                        if (!roleId) {
                            await t.rollback();
                            return interaction.editReply({ content: '❌ Role ID is missing for this item. Cannot purchase.' });
                        }
                        const role = interaction.guild.roles.cache.get(roleId);
                        
                        if (!role) {
                            await t.rollback();
                            return interaction.editReply({ content: '❌ Role not found in this server.' });
                        }
                        if (interaction.member.roles.cache.has(role.id)) {
                            await t.rollback();
                            return interaction.editReply({ content: '⚠️ You already have this role.' });
                        }

                        // Deduct coins (must happen before role add in DB layer, but transaction ensures atomicity)
                        await user.decrement('coins', { by: item.cost, transaction: t }); 
                        
                        // Assign role (non-DB operation, but error must trigger rollback)
                        await interaction.member.roles.add(role); 

                        await t.commit(); // Success: coins deducted AND role added

                        return interaction.editReply({
                            content: `✅ You bought the **${role.name}** role for ${item.cost} coins!`
                        });
                    }

                    // --- Generic Item Purchase (Placeholder/Non-Role) ---
                    
                    // Deduct coins
                    await user.decrement('coins', { by: item.cost, transaction: t });

                    // Find or create UserItem (Assuming UserItem has addItem equivalent logic or methods)
                    const [userItem, created] = await UserItem.findOrCreate({
                        where: { user_id: userId, item_id: item.id },
                        defaults: { quantity: 0 },
                        transaction: t
                    });

                    // Increment quantity
                    await userItem.increment('quantity', { by: 1, transaction: t });
                    
                    await t.commit();

                    return interaction.editReply({
                        content: `🛍️ You bought **${item.name}** for ${item.cost} coins and added it to your inventory.`
                    });

                } catch (err) {
                    await t.rollback();
                    console.error('❌ Failed to complete purchase transaction:', err);
                    // Check if role failure was the cause
                    if (err.code === 50013) {
                         return interaction.editReply({ content: '❌ Failed to assign the role (Bot lacks permission). Your coins have NOT been deducted.' });
                    }
                    return interaction.editReply({
                        content: '❌ A critical error occurred during purchase. Your coins have NOT been deducted.'
                    });
                }
            }

            // --- CRITICAL REFACTOR: Remove pet_page_ pagination logic ---
            // This logic belongs entirely in the /pet command collector.
            // We only handle pet_feed_ here, but clean up the custom ID parsing.
            if (customId.startsWith('pet_feed_')) {
                const targetUserId = customId.split('_').pop();
                
                if (interaction.user.id !== targetUserId) {
                    return interaction.reply({ content: '❌ This button isn’t for you.', ephemeral: true });
                }

                await interaction.deferReply({ ephemeral: true });
                const t = await Pet.sequelize.transaction();
                
                try {
                    const activePet = await Pet.findOne({ 
                        where: { owner_id: targetUserId, is_active: true }, 
                        transaction: t 
                    });

                    if (!activePet) {
                        await t.rollback();
                        return interaction.editReply({ content: '❌ You don’t have an active pet set. Use `/pet activate`.' });
                    }

                    const foodItem = await Item.findOne({ where: { name: 'Pet Food' } });
                    if (!foodItem) {
                        await t.rollback();
                        return interaction.editReply({ content: '❌ Item definition for "Pet Food" is missing from the database.' });
                    }
                    
                    // Find UserItem for Pet Food
                    const userItems = await UserItem.findOne({
                        where: { user_id: targetUserId, item_id: foodItem.id },
                        transaction: t
                    });

                    if (!userItems || userItems.quantity < 1) {
                        await t.rollback();
                        return interaction.editReply({ content: '❌ You don’t have any 🥩 Pet Food in your inventory.' });
                    }

                    // 1. Calculate gain
                    const gain = Math.max(0.2, 2.0 - (activePet.level * 0.1));
                    
                    // 2. Decrement food quantity
                    await userItems.decrement('quantity', { by: 1, transaction: t });
                    
                    // 3. Update pet level
                    await activePet.increment('level', { by: gain, transaction: t });
                    
                    await t.commit(); // Success

                    const newLevel = activePet.level + gain; // Calculate final level for display

                    return interaction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle('🥩 You fed your pet!')
                                .setDescription(`**${activePet.name}** gained **+${gain.toFixed(1)}** levels!\nNew level: **${newLevel.toFixed(1)}**`)
                                .setColor(0x00ff99)
                        ]
                    });

                } catch (error) {
                    await t.rollback();
                    console.error('❌ Failed to feed pet transaction:', error);
                    return interaction.editReply({ content: '❌ A critical error occurred during pet feeding. No items or levels were changed.' });
                }
            }
        }
    }
};
