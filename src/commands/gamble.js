import { SlashCommandBuilder } from 'discord.js';
import { getOrCreateUser } from '../utils/userUtils.js';

// Cooldown map: Stores user IDs and the timestamp (Date.now()) of last use
const cooldowns = new Map();
const COOLDOWN_MS = 1 * 60 * 1000; // 5 minutes

// --- Gambling Tiers ---
const GAMBLE_TIERS = [
    // Tiers must be ordered from highest multiplier (lowest chance) to lowest
    { maxRoll: 0.0001, multiplier: 1000, name: 'JACKPOT! 🏆', emoji: '👑' }, // 0.01%
    { maxRoll: 0.005, multiplier: 50, name: 'MEGA WIN', emoji: '✨' },      // 0.49%
    { maxRoll: 0.03, multiplier: 10, name: 'BIG WIN', emoji: '💰' },        // 2.5%
    { maxRoll: 0.20, multiplier: 2, name: 'DOUBLE UP', emoji: '✅' },        // 17%
    // Note: Any roll > 0.20 results in a loss (winnings = 0). Loss chance is 80%
];

export default {
    data: new SlashCommandBuilder()
        .setName('gamble')
        .setDescription('Gamble your coins for a chance to win big!')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('The number of coins to gamble')
                .setRequired(true)
        ),

    async execute(interaction) {
        const userId = interaction.user.id;
        const amount = interaction.options.getInteger('amount');

        // --- 1. Validation Checks ---

        if (amount <= 0) {
            return interaction.reply({ content: '❌ You must gamble a positive number of coins.', ephemeral: true });
        }

        const now = Date.now();
        const lastUsed = cooldowns.get(userId);
        if (lastUsed && now - lastUsed < COOLDOWN_MS) {
            const remaining = Math.ceil((COOLDOWN_MS - (now - lastUsed)) / 60000);
            return interaction.reply({ content: `⏳ You can gamble again in **${remaining} minutes**.`, ephemeral: true });
        }
        
        const user = await getOrCreateUser(userId);
        if (user.coins < amount) {
            return interaction.reply({ content: `❌ You only have **${user.coins}** coins, but tried to gamble **${amount}**.`, ephemeral: true });
        }

        // --- 2. Gambling Logic ---
        
        // Deduct coins first (committing the bet)
        user.coins -= amount;
        
        const roll = Math.random(); // Roll a value between 0 and 1
        let winnings = 0;
        let resultMessage = 'lost it all...';
        let resultEmoji = '💸';

        // Check tiers from highest multiplier/lowest chance down
        for (const tier of GAMBLE_TIERS) {
            if (roll < tier.maxRoll) {
                winnings = amount * tier.multiplier;
                resultMessage = `${tier.name}! You won a **${tier.multiplier}x multiplier**!`;
                resultEmoji = tier.emoji;
                break; // Stop checking tiers once a win is found
            }
        }

        // --- 3. Finalize Transaction and Cooldown ---

        user.coins += winnings;
        await user.save();
        cooldowns.set(userId, now); // Set cooldown after successful use

        // --- 4. Send Response ---
        
        const finalContent = winnings > 0
            ? `${resultEmoji} <@${userId}> gambled **${amount}** coins and won **${winnings}** coins! ${resultMessage}`
            : `💸 <@${userId}> gambled **${amount}** coins and ${resultMessage}`;

        return interaction.reply({
            content: finalContent,
            allowedMentions: { users: [userId] }, // Explicitly mention the user for public commands
        });
    }
};