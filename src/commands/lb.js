import {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} from 'discord.js';
import { User } from '../models/index.js';
import { createLeaderboardEmbed } from '../utils/embedBuilders.js';

const PAGE_SIZE = 10;
const MAX_ROWS = 50;
const REFRESH_COOLDOWN_MS = 15000; // Increased cooldown to 15 seconds to prevent spam
const COLLECTOR_TIMEOUT_MS = 120_000; // Increased timeout to 2 minutes

function pageToRows(all, page) {
    const start = (page - 1) * PAGE_SIZE;
    return all.slice(start, start + PAGE_SIZE);
}

function makeRowControls(page, totalPages, nonce, lastRefreshTs) {
    // Determine if refresh button should be disabled based on cooldown
    const now = Date.now();
    const canRefresh = now - lastRefreshTs >= REFRESH_COOLDOWN_MS;
    
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`lb_prev:${nonce}`)
            .setLabel('Prev')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page <= 1),
        new ButtonBuilder()
            .setCustomId(`lb_next:${nonce}`)
            .setLabel('Next')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page >= totalPages),
        new ButtonBuilder()
            .setCustomId(`lb_refresh:${nonce}`)
            .setLabel('Refresh')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(!canRefresh), // Apply cooldown here
        new ButtonBuilder()
            .setCustomId(`lb_close:${nonce}`)
            .setLabel('Close')
            .setStyle(ButtonStyle.Danger),
    );
}

export default {
    data: new SlashCommandBuilder()
        .setName('lb')
        .setDescription('Show the richest users (paginated: 10 per page, up to top 50)'),

    /**
     * @param {import('discord.js').ChatInputCommandInteraction} interaction
     */
    async execute(interaction) {
        // Defer the initial reply as fetching DB data can take time
        await interaction.deferReply({ ephemeral: false }); 
        
        const fetchTop = async () => {
            // Select only necessary columns for efficiency
            const users = await User.findAll({
                attributes: ['user_id', 'coins'],
                order: [['coins', 'DESC']],
                limit: MAX_ROWS
            });
            return users.map((u) => ({ user_id: u.user_id, coins: u.coins }));
        };

        let allRows = await fetchTop();
        let page = 1;
        let totalPages = Math.max(1, Math.ceil(allRows.length / PAGE_SIZE));
        let lastRefreshTs = 0; // Initialize to 0 so the first refresh is instant

        if (allRows.length === 0) {
            const emptyEmbed = createLeaderboardEmbed([]); 
            return interaction.editReply({ // Use editReply after defer
                content: 'Nobody on the board yet — start chatting to earn coins!',
                embeds: [emptyEmbed],
                allowedMentions: { users: [] },
            });
        }

        const nonce = interaction.id; 

        const render = async (edit = false) => {
            // Clamp page in case totalPages changed
            page = Math.min(Math.max(page, 1), totalPages);

            const pageRows = pageToRows(allRows, page);
            const embed = createLeaderboardEmbed(
                pageRows.map((r, i) => ({
                    user_id: r.user_id,
                    coins: r.coins,
                    rank: (page - 1) * PAGE_SIZE + (i + 1)
                })),
                { page, totalPages } 
            );

            // Pass lastRefreshTs to the control builder to check cooldown
            const components = [makeRowControls(page, totalPages, nonce, lastRefreshTs)];
            const payload = { embeds: [embed], components, allowedMentions: { users: [] } };

            // Use editReply since the reply was deferred
            return interaction.editReply(payload); 
        };

        // Render the initial state
        await render(false);

        // Fetch the message object to attach the collector
        const msg = await interaction.fetchReply();
        const collector = msg.createMessageComponentCollector({
            time: COLLECTOR_TIMEOUT_MS, // Use new, longer timeout
            filter: (btnInt) => {
                if (btnInt.user.id !== interaction.user.id) {
                    btnInt.reply({ content: 'Only the command invoker can use these buttons.', ephemeral: true });
                    return false;
                }
                return typeof btnInt.customId === 'string' && btnInt.customId.endsWith(`:${nonce}`);
            }
        });

        collector.on('collect', async (btnInt) => {
            const id = btnInt.customId.split(':')[0];

            if (id === 'lb_close') {
                try {
                    // Disable controls before deleting to prevent errors if deletion fails
                    await interaction.editReply({ components: [] }); 
                    await btnInt.message.delete(); 
                } catch {}
                return collector.stop('closed');
            }

            // Navigation
            if (id === 'lb_prev' && page > 1) page -= 1;
            if (id === 'lb_next' && page < totalPages) page += 1;

            if (id === 'lb_refresh') {
                const now = Date.now();
                if (now - lastRefreshTs < REFRESH_COOLDOWN_MS) {
                    // This block is technically redundant due to the disabled button, but is a safe fallback
                    return btnInt.reply({ content: 'Give me a moment before refreshing again (15s cooldown) 💫', ephemeral: true });
                }
                lastRefreshTs = now;

                // Acknowledge the button press immediately
                await btnInt.deferUpdate(); 

                // Re‑query and keep the same page if possible
                const oldPage = page;
                allRows = await fetchTop();
                totalPages = Math.max(1, Math.ceil(allRows.length / PAGE_SIZE));
                page = Math.min(oldPage, totalPages);

                // Reset the collector timer after successful refresh
                try { collector.resetTimer({ time: COLLECTOR_TIMEOUT_MS }); } catch {}
                
                // Render the new state (no need for a separate update since deferUpdate was used)
                await render(true);
                return; // Exit here to skip the generic update below
            }

            // Generic update for Prev/Next
            await btnInt.update({}); 
            await render(true);
        });

        collector.on('end', async (_collected, reason) => {
            if (reason === 'closed') return;
            
            // Disable all components on timeout
            try {
                // Ensure lastRefreshTs is updated before making the final controls row
                const disabledRow = makeRowControls(page, totalPages, nonce, lastRefreshTs);
                disabledRow.components.forEach((c) => c.setDisabled(true));
                await interaction.editReply({ components: [disabledRow] });
            } catch {}
        });
    }
};