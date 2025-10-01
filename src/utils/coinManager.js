import { Op } from 'sequelize';
import { User } from '../models/index.js';
import { getOrCreateUser } from './userUtils.js';

// Voice reward interval/cooldown is now 1 minute (60,000 ms)
const ONE_MINUTE = 60 * 1000;
const TEN_MINUTES = 10 * 60 * 1000;

/**
 * Awards coins for sending a text message, supporting variable amounts.
 * @param {string} userId
 * @param {number} amount The calculated coin amount to award (default 1).
 * @returns {Promise<boolean>} True if coins were awarded, false otherwise.
 */
export async function awardTextCoin(userId, amount = 1) {
    const user = await getOrCreateUser(userId);
    const now = new Date();
    
    // Cooldown check: Use 10-minute database safeguard
    if (user.lastTextAward) {
        const elapsed = now - new Date(user.lastTextAward);
        if (elapsed < TEN_MINUTES) return false; 
    }
    
    user.coins += amount;
    user.lastTextAward = now;
    await user.save();
    
    return true;
}

/**
 * Awards coins for voice participation, supporting variable amounts.
 * @param {string} userId
 * @param {number} amount The calculated base coin amount (1 for voice, 5 for streaming, etc.).
 * @returns {Promise<boolean>} True if coins were awarded, false otherwise.
 */
export async function awardVoiceCoin(userId, amount = 1) {
    const user = await getOrCreateUser(userId);
    const now = new Date();
    
    // Cooldown check: Use 1-minute database safeguard to match the new interval
    if (user.lastVoiceAward) {
        const elapsed = now - new Date(user.lastVoiceAward);
        if (elapsed < ONE_MINUTE) return false;
    }
    
    user.coins += amount;
    user.lastVoiceAward = now;
    
    await user.save();
    return true;
}
