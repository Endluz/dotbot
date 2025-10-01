import { Events } from 'discord.js';
import { awardVoiceCoin } from '../utils/coinManager.js'; 

// --- Configuration Constants ---
// REWARD INTERVAL: Set to 1 minute (60,000 ms)
const VOICE_REWARD_INTERVAL_MS = 60 * 1000; 
const BASE_VOICE_COIN = 1;      // Coins per minute for talking
const STREAMING_BONUS_COIN = 4; // Extra coins for streaming (1 Base + 4 Bonus = 5 total)
const MIN_USERS_FOR_REWARD = 2; // Minimum users in channel to earn coins

// --- Group Multiplier Configuration ---
const GROUP_MULTIPLIER_THRESHOLD = 3; // Start multiplier at 3 users
const GROUP_COIN_MULTIPLIER = 1.2;    // 20% bonus (1.2x multiplier)

// Map to store active interval timers: Map<string (userId), NodeJS.Timeout>
const voiceRewardIntervals = new Map(); 

/**
 * The core logic for checking eligibility and awarding voice coins.
 * This runs every 60 seconds (1 minute) for every tracked user.
 * @param {import('discord.js').VoiceState} state 
 */
async function processVoiceReward(state) {
    const currentState = state.guild.voiceStates.cache.get(state.id);

    // CRITICAL: Check eligibility before rewarding
    if (!currentState || !currentState.channel || currentState.mute || currentState.deaf) {
        // If the user is no longer eligible (left, muted, or deafened), stop the loop.
        stopVoiceReward(currentState.id);
        return;
    }

    const userCount = currentState.channel.members.size;

    // Check minimum user count in the channel (prevents idling alone)
    if (userCount < MIN_USERS_FOR_REWARD) {
        // Stop tracking if they're idling alone
        stopVoiceReward(currentState.id);
        return; 
    }

    // Determine base reward amount
    const isStreaming = currentState.selfVideo || currentState.selfStream;
    let rewardAmount = BASE_VOICE_COIN;

    if (isStreaming) {
        // 1 (Base) + 4 (Bonus) = 5 coins per minute
        rewardAmount += STREAMING_BONUS_COIN; 
    }

    // --- Apply Group Multiplier ---
    if (userCount >= GROUP_MULTIPLIER_THRESHOLD) {
        // Apply the multiplier and use Math.ceil to ensure whole coins (e.g., 2.4 becomes 3)
        const baseRewardBeforeMultiplier = rewardAmount;
        rewardAmount = Math.ceil(baseRewardBeforeMultiplier * GROUP_COIN_MULTIPLIER);
    }

    try {
        // Award the calculated coin amount
        await awardVoiceCoin(currentState.id, rewardAmount); 
    } catch (err) {
        console.error(`Error awarding voice coin for user ${currentState.id}:`, err);
    }
}

/**
 * Starts the reward loop for a user.
 * @param {string} userId
 * @param {import('discord.js').VoiceState} state
 */
function startVoiceReward(userId, state) {
    if (voiceRewardIntervals.has(userId)) {
        // Already running, do nothing
        return; 
    }

    // Immediately run the check once before setting the interval
    processVoiceReward(state); 

    // Set the recurring interval (now 1 minute)
    const interval = setInterval(() => processVoiceReward(state), VOICE_REWARD_INTERVAL_MS);
    voiceRewardIntervals.set(userId, interval);
}

/**
 * Stops and clears the reward loop for a user.
 * @param {string} userId
 */
function stopVoiceReward(userId) {
    const interval = voiceRewardIntervals.get(userId);
    if (interval) {
        clearInterval(interval);
        voiceRewardIntervals.delete(userId);
    }
}


export default {
    name: Events.VoiceStateUpdate,
    /**
     * @param {import('discord.js').VoiceState} oldState
     * @param {import('discord.js').VoiceState} newState
     */
    async execute(oldState, newState) {
        if (newState.member?.user?.bot) return;

        const userId = newState.id;
        const oldChannelId = oldState.channelId;
        const newChannelId = newState.channelId;
        
        // 1. User Joined or Switched Channel (Start Tracking)
        if (newChannelId && newChannelId !== oldChannelId) {
            stopVoiceReward(userId); 

            if (!newState.mute && !newState.deaf) {
                startVoiceReward(userId, newState); 
            }
        }
        
        // 2. User Left Channel (Stop Tracking)
        else if (!newChannelId && oldChannelId) {
            stopVoiceReward(userId);
        }
        
        // 3. User Changed State (Mute/Deafen/Stream Toggle) while in channel
        else if (newChannelId === oldChannelId && newChannelId) {
            const isEligibleNow = !newState.mute && !newState.deaf;
            
            if (isEligibleNow) {
                // If they became eligible (e.g., unmuted), ensure tracking is running
                startVoiceReward(userId, newState);
            } else {
                // If they became ineligible (e.g., muted or deafened), stop tracking
                stopVoiceReward(userId);
            }
        }
    }
};
