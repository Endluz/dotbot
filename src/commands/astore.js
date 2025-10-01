import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { Item } from '../models/index.js';
import fs from 'fs';
import path from 'path';
import config from '../config.js';


export default {
    data: new SlashCommandBuilder()
        .setName('astore')
        .setDescription('Admin: manage the store')
        .addSubcommand((sub) =>
            sub
                .setName('add')
                .setDescription('Add an item to the store')
                .addStringOption((opt) => opt.setName('name').setDescription('Item name').setRequired(true))
                .addIntegerOption((opt) => opt.setName('cost').setDescription('Cost in coins').setRequired(true))
                .addStringOption((opt) => opt.setName('type').setDescription('Item type').setRequired(true))
                .addStringOption((opt) => opt.setName('description').setDescription('Description').setRequired(false))
        )
        .addSubcommand((sub) =>
            sub
                .setName('remove')
                .setDescription('Remove an item from the store')
                .addStringOption((opt) => opt.setName('name').setDescription('Item name').setRequired(true))
        )
        .addSubcommand((sub) =>
            sub
                .setName('role')
                .setDescription('Add a Discord role to the store as a color role')
                .addRoleOption((opt) => opt.setName('role').setDescription('Role to add').setRequired(true))
        )
        .addSubcommand((sub) =>
            sub
                .setName('removerole')
                .setDescription('Remove a Discord role from the store')
                .addRoleOption((opt) => opt.setName('role').setDescription('Role to remove').setRequired(true))
        )
        .addSubcommand((sub) =>
            sub
                .setName('addpet')
                .setDescription('Add a pet item to the store')
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
                .addIntegerOption((opt) =>
                    opt
                        .setName('cost')
                        .setDescription('Cost of the pet in coins (optional, defaults based on tier)')
                        .setRequired(false)
                )
        ),
    /**
     * Admin command to manage the store. Requires the user to have an admin role defined in config.
     * @param {import('discord.js').ChatInputCommandInteraction} interaction
     */
    async execute(interaction) {
        // Check permission: either has admin role id defined or ManageGuild perm
        const member = interaction.member;
        const isAdminRole = member.roles.cache.some((r) => config.adminRoleIds.includes(r.id));
        if (!isAdminRole && !member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return interaction.reply({ content: 'You do not have permission to run this command.', ephemeral: true });
        }
        
        const sub = interaction.options.getSubcommand();

        if (sub === 'add') {
            const name = interaction.options.getString('name');
            const cost = interaction.options.getInteger('cost');
            const type = interaction.options.getString('type');
            const description = interaction.options.getString('description') || '';

            // Check if an item with that name already exists
            const existingItem = await Item.findOne({ where: { name } });
            if (existingItem) {
                return interaction.reply({ content: `An item with the name **${name}** already exists. Use the dedicated edit commands to modify it.`, ephemeral: true });
            }

            // ⚠️ FIX: Simplified creation logic to remove redundant `save()` and `defaults` complexity
            await Item.create({ 
                name, 
                cost, 
                type, 
                description,
                seasonal: false, // Explicitly set store items as non-seasonal
                role_id: null,
                effect: null 
            });

            return interaction.reply({ content: `Added item **${name}** to the store.`, ephemeral: true });
        }

        if (sub === 'remove') {
            const name = interaction.options.getString('name');
            const item = await Item.findOne({ where: { name } });
            if (!item) {
                return interaction.reply({ content: 'Item not found.', ephemeral: true });
            }
            await item.destroy();
            return interaction.reply({ content: `Removed **${name}** from the store.`, ephemeral: true });
        }

        if (sub === 'role') {
            // Add a discord role as a color role item in the store
            const role = interaction.options.getRole('role');
            if (!role) {
                return interaction.reply({ content: 'You must mention a role.', ephemeral: true });
            }
            // Default cost for color roles
            const cost = 10000;
            // Check if an entry already exists for this role
            const existing = await Item.findOne({ where: { role_id: role.id, seasonal: false } });
            if (existing) {
                return interaction.reply({ content: 'This role is already in the store.', ephemeral: true });
            }
            const itemName = `Role Color: ${role.name}`;
            await Item.create({ name: itemName, description: `Color role ${role.name}`, cost, type: 'roleColor', role_id: role.id, seasonal: false });
            return interaction.reply({ content: `Added role **${role.name}** to the store.`, ephemeral: true });
        }

        if (sub === 'removerole') {
            const role = interaction.options.getRole('role');
            if (!role) {
                return interaction.reply({ content: 'You must mention a role.', ephemeral: true });
            }
            // Find the non-seasonal item associated with this role
            const item = await Item.findOne({ where: { role_id: role.id, seasonal: false } });
            if (!item) {
                return interaction.reply({ content: 'This role is not in the store.', ephemeral: true });
            }
            await item.destroy();
            return interaction.reply({ content: `Removed role **${role.name}** from the store.`, ephemeral: true });
        }

        if (sub === 'addpet') {
            // Admin is adding a pet item to the store
            const tier = interaction.options.getString('tier');
            let cost = interaction.options.getInteger('cost');

            // Default costs by tier if not provided
            if (cost === null || cost === undefined) {
                if (tier === 'rare') cost = 50000;
                else if (tier === 'legendary') cost = 100000;
                else cost = 15000;
            }

            // Determine the item type based on tier
            let type;
            if (tier === 'rare') type = 'petRare';
            else if (tier === 'legendary') type = 'petLegendary';
            else type = 'petCommon';

            // Name the item clearly based on tier
            const capitalTier = tier.charAt(0).toUpperCase() + tier.slice(1);
            const itemName = `${capitalTier} Pet`;

            // Check if an item with this name already exists
            const existing = await Item.findOne({ where: { name: itemName, seasonal: false } });
            if (existing) {
                return interaction.reply({ content: `An item named **${itemName}** already exists in the store.`, ephemeral: true });
            }

            await Item.create({
                name: itemName,
                description: `A randomly chosen ${tier} pet`,
                cost,
                type,
                seasonal: false
            });
            return interaction.reply({ content: `Added **${itemName}** to the store.`, ephemeral: true });
        }
    }
};