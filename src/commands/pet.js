import {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} from 'discord.js';
import { Pet } from '../models/index.js';
// Assuming these utilities are available:
// import { getPetLore } from '../utils/petManager.js';
// import { getTierEmoji } from '../utils/emojiUtils.js';

const PAGE_SIZE = 5;
const COLLECTOR_TIMEOUT_MS = 120_000; // 2 minutes

/**
 * Renders the pet list and returns the Embed and Components
 * @param {import('discord.js').User} user The command invoker
 * @param {import('../models/Pet')[]} pets All of the user's pets
 * @param {number} page The current 0-indexed page number
 * @param {string} nonce The unique interaction ID for collector filtering
 * @returns {{embed: EmbedBuilder, components: ActionRowBuilder[]}}
 */
function renderPetList(user, pets, page, nonce) {
    const totalPages = Math.ceil(pets.length / PAGE_SIZE);

    // 1. Slice page data
    const slice = pets.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    
    // 2. Format pet lines
    const lines = slice.map((p) => {
        const active = p.is_active ? '🔹' : '◻️';
        // Assuming getTierEmoji(p.tier) is available
        const emoji = getTierEmoji(p.tier) || '❓';
        // Assuming p.level is a number
        return `${active} **${p.name || p.species}** (${emoji} ${p.species}, ${p.tier}) – Lv. ${p.level.toFixed(1)}`;
    });

    let description = lines.join('\n');

    // 3. Add active pet lore
    const active = pets.find((p) => p.is_active);
    if (active) {
        // Assuming getPetLore(active.species) is available
        const lore = getPetLore(active.species) || 'No lore available for this species.';
        description += `\n\n📘 **Active Pet Lore:**\n*${lore}*`;
    }

    // 4. Build Embed
    const embed = new EmbedBuilder()
        .setTitle(`🐾 ${user.username}'s Pets`)
        .setDescription(description)
        .setFooter({ text: `Page ${page + 1} of ${totalPages} | Pet ID: ${active ? active.id : 'None'} Active` })
        .setColor(0x00c8ff);

    // 5. Build Buttons (Component Row)
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`pet_page_prev:${nonce}`)
            .setLabel('◀️ Prev')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === 0),
        new ButtonBuilder()
            .setCustomId(`pet_page_next:${nonce}`)
            .setLabel('Next ▶️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page >= totalPages - 1),
        new ButtonBuilder()
            .setCustomId(`pet_feed:${nonce}`)
            .setLabel('🥩 Feed')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`pet_activate:${nonce}`)
            .setLabel('⭐ Activate')
            .setStyle(ButtonStyle.Primary)
    );

    return { embed, components: [row], totalPages };
}

export default {
    data: new SlashCommandBuilder()
        .setName('pet')
        .setDescription('View your pets and active pet'),

    /**
     * @param {import('discord.js').ChatInputCommandInteraction} interaction
     */
    async execute(interaction) {
        const userId = interaction.user.id;
        // Fetch all pets once
        const pets = await Pet.findAll({ where: { owner_id: userId } });
        
        if (pets.length === 0) {
            return interaction.reply({ content: '❌ You do not own any pets yet.', ephemeral: true });
        }

        // Sort: Active pet first (for lore) and then by ID/name
        pets.sort((a, b) => (b.is_active ? 1 : 0) - (a.is_active ? 1 : 0) || a.id - b.id);

        let currentPage = 0;
        const nonce = interaction.id; 

        // Initial Render
        let { embed, components, totalPages } = renderPetList(interaction.user, pets, currentPage, nonce);
        const msg = await interaction.reply({ embeds: [embed], components, fetchReply: true });

        // --- Start Collector ---
        const collector = msg.createMessageComponentCollector({
            time: COLLECTOR_TIMEOUT_MS,
            filter: (btnInt) => {
                // Only the command invoker can use the buttons AND the nonce must match
                if (btnInt.user.id !== interaction.user.id) {
                    btnInt.reply({ content: 'Only the command invoker can use these controls.', ephemeral: true });
                    return false;
                }
                return btnInt.customId.endsWith(`:${nonce}`);
            }
        });

        collector.on('collect', async (btnInt) => {
            const [id] = btnInt.customId.split(':');
            
            // Handle Pagination
            if (id === 'pet_page_prev' && currentPage > 0) {
                currentPage -= 1;
            } else if (id === 'pet_page_next' && currentPage < totalPages - 1) {
                currentPage += 1;
            } else if (id === 'pet_feed') {
                // Direct user to the feed command or open a modal
                await btnInt.reply({ content: '➡️ **To feed a pet, please use the dedicated command:** `/pet feed` (or similar).', ephemeral: true });
                // Do not re-render the list for a non-pagination button click
                return;
            } else if (id === 'pet_activate') {
                // Direct user to the activate command or open a modal
                await btnInt.reply({ content: '➡️ **To set an active pet, please use the dedicated command:** `/pet activate` (or similar).', ephemeral: true });
                // Do not re-render the list for a non-pagination button click
                return;
            } else {
                // If button is clicked when disabled (Prev on page 1, Next on last page)
                await btnInt.deferUpdate();
                return;
            }

            // Re-render and update message for pagination
            ({ embed, components } = renderPetList(interaction.user, pets, currentPage, nonce));
            
            await btnInt.update({ embeds: [embed], components });

            // Reset collector timer after a successful action
            collector.resetTimer({ time: COLLECTOR_TIMEOUT_MS });
        });

        collector.on('end', async (_collected, reason) => {
            if (reason === 'time') {
                // Disable components on timeout
                try {
                    const disabledComponents = components.map(row => 
                        new ActionRowBuilder().addComponents(
                            row.components.map(btn => ButtonBuilder.from(btn).setDisabled(true))
                        )
                    );
                    await interaction.editReply({ components: disabledComponents }).catch(() => {});
                } catch {}
            }
        });
    }
};