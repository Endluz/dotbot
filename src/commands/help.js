import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('View a list of all Dot Bot commands'),

    async execute(interaction) {
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        
        const embed = new EmbedBuilder()
            .setTitle('📖 Dot Bot – Help Menu')
            .setColor('#a259ff')
            .setDescription('Here are all available commands you can use:')
            .addFields(
                { 
                    name: '💰 Economy & Gifting', 
                    value: '`/bal`, `/bank`, `/lb`, `/gamble [amount]`, `/givecoin @user [amount]`', 
                    inline: false 
                },
                { 
                    name: '🛠️ Crafting & Enchanting', 
                    value: '`/collect` (to gather materials)\n`/forge [item_name]` (to craft)\n`/enchant [item] [enchantment]` (skill-based value upgrade)', 
                    inline: false 
                },
                { 
                    name: '🎒 Inventory & Items', 
                    value: '`/i` or `/inventory` (View your items and pets)\n`/mbox` (Open a Mystery Box)\n`/gift @user [item] [qty]` (Give an item)', 
                    inline: false 
                },
                { 
                    name: '🛍️ Store & Pets', 
                    value: '`/store` (Buy/Sell items)\n`/pet` (Manage/view your pets)', 
                    inline: false 
                }
            )
            .setFooter({ text: 'Use /store, /i, or /forge to get started!' });
            
        // Only show Admin commands to Administrators
        if (isAdmin) {
            embed.addFields({
                name: '⚙️ Admin Commands',
                value: '`/aitemcreate` (Open modal to add new item)\n`/admintool` (Other admin functions)',
                inline: false
            });
        }

        await interaction.reply({ embeds: [embed] });
    }
};