import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  StringSelectMenuBuilder, // ⬅️ NEW IMPORT
} from 'discord.js';
// ⬅️ ADDED 'User' model for coin handling
import { Item, UserItem, User } from '../models/index.js'; 
import { getOrCreateUser } from '../utils/userUtils.js';

const ROW_MAX = 5;
const SELL_MULTIPLIER = 0.5; // Items sell for 50% of their listed cost

// Pretty label by type (tweak as you like)
const TYPE_BADGE = {
  role: '🎨 Role',
  roleColor: '🎨 Role Color',
  petCommon: '🐾 Pet (Common)',
  petRare: '🌟 Pet (Rare)',
  petLegendary: '💎 Pet (Legendary)',
  weapon: '⚔️ Weapon', // Added for forged items
  armor: '🛡️ Armor',   // Added for forged items
};

// --- Helper Functions for Store (Buy View) ---

const loadItems = async (seasonal) => {
  return Item.findAll({ where: { seasonal }, order: [['cost', 'ASC'], ['name', 'ASC']] });
};

const buildStoreEmbed = (title, items) => {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(0xffd700)
    .setDescription('Browse and buy items!');

  for (const item of items) {
    const badge = TYPE_BADGE[item.type] ? ` • ${TYPE_BADGE[item.type]}` : '';
    embed.addFields({
      name: `${item.name} — ${item.cost} coins${badge}`,
      value: (item.description && item.description.trim()) || 'No description',
      inline: false
    });
  }
  return embed;
};

const buildItemRows = (items) => {
  const rows = [];
  let row = new ActionRowBuilder();
  let count = 0;

  for (const item of items) {
    const button = new ButtonBuilder()
      .setCustomId(`buy_${item.id}`)
      .setLabel(item.name)
      .setStyle(ButtonStyle.Primary);

    row.addComponents(button);
    count++;

    if (count === ROW_MAX) {
      rows.push(row);
      row = new ActionRowBuilder();
      count = 0;
    }
  }

  if (row.components.length > 0) rows.push(row);
  return rows;
};

// --- New Helper Functions for Sell View ---

const buildSellView = async (userId) => {
  // Get user's inventory with quantity > 0
  const userItems = await UserItem.findAll({ 
    where: { user_id: userId, quantity: { [sequelize.Op.gt]: 0 } }, 
    include: Item 
  });

  if (!userItems.length) {
    return {
      embed: new EmbedBuilder().setTitle('Sell Items 💰').setColor(0x00ff00).setDescription('Your inventory is currently empty.'),
      components: [buildReturnToBuyRow()]
    };
  }

  const embed = new EmbedBuilder()
    .setTitle('Sell Items 💰')
    .setColor(0x00ff00)
    .setDescription(`Items sell for ${SELL_MULTIPLIER * 100}% of their list price. Select an item to sell a single quantity.`);

  // Build Select Menu options (limited to 25 items for Discord)
  const options = userItems.map(ui => {
    // Items created via forge/enchant have their cost based on their sell price
    const itemCost = ui.Item.cost || 1; 
    const sellPrice = Math.floor(itemCost * SELL_MULTIPLIER); 

    // Value holds the item ID and the calculated sell price, separated by a pipe
    return {
      label: `${ui.Item.name} (x${ui.quantity})`,
      description: `Sells for ${sellPrice} coins.`,
      value: `${ui.item_id}|${sellPrice}` 
    };
  }).slice(0, 25);

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('sell_item_select')
    .setPlaceholder('Choose an item to sell...')
    .addOptions(options);

  const selectRow = new ActionRowBuilder().addComponents(selectMenu);
  
  return {
    embed,
    components: [selectRow, buildReturnToBuyRow()]
  };
};

const buildReturnToBuyRow = () => 
    new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('return_to_store')
            .setLabel('⬅️ Return to Buy Store')
            .setStyle(ButtonStyle.Secondary)
    );

// --- Toggle Row (Updated to include Sell Button) ---

const toggleRow = (seasonal) =>
  new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('store_regular')
      .setLabel('Main Store')
      .setStyle(seasonal ? ButtonStyle.Secondary : ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('store_seasonal')
      .setLabel('Seasonal Store')
      .setStyle(seasonal ? ButtonStyle.Primary : ButtonStyle.Secondary),
    // ⬅️ NEW SELL BUTTON
    new ButtonBuilder()
      .setCustomId('switch_to_sell') 
      .setLabel('Sell Items')
      .setStyle(ButtonStyle.Success)
  );

export default {
  data: new SlashCommandBuilder()
    .setName('store')
    .setDescription('Browse the Dot Bot store'),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    let seasonal = false;

    // Initial render
    const items = await loadItems(seasonal);
    if (!items.length) {
      return interaction.reply({
        content: 'The store is empty.',
        flags: MessageFlags.Ephemeral
      });
    }

    const embed = buildStoreEmbed(seasonal ? 'Seasonal Store' : 'Main Store', items);
    // ⬅️ toggleRow is now the only component row
    const rows = [toggleRow(seasonal), ...buildItemRows(items)]; 

    await interaction.reply({
      embeds: [embed],
      components: rows,
      flags: MessageFlags.Ephemeral
    });

    const message = await interaction.fetchReply();
    const collector = message.createMessageComponentCollector({ time: 5 * 60_000 });

    collector.on('collect', async (btn) => {
      if (btn.user.id !== interaction.user.id) {
        return btn.reply({ content: 'Only the command invoker can use these buttons.', ephemeral: true });
      }

      // --- 1. Toggle Tabs (Buy View) ---
      if (btn.customId === 'store_regular' || btn.customId === 'store_seasonal') {
        seasonal = btn.customId === 'store_seasonal';
        const newItems = await loadItems(seasonal);
        const newEmbed = buildStoreEmbed(seasonal ? 'Seasonal Store' : 'Main Store', newItems);
        const newRows = [toggleRow(seasonal), ...buildItemRows(newItems)];
        await btn.update({ embeds: [newEmbed], components: newRows });
        return;
      }

      // --- 2. Switch to Sell View ---
      if (btn.customId === 'switch_to_sell') {
        const { embed, components } = await buildSellView(btn.user.id);
        await btn.update({ embeds: [embed], components: components });
        return;
      }

      // --- 3. Return to Buy View ---
      if (btn.customId === 'return_to_store') {
        seasonal = false;
        const newItems = await loadItems(seasonal);
        const newEmbed = buildStoreEmbed('Main Store', newItems);
        const newRows = [toggleRow(false), ...buildItemRows(newItems)];
        await btn.update({ embeds: [newEmbed], components: newRows });
        return;
      }

      // --- 4. Handle Selling (Select Menu) ---
      if (btn.customId === 'sell_item_select' && btn.isStringSelectMenu()) {
        const [itemId, sellPriceString] = btn.values[0].split('|');
        const sellPrice = Number(sellPriceString);
        
        // Fetch User and Item definition
        const user = await getOrCreateUser(btn.user.id);
        const item = await Item.findByPk(Number(itemId));

        if (!item) {
          return btn.reply({ content: 'That item is invalid or no longer exists.', ephemeral: true });
        }

        // Use the custom UserItem helper function to remove the item
        await UserItem.removeItem(user.user_id, Number(itemId), 1);
        
        // Add coins to user
        user.coins += sellPrice;
        await user.save();

        // Rebuild sell view after transaction
        const { embed, components } = await buildSellView(btn.user.id);

        await btn.update({ 
            content: `✅ Sold **${item.name}** for **${sellPrice} coins**!`, 
            embeds: [embed], 
            components: components 
        });

        return;
      }


      // --- 5. Handle Purchase (Buy View) ---
      if (btn.customId.startsWith('buy_')) {
        const id = Number(btn.customId.split('_')[1] || 0);
        const item = await Item.findByPk(id);
        
        // NOTE: item.seasonal check is currently broken if the bot hasn't tracked the seasonal state correctly, but we trust the initial filtering.

        if (!item) {
           return btn.reply({ content: 'That item is no longer available.', ephemeral: true });
        }

        // Load/create the buyer
        const user = await getOrCreateUser(btn.user.id);

        if (user.coins < item.cost) {
          return btn.reply({ content: `You need **${item.cost}** coins, but you only have **${user.coins}**.`, ephemeral: true });
        }

        // If this is a role item, validate bot permissions & role position
        if (item.type === 'role' || item.type === 'roleColor') {
          // ... (existing role handling logic)
          const role = btn.guild.roles.cache.get(item.role_id);
          // ... (role validation and assignment logic)
          
          user.coins -= item.cost;
          await user.save();

          try {
            await btn.member.roles.add(role);
          } catch (err) {
            // Refund on failure
            user.coins += item.cost;
            await user.save();
            console.error('Role grant failed:', err);
            return btn.reply({ content: 'I couldn’t assign that role. (I refunded your coins.)', ephemeral: true });
          }

          return btn.reply({ content: `Purchased **${item.name}**! Role assigned 🎨`, ephemeral: true });
        }

        // Non-role item: add to inventory
        user.coins -= item.cost;
        await user.save();

        // Use the custom UserItem helper function to add the item
        await UserItem.addItem(user.user_id, item.id, 1);

        return btn.reply({ content: `Purchased **${item.name}** for **${item.cost}** coins!`, ephemeral: true });
      }
    });

    collector.on('end', async () => {
      // Disable all buttons after timeout
      try {
        const disabled = message.components.map((row) => {
          const r = ActionRowBuilder.from(row);
          r.components.forEach((c) => c.setDisabled(true));
          return r;
        });
        await interaction.editReply({ components: disabled });
      } catch {}
    });
  }
};