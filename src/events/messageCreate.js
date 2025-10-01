import { Events } from 'discord.js';
import { awardTextCoin } from '../utils/coinManager.js';
import OpenAI from 'openai';
import config from '../config.js';

// ✅ New OpenAI client initialization for v4+
const openai = new OpenAI({
    apiKey: config.ai.openaiApiKey
});

const COMMAND_PREFIX = config.prefix || 'D!';
let lastAiReplyTimestamp = 0;
const AI_COOLDOWN_MS = 10 * 1000; // 10 seconds

// --- ENHANCEMENT: Coin Rewarding Logic ---
const COIN_REWARD_COOLDOWN_MS = 60 * 1000; // 1 minute cooldown per user for earning coins
const MIN_MESSAGE_LENGTH = 10; // Minimum characters required to earn a coin
const userCoinCooldowns = new Map(); // Map<string (userId), number (lastRewardedTimestamp)>

// --- New Coin Reward Tiers ---
const BASE_COIN_REWARD = 1;      // Base coin amount for qualifying messages
const LONG_MESSAGE_THRESHOLD = 50; // Characters needed for Tier 2 reward
const VERY_LONG_MESSAGE_THRESHOLD = 150; // Characters needed for Tier 3 reward
const BONUS_COIN_TIER_2 = 1;     // Extra coin for long messages (Total 2)
const BONUS_COIN_TIER_3 = 2;     // Extra coins for very long messages (Total 3)

// --- Conversation History Cache ---
const MAX_HISTORY_TURNS = 5; // Remember 5 user messages and 5 bot replies (10 messages total)
const CONVERSATION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes of inactivity clears the history
const conversationHistory = new Map(); // Map<string (channel ID), { messages: object[], timestamp: number }>

export default {
    name: Events.MessageCreate,

    /**
     * Awards coins based on message length and cooldowns, 
     * and replies with AI if the bot is pinged, using conversation history.
     * @param {import('discord.js').Message} message
     */
    async execute(message) {
        if (
            message.author.bot ||
            !message.guild ||
            message.content.startsWith(COMMAND_PREFIX)
        ) return;

        const userId = message.author.id;
        const now = Date.now();
        const messageLength = message.content.length;

        // --- ENHANCEMENT: Variable Coin Rewarding Logic ---
        const lastRewarded = userCoinCooldowns.get(userId) || 0;
        
        if (messageLength < MIN_MESSAGE_LENGTH) {
            // Message is too short to qualify for any coin award.
        } else if (now - lastRewarded < COIN_REWARD_COOLDOWN_MS) {
            // User is currently on cooldown.
        } else {
            // Calculate variable reward amount
            let rewardAmount = BASE_COIN_REWARD;
            
            if (messageLength >= VERY_LONG_MESSAGE_THRESHOLD) {
                // Tier 3 Reward (e.g., 1 + 2 = 3 coins total)
                rewardAmount += BONUS_COIN_TIER_2 + BONUS_COIN_TIER_3;
            } else if (messageLength >= LONG_MESSAGE_THRESHOLD) {
                // Tier 2 Reward (e.g., 1 + 1 = 2 coins total)
                rewardAmount += BONUS_COIN_TIER_2;
            } else {
                // Tier 1 Reward (e.g., 1 coin total)
            }

            // Award text coin and update cooldown
            try {
                // IMPORTANT: This call requires awardTextCoin in coinManager.js 
                // to be updated to accept a reward amount argument (e.g., awardTextCoin(userId, amount))
                await awardTextCoin(userId, rewardAmount); 
                userCoinCooldowns.set(userId, now);
            } catch (err) {
                console.error('Error awarding text coin:', err);
            }
        }

        // AI Reply
        if (
            config.ai?.enabled &&
            message.mentions.has(message.client.user) &&
            !message.mentions.everyone // 🚫 prevent @everyone / @here from triggering
        ) {
            const allowedChannels = config.ai.replyInChannels || [];
            if (allowedChannels.length > 0 && !allowedChannels.includes(message.channel.name)) return;

            if (now - lastAiReplyTimestamp < AI_COOLDOWN_MS) {
                return message.reply("Dot's still catching her breath! ✨ Try again in a moment.");
            }

            const prompt = message.content.replace(/<@!?(\d+)>/, '').trim();
            if (!prompt) return message.reply("Hi there! What would you like to ask?");

            const channelId = message.channel.id;
            let conversation = conversationHistory.get(channelId);

            // 1. Prune conversation if it's timed out
            if (conversation && now - conversation.timestamp > CONVERSATION_TIMEOUT_MS) {
                conversationHistory.delete(channelId);
                conversation = null;
            }
            
            // 2. Initialize conversation if needed
            if (!conversation) {
                conversation = { messages: [], timestamp: now };
                conversationHistory.set(channelId, conversation);
            }
            
            // 3. Build the prompt messages including system instruction and history
            const systemMessage = {
                role: 'system',
                content: config.ai.personality || 'You are a cute and clever fairy named Dot, living inside a magical Discord Server.',
            };

            // Limit history to the last N turns (2 messages per turn: user + assistant)
            const historySlice = conversation.messages.slice(-MAX_HISTORY_TURNS * 2);

            const messages = [
                systemMessage,
                ...historySlice, 
                { role: 'user', content: prompt } // Add the current user prompt
            ];

            try {
                const response = await openai.chat.completions.create({
                    model: 'gpt-4o',
                    messages: messages,
                });

                const botReply = response.choices[0].message.content;

                // 4. Update conversation history with the new turn
                conversation.messages.push({ role: 'user', content: prompt });
                conversation.messages.push({ role: 'assistant', content: botReply });
                
                // Prune history to maintain size limit
                if (conversation.messages.length > MAX_HISTORY_TURNS * 2) {
                    conversation.messages = conversation.messages.slice(-MAX_HISTORY_TURNS * 2);
                }

                // 5. Reset cooldown and update timestamp
                lastAiReplyTimestamp = now;
                conversation.timestamp = now;

                return message.reply(botReply);

            } catch (error) {
                console.error('Error generating AI response:', error);
                return message.reply('Oops! Dot had trouble thinking of a reply. Try again soon.');
            }
        }
    },
};
