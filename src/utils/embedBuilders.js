import { EmbedBuilder } from 'discord.js';

// --- Helper Functions ---

/**
 * Creates a simple embed with a title and optional description.
 * Only sets the description if it's a non-empty string.
 * @param {string} title
 * @param {string} [description]
 * @param {Object} [options]
 */
export function createBasicEmbed(title, description, options = {}) {
    const embed = new EmbedBuilder()
        .setColor(options.color ?? 0x5865F2)
        .setTitle(title)
        .setTimestamp(new Date());

    const desc = typeof description === 'string' ? description.trim() : '';
    if (desc.length > 0) {
        embed.setDescription(desc);
    }
    return embed;
}

/**
 * Creates a standardized embed for error or failure messages.
 * @param {string} title
 * @param {string} [description]
 */
export function createErrorEmbed(title = 'Oops! Something Went Wrong', description) {
    return new EmbedBuilder()
        .setColor(0xFF0000) // Bright Red for errors
        .setTitle(`🛑 ${title}`)
        .setDescription(description || 'Please try again, or contact an admin if the issue persists.')
        .setTimestamp(new Date());
}

/**
 * Builds the store embed listing items for sale. Buttons should be created
 * separately; this helper only constructs the embed.
 * @param {Array<{id:number,name:string,description:string,cost:number,type:string}>} items
 */
export function createStoreEmbed(items) {
    const embed = createBasicEmbed('Dot Bot Store 🛍️', 'Choose an item to purchase.');
    for (const item of items) {
        // Use inline fields if possible to save space
        embed.addFields({
            name: `${item.name} — ${item.cost} coins`,
            value: (item.description && item.description.trim()) || 'No description provided.',
            inline: false
        });
    }
    return embed;
}

/**
 * Builds an inventory embed summarising a user's holdings.
 * @param {import('../models/User.js').default} user
 * @param {Array<{name:string, quantity:number}>} items
 * @param {Array<{species:string,name:string,tier:string,level:number,is_active:boolean}>} pets
 */
export function createInventoryEmbed(user, items, pets) {
    const embed = createBasicEmbed('Your Magical Inventory ✨', `<@${user.user_id}>'s holdings.`);
    
    // Use an icon for coin values for better visibility
    embed.addFields(
        { name: '💰 Coins', value: `${user.coins}`, inline: true },
        { name: '🎁 Pixie Pouches', value: `${user.pixie_pouches}`, inline: true },
        { name: '✨ Stardust', value: `${user.stardust}`, inline: true }
    );

    if (items?.length > 0) {
        embed.addFields({
            name: '📦 Items',
            value: items.map((i) => `• ${i.name} ×**${i.quantity}**`).join('\n'),
            inline: false
        });
    }

    if (pets?.length > 0) {
        embed.addFields({
            name: '🐾 Pets',
            value: pets
                // ENHANCEMENT: Include species and use a bold emoji for the active pet
                .map((p) => {
                    const activeIndicator = p.is_active ? '💖' : '◻️';
                    const species = p.species ? `(${p.species})` : '';
                    return `${activeIndicator} **${p.name}** ${species} [${p.tier}] – Lv. ${p.level.toFixed(1)}`;
                })
                .join('\n'),
            inline: false
        });
    }

    // Add a final footer hint
    embed.setFooter({ text: 'Use /shop to find new items or /pet to manage your companions!' });

    return embed;
}

// cute rank badges (1–3 medals, then stars/hearts)
function rankBadge(n) {
    if (n === 1) return '🥇';
    if (n === 2) return '🥈';
    if (n === 3) return '🥉';
    if (n <= 10) return '⭐';
    return '💖';
}

/**
 * Builds a cutesy leaderboard embed.
 * @param {Array<{user_id:string,coins:number,rank?:number, is_current_user?: boolean}>} top
 * @param {{ page?: number, totalPages?: number, color?: number }} [opts]
 */
export function createLeaderboardEmbed(top, opts = {}) {
    const page = opts.page ?? 1;
    const totalPages = opts.totalPages ?? 1;
    const color = opts.color ?? 0xE0B0FF; // soft pastel purple

    // prettier title + optional page indicator
    const title = totalPages > 1
        ? `✨  Sparkly Leaderboard — Page ${page}/${totalPages}`
        : '✨  Sparkly Leaderboard';

    const embed = createBasicEmbed(title, null, { color });

    if (!top || top.length === 0) {
        return embed.setFooter({ text: 'No shiny coins yet… go chat to earn some! 💫' });
    }

    const lines = top.map((u, i) => {
        const rank = typeof u.rank === 'number' ? u.rank : i + 1;
        const badge = rankBadge(rank);
        
        let line = `${badge} **${rank}.** <@${u.user_id}> · **${u.coins}** coins`;
        
        // ENHANCEMENT: Add visual emphasis for the current user (if tracking is enabled)
        if (u.is_current_user) {
            line = `» ${line} «`; // Add delimiters to highlight the user's own rank
        }
        
        return line;
    });

    // ENHANCEMENT: Truncate lines if there are too many (Discord limit is high, but keeps it clean)
    const truncatedLines = lines.slice(0, 20); 

    embed
        .setDescription(truncatedLines.join('\n'))
        .setFooter({ text: 'Keep chatting, sparkle up those coins! ✨' });

    return embed;
}