import { SlashCommandBuilder } from 'discord.js';
// Assuming 'User' model is imported to fetch the giver's balance
import { User } from '../models/index.js'; 
import { getOrCreateUser } from '../utils/userUtils.js';

const DAILY_GIVE_LIMIT = 10000;

function isNewDay(userDate) {
    // Check if the stored date is today. If not, reset the counter.
    if (!userDate) return true; // Treat null/undefined as new day
    const storedDate = new Date(userDate);
    const today = new Date();

    // Check if the date components (year, month, day) match
    return storedDate.getFullYear() !== today.getFullYear() ||
           storedDate.getMonth() !== today.getMonth() ||
           storedDate.getDate() !== today.getDate();
}

export default {
    data: new SlashCommandBuilder()
        .setName('givecoin')
        .setDescription('Give coins to a user (max 10,000/day)')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to give coins to')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('The amount of coins to give')
                .setRequired(true)),

    async execute(interaction) {
        const giverId = interaction.user.id;
        const target = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');

        // --- 1. Basic Validation ---
        
        if (amount <= 0) {
            return interaction.reply({ content: '❌ Amount must be greater than 0.', ephemeral: true });
        }
        
        if (giverId === target.id) {
             return interaction.reply({ content: '❌ You cannot give coins to yourself.', ephemeral: true });
        }

        // --- 2. Load and Check Giver's Status ---
        
        // Load both giver and target users (target just to ensure their record exists)
        const giver = await getOrCreateUser(giverId);
        await getOrCreateUser(target.id); // Ensure the target user record exists

        // If it's a new day, reset the giver's counter
        if (isNewDay(giver.daily_give_date)) {
            giver.daily_give_amount = 0;
            // The date will be updated after a successful transaction below
        }
        
        // --- 3. Limit Check ---

        const givenToday = giver.daily_give_amount;
        
        if (givenToday + amount > DAILY_GIVE_LIMIT) {
            const remaining = DAILY_GIVE_LIMIT - givenToday;
            return interaction.reply({
                content: `❌ Daily give limit reached. You can give **${remaining}** more coins today.`,
                ephemeral: true
            });
        }
        
        // --- 4. Giver's Coin Check (CRITICAL) ---

        if (giver.coins < amount) {
            return interaction.reply({ content: `❌ You only have **${giver.coins}** coins. You cannot give **${amount}**.`, ephemeral: true });
        }

        // --- 5. Database Transaction ---
        
        // a. Deduct from Giver
        giver.coins -= amount;
        giver.daily_give_amount += amount;
        giver.daily_give_date = new Date(); // Update date to today
        
        // b. Add to Recipient
        // NOTE: Sequelize's `getOrCreateUser` function should return the User model instance
        // directly, but we rely on a direct coin update for simplicity here.
        // For atomic updates, the `target.coins` update should happen here, 
        // but since we only fetched the target to ensure existence, we must fetch 
        // the target's instance again or assume `getOrCreateUser` returns the live object.
        
        // Re-fetch or rely on a helper to update the target's coins
        await User.increment('coins', { by: amount, where: { user_id: target.id } });

        // c. Save Giver's state
        await giver.save();

        // --- 6. Confirmation and Notification ---
        
        // Confirmation to giver
        await interaction.reply({
            content: `✅ Gave **${amount} coins** to ${target.username}. You’ve given **${giver.daily_give_amount}/${DAILY_GIVE_LIMIT}** coins today.`,
            ephemeral: true
        });

        // DM the recipient
        try {
            await target.send(`💰 You’ve received **${amount} coins** from **${interaction.user.username}**!`);
        } catch (err) {
            console.warn(`❌ Could not DM ${target.tag}.`);
        }
    }
};