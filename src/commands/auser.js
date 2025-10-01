import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import fs from 'fs'; // Not used in this code, but kept for consistency
import path from 'path'; // Not used in this code, but kept for consistency
import { getOrCreateUser } from '../utils/userUtils.js';
// We assume addItem/removeItem helpers are static methods on UserItem model
import { Item, UserItem, Pet } from '../models/index.js'; 
import { createPet } from '../utils/petManager.js'; // ⬅️ NEW: Import createPet at the top
import config from '../config.js';

/*
 * Admin user management command. Allows viewing and editing another user's
 * currency balances and inventory.
 */
export default {
    data: new SlashCommandBuilder()
        .setName('auser')
        .setDescription('Admin: view or edit another user\'s data')
        .addSubcommand((sub) =>
            sub
                .setName('view')
                .setDescription('View a user\'s bank, inventory, and pets')
                .addUserOption((opt) =>
                    opt.setName('user').setDescription('User to view').setRequired(true)
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName('setcoins')
                .setDescription('Set a user\'s coin balance to a specific amount')
                .addUserOption((opt) => opt.setName('user').setDescription('User to edit').setRequired(true))
                .addIntegerOption((opt) =>
                    opt
                        .setName('amount')
                        .setDescription('New coin amount')
                        .setRequired(true)
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName('additem')
                .setDescription('Add an item to a user\'s inventory')
                .addUserOption((opt) => opt.setName('user').setDescription('User to edit').setRequired(true))
                .addStringOption((opt) =>
                    opt.setName('item').setDescription('Name of the item').setRequired(true)
                )
                .addIntegerOption((opt) =>
                    opt
                        .setName('quantity')
                        .setDescription('Quantity to add (default: 1)')
                        .setRequired(false)
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName('removeitem')
                .setDescription('Remove an item from a user\'s inventory')
                .addUserOption((opt) => opt.setName('user').setDescription('User to edit').setRequired(true))
                .addStringOption((opt) =>
                    opt.setName('item').setDescription('Name of the item').setRequired(true)
                )
                .addIntegerOption((opt) =>
                    opt
                        .setName('quantity')
                        .setDescription('Quantity to remove (default: 1)')
                        .setRequired(false)
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName('addpet')
                .setDescription('Give a pet to another user')
                .addUserOption((opt) => opt.setName('user').setDescription('User to give the pet to').setRequired(true))
                .addStringOption((opt) =>
                    opt
                        .setName('tier')
                        .setDescription('Tier of the pet')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Common', value: 'common' },
                            { name: 'Rare', value: 'rare' },
                            { name: 'Legendary', value: 'legendary' }
                        )
                )
                .addStringOption((opt) =>
                    opt.setName('species').setDescription('Specific species (optional)').setRequired(false)
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName('removepet')
                .setDescription('Remove a pet from another user')
                .addUserOption((opt) => opt.setName('user').setDescription('User to remove the pet from').setRequired(true))
                .addStringOption((opt) =>
                    opt.setName('name').setDescription('Name of the pet to remove').setRequired(true)
                )
        ),
    async execute(interaction) {
        // Check permissions
        const member = interaction.member;
        const isAdminRole = member.roles.cache.some((r) => config.adminRoleIds.includes(r.id));
        if (!isAdminRole && !member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return interaction.reply({ content: 'You do not have permission to run this command.', ephemeral: true });
        }
        
        const sub = interaction.options.getSubcommand();
        const targetUser = interaction.options.getUser('user');

        if (!targetUser) {
            return interaction.reply({ content: 'No target user provided.', ephemeral: true });
        }

        // Prevent actions on bots
        if (targetUser.bot) {
            return interaction.reply({ content: 'You cannot modify a bot user.', ephemeral: true });
        }

        // Fetch or create the user record
        const userRecord = await getOrCreateUser(targetUser.id);

        // --- VIEW Subcommand ---
        if (sub === 'view') {
            // Fetch currency and skill levels (UPDATED)
            const bankInfo = 
                `Coins: **${userRecord.coins}**\n` +
                `Pixie Pouches: **${userRecord.pixie_pouches}**\n` +
                `Stardust: **${userRecord.stardust}**\n\n` +
                `Forge Level: **${userRecord.forge_level}**\n` +
                `Enchant Level: **${userRecord.enchant_level}**`;

            // Fetch items
            const userItems = await UserItem.findAll({ where: { user_id: targetUser.id }, include: Item });
            const itemsList = userItems.map((ui) => `• ${ui.Item.name} × ${ui.quantity}`).join('\n') || 'None';

            // Fetch pets
            const pets = await Pet.findAll({ where: { owner_id: targetUser.id } });
            const petsList = pets
                .map((p) => {
                    const activeMarker = p.is_active ? '🔹' : '◻️';
                    return `${activeMarker} **${p.name}** (${p.species}, ${p.tier}) – Lv. ${p.level.toFixed(1)}`;
                })
                .join('\n') || 'None';

            const embed = {
                title: `User Data: ${targetUser.tag}`,
                fields: [
                    { name: 'Bank & Skills', value: bankInfo }, // UPDATED NAME
                    { name: 'Inventory', value: itemsList },
                    { name: 'Pets', value: petsList }
                ],
                color: 0x3498db
            };
            return interaction.reply({ embeds: [embed], allowedMentions: { users: [] }, ephemeral: true });
        }

        // --- SETCOINS Subcommand ---
        if (sub === 'setcoins') {
            const amount = interaction.options.getInteger('amount');
            if (amount < 0) {
                return interaction.reply({ content: 'Amount must be non-negative.', ephemeral: true });
            }
            userRecord.coins = amount;
            await userRecord.save();
            return interaction.reply({ content: `Set ${targetUser.username}'s coin balance to **${amount}**.`, allowedMentions: { users: [] }, ephemeral: true });
        }

        // --- ADDITEM / REMOVEITEM Subcommands ---
        if (sub === 'additem' || sub === 'removeitem') {
            const itemName = interaction.options.getString('item');
            const quantity = interaction.options.getInteger('quantity') ?? 1;

            if (quantity <= 0) {
                return interaction.reply({ content: 'Quantity must be at least 1.', ephemeral: true });
            }

            const item = await Item.findOne({ where: { name: itemName } });
            if (!item) {
                return interaction.reply({ content: `Item **${itemName}** does not exist in the database.`, ephemeral: true });
            }
            
            // CRITICAL FIX: Use the UserItem helper functions
            if (sub === 'additem') {
                // Assuming UserItem has a static method addItem
                await UserItem.addItem(targetUser.id, item.id, quantity);
                return interaction.reply({ content: `Added **${quantity}× ${itemName}** to ${targetUser.username}'s inventory.`, allowedMentions: { users: [] }, ephemeral: true });
            } else {
                // Assuming UserItem has a static method removeItem
                await UserItem.removeItem(targetUser.id, item.id, quantity);
                return interaction.reply({ content: `Removed **${quantity}× ${itemName}** from ${targetUser.username}'s inventory.`, allowedMentions: { users: [] }, ephemeral: true });
            }
        }

        // --- ADDPET Subcommand ---
        if (sub === 'addpet') {
            const tier = interaction.options.getString('tier');
            const species = interaction.options.getString('species');

            if (species) {
                // Directly create a pet with the given species and tier
                await Pet.create({
                    owner_id: targetUser.id,
                    species,
                    tier,
                    name: species, // Using species as default name
                    level: 1,
                    acquired_at: new Date(),
                    is_active: false
                });
                return interaction.reply({ content: `Gave ${targetUser.username} a **${tier}** pet named **${species}**.`, allowedMentions: { users: [] }, ephemeral: true });
            } else {
                // Use petManager to create a random pet of the specified tier
                // No need for dynamic import since createPet is now imported at the top
                await createPet(targetUser.id, tier); 
                return interaction.reply({ content: `Gave ${targetUser.username} a random **${tier}** pet.`, allowedMentions: { users: [] }, ephemeral: true });
            }
        }

        // --- REMOVEPET Subcommand ---
        if (sub === 'removepet') {
            const name = interaction.options.getString('name');
            const pet = await Pet.findOne({ where: { owner_id: targetUser.id, name } });
            if (!pet) {
                return interaction.reply({ content: `No pet named **${name}** found for ${targetUser.username}.`, allowedMentions: { users: [] }, ephemeral: true });
            }
            await pet.destroy();
            return interaction.reply({ content: `Removed pet **${name}** from ${targetUser.username}.`, allowedMentions: { users: [] }, ephemeral: true });
        }
    }
};