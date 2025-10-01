// --- Configuration Maps (moved out of function for performance) ---

/**
 * Maps pet tier strings to corresponding emojis.
 * @type {Object<string, string>}
 */
const TIER_EMOJI_MAP = {
    common: '🟢',
    uncommon: '🔵',
    rare: '🟣',
    epic: '🟠',
    legendary: '🌟'
};

/**
 * Maps pet tier strings to corresponding hex color codes (for use in Discord embeds).
 * @type {Object<string, number>}
 */
const TIER_COLOR_MAP = {
    common: 0x8A8A8A,    // Gray/Dull Green
    uncommon: 0x00BFFF,  // Deep Sky Blue
    rare: 0xA020F0,      // Purple
    epic: 0xFF8C00,      // Dark Orange
    legendary: 0xFFD700   // Gold
};

// --- Exported Functions ---

/**
 * Gets the emoji representing a pet's tier.
 * @param {string} tier
 * @returns {string} The tier emoji or '❓' if not found.
 */
export function getTierEmoji(tier) {
    if (typeof tier !== 'string') return '❓';
    return TIER_EMOJI_MAP[tier.toLowerCase()] || '❓';
}

/**
 * Gets the embed color code representing a pet's tier.
 * @param {string} tier
 * @returns {number} The hex color code or a default blue if not found.
 */
export function getTierColor(tier) {
    if (typeof tier !== 'string') return 0x5865F2;
    // Returns the hex color or the default Discord blue color if tier is unknown
    return TIER_COLOR_MAP[tier.toLowerCase()] || 0x5865F2; 
}
