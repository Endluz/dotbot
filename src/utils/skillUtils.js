// src/utils/skillUtils.js

const TIME_REDUCTION_PER_LEVEL_PERCENT = 0.5; // 0.5% per level

export function calculateWaitTime(durationMinutes, forgeLevel) {
    const reductionPercent = (forgeLevel - 1) * TIME_REDUCTION_PER_LEVEL_PERCENT;
    const actualWaitMinutes = durationMinutes * (1 - reductionPercent / 100);

    return {
        actualWaitMinutes: Math.max(1, actualWaitMinutes), 
        reductionPercent: reductionPercent.toFixed(1)
    };
}

export function calculateForgeXP(durationMinutes) {
    // Simple XP calculation: 10 XP per committed hour
    return Math.floor(durationMinutes / 60) * 10;
}

export function awardXPAndCheckLevelUp(user, xpGained, skillType = 'forge') {
    // For simplicity, we grant 1 level per 500 XP chunk earned
    const currentLevel = user[`${skillType}_level`];
    
    // Use a simple threshold for demonstration
    const XP_PER_LEVEL_UP = 500; 
    const levelsGained = Math.floor(xpGained / XP_PER_LEVEL_UP);
    const newLevel = currentLevel + levelsGained;

    if (newLevel > currentLevel) {
        user[`${skillType}_level`] = newLevel;
        // NOTE: If you had an XP column, you would also update that here:
        // user[`${skillType}_xp`] = user[`${skillType}_xp`] % XP_PER_LEVEL_UP;
        return `🎉 **${skillType.toUpperCase()} Level Up!** You are now level **${newLevel}**!`;
    }
    return null;
}