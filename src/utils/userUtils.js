import { User, Pet, UserItem } from '../models/index.js'; // ENHANCEMENT: Import associated models

/**
 * Fetches a User record by ID, creating one if it does not exist. All
 * interactions that modify currency or inventory should call this helper.
 * @param {string} userId Discord user ID
 * @returns {Promise<import('../models/User.js').default>} Promise resolving with the User instance
 */
export async function getOrCreateUser(userId) {
    const [user] = await User.findOrCreate({ where: { user_id: userId } });
    return user;
}

// --- NEW UTILITY ---

/**
 * Fetches the User record along with their entire inventory (Pets and Items).
 * This is efficient for commands that display the user's status or inventory.
 * @param {string} userId Discord user ID
 * @returns {Promise<import('../models/User.js').default | null>} Promise resolving with the User instance including inventory associations.
 */
export async function getUsersInventory(userId) {
    // ENHANCEMENT: Use "include" to load associated data in one query (eager loading)
    const user = await User.findOne({
        where: { user_id: userId },
        include: [
            {
                model: Pet,
                as: 'pets',
                // Optional: Order pets for consistent inventory display
                order: [
                    ['is_active', 'DESC'],
                    ['tier', 'ASC'],
                    ['level', 'DESC'],
                ],
            },
            {
                model: UserItem,
                as: 'items',
                // Optional: Filter out items with quantity 0 and group by name
                where: {
                    quantity: {
                        [UserItem.sequelize.Sequelize.Op.gt]: 0 // quantity > 0
                    }
                },
                required: false // Keep the user record even if they have no items
            },
        ],
    });

    return user;
}
```eof

