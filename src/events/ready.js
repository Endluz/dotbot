import { Events } from 'discord.js';
import { incrementActivePetLevels } from '../utils/petManager.js';

// Define the interval in a constant for clarity
const HOURLY_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Handles the logic for scheduling recurring tasks.
 * Uses a recursive setTimeout pattern to ensure tasks don't overlap.
 */
function schedulePetLevelUpdates() {
    // 1. Run the update task
    incrementActivePetLevels()
        .catch((err) => console.error('Pet level update error', err))
        .finally(() => {
            // 2. Schedule the next run after the interval has passed
            // The next task only starts once the current one completes (or fails)
            setTimeout(schedulePetLevelUpdates, HOURLY_INTERVAL_MS);
        });
}

export default {
    name: Events.ClientReady,
    once: true,
    /**
     * Called when the client becomes ready.
     * @param {import('discord.js').Client} client
     */
    execute(client) {
        console.log(`Logged in as ${client.user.tag}`);
        
        // --- ENHANCEMENT: Initial Run and Recursive Scheduling ---
        console.log('Scheduling hourly pet level updates. Running initial update...');
        
        // Start the recursive scheduler, which runs the update immediately,
        // then schedules the next run after HOURLY_INTERVAL_MS.
        schedulePetLevelUpdates();
    }
};
