import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { Item } from '../models/index.js';
import fs from 'fs';
import path from 'path';
import config from '../config.js';

/*
 * Admin seasonal store management command.
 * Allows adding and removing roles and pets to/from the seasonal store.
 * Only users with admin roles or the Manage Guild permission can run these commands.
 */
export default {
  data: new SlashCommandBuilder()
    .setName('aseasonal')
    .setDescription('Admin: manage the seasonal store')
    .addSubcommand((sub) =>
      sub
        .setName('role')
        .setDescription('Add a Discord role to the seasonal store')
        .addRoleOption((opt) => opt.setName('role').setDescription('Role to add').setRequired(true))
        .addIntegerOption((opt) =>
          opt
            .setName('cost')
            .setDescription('Cost of the role in coins (optional, defaults to 10000)')
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('removerole')
        .setDescription('Remove a Discord role from the seasonal store')
        .addRoleOption((opt) => opt.setName('role').setDescription('Role to remove').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('addpet')
        .setDescription('Add a pet item to the seasonal store')
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
    )
    .addSubcommand((sub) =>
      sub
        .setName('removepet')
        .setDescription('Remove a pet item from the seasonal store')
        .addStringOption((opt) =>
          opt
            .setName('tier')
            .setDescription('Tier of the pet to remove')
            .setRequired(true)
            .addChoices(
              { name: 'Common', value: 'common' },
              { name: 'Rare', value: 'rare' },
              { name: 'Legendary', value: 'legendary' }
            )
        )
    ),
  /**
   * Executes the seasonal store management command.
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const member = interaction.member;
    // Permission Check: Admin Role IDs in config OR ManageGuild permission
    const isAdminRole = member.roles.cache.some((r) => config.adminRoleIds.includes(r.id));
    if (!isAdminRole && !member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: 'You do not have permission to run this command.', ephemeral: true });
    }
    
    const sub = interaction.options.getSubcommand();

    // ------------------------------------------------------------------
    // ADD SEASONAL ROLE
    // ------------------------------------------------------------------
    if (sub === 'role') {
      const role = interaction.options.getRole('role');
      let cost = interaction.options.getInteger('cost');
      if (!cost) cost = 10000;
      if (!role) {
        return interaction.reply({ content: 'You must mention a role.', ephemeral: true });
      }

      // Check for existing seasonal role item with this role_id
      const existing = await Item.findOne({ where: { role_id: role.id, seasonal: true } });
      if (existing) {
        return interaction.reply({ content: 'This role is already in the seasonal store.', ephemeral: true });
      }

      const itemName = `Seasonal Role: ${role.name}`;
      await Item.create({
        name: itemName,
        description: `Seasonal role ${role.name}`,
        cost,
        type: 'roleSeasonal',
        role_id: role.id,
        seasonal: true
      });
      return interaction.reply({ content: `Added role **${role.name}** to the seasonal store.`, ephemeral: true });
    }

    // ------------------------------------------------------------------
    // REMOVE SEASONAL ROLE
    // ------------------------------------------------------------------
    if (sub === 'removerole') {
      const role = interaction.options.getRole('role');
      if (!role) {
        return interaction.reply({ content: 'You must mention a role.', ephemeral: true });
      }

      // Find the seasonal item associated with this role
      const item = await Item.findOne({ where: { role_id: role.id, seasonal: true } });
      if (!item) {
        return interaction.reply({ content: 'This role is not in the seasonal store.', ephemeral: true });
      }
      
      await item.destroy();
      return interaction.reply({ content: `Removed role **${role.name}** from the seasonal store.`, ephemeral: true });
    }

    // ------------------------------------------------------------------
    // ADD SEASONAL PET
    // ------------------------------------------------------------------
    if (sub === 'addpet') {
      const tier = interaction.options.getString('tier');
      let cost = interaction.options.getInteger('cost');

      // Default costs by tier if not provided (seasonal pet costs are slightly higher than permanent pets)
      if (cost === null || cost === undefined) {
        if (tier === 'rare') cost = 50000;
        else if (tier === 'legendary') cost = 100000;
        else cost = 20000; // Seasonal Common: 20000
      }

      let type;
      if (tier === 'rare') type = 'petSeasonalRare';
      else if (tier === 'legendary') type = 'petSeasonalLegendary';
      else type = 'petSeasonalCommon';

      const capitalTier = tier.charAt(0).toUpperCase() + tier.slice(1);
      const itemName = `Seasonal ${capitalTier} Pet`;

      // Check if a seasonal pet item of this type already exists by name
      const existing = await Item.findOne({ where: { name: itemName, seasonal: true } });
      if (existing) {
        return interaction.reply({ content: `An item named **${itemName}** already exists in the seasonal store.`, ephemeral: true });
      }

      await Item.create({
        name: itemName,
        description: `A randomly chosen seasonal ${tier} pet`,
        cost,
        type,
        seasonal: true
      });
      return interaction.reply({ content: `Added **${itemName}** to the seasonal store.`, ephemeral: true });
    }

    // ------------------------------------------------------------------
    // REMOVE SEASONAL PET (Bulk Remove by Tier)
    // ------------------------------------------------------------------
    if (sub === 'removepet') {
      const tier = interaction.options.getString('tier');
      
      let type;
      if (tier === 'rare') type = 'petSeasonalRare';
      else if (tier === 'legendary') type = 'petSeasonalLegendary';
      else type = 'petSeasonalCommon';
      
      // Find all seasonal pet items of that specific type/tier
      const items = await Item.findAll({ where: { type, seasonal: true } });

      if (!items || items.length === 0) {
        return interaction.reply({ content: `No seasonal ${tier} pet items found in the store.`, ephemeral: true });
      }

      // Remove them all (bulk deletion)
      for (const itm of items) {
        await itm.destroy();
      }

      return interaction.reply({ content: `Removed all seasonal ${tier} pet items from the store.`, ephemeral: true });
    }
  }
};