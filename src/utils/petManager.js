import { Pet } from '../models/index.js';

// Define available pets by tier. Each entry is an object containing the
// canonical species name and a lore description.
const COMMON_PETS = [
    { species: 'Karki', description: 'Crab Spirit' },
    { species: 'Cama', description: 'Bat Spirit' },
    { species: 'Kitsune', description: 'Fox Spirit' },
    { species: 'Lyca', description: 'Wolf Spirit' },
    { species: 'Tawa', description: 'Penguin Spirit' },
    // --- New Common Pets ---
    { species: 'Puff', description: 'Fluffy Cloud Spirit' },
    { species: 'Pebble', description: 'Tiny Stone Dweller' }
];

const UNCOMMON_PETS = [
    { species: 'Blink', description: 'Small Time-Bender' },
    { species: 'Glimmer', description: 'Fairy Moth' },
    { species: 'Sprite', description: 'Leaf Elemental' },
    { species: 'Gale', description: 'Air Whisperer' },
    // --- New Uncommon Pets ---
    { species: 'Shade', description: 'Whispering Shadow' },
    { species: 'Slime', description: 'Adaptive Goo Creature' }
];

const RARE_PETS = [
    { species: 'Dragon', description: 'Fire Spirit' },
    { species: 'Sylph', description: 'Wind Spirit' },
    { species: 'Mermaid', description: 'Water Spirit' },
    { species: 'Nymph', description: 'Forest Spirit' },
    // --- New Rare Pets ---
    { species: 'Wyvern', description: 'Lesser Dragon Kin' },
    { species: 'Golemite', description: 'Animated Clay Warrior' }
];

const EPIC_PETS = [
    { species: 'Phoenix', description: 'Sun Rebirth Bird' },
    { species: 'Leviathan', description: 'Deep Sea Guardian' },
    { species: 'Golem', description: 'Ancient Stone Shaper' },
    // --- New Epic Pets ---
    { species: 'Chronos', description: 'Momentary Time Guardian' },
    { species: 'Basilisk', description: 'Enchanted Gaze Serpent' }
];

// Legendary pets are currently unavailable for purchase; Dot is a unique
// pixie spirit reserved for special events.
const LEGENDARY_PETS = [
    { species: 'Dot', description: 'Pixie Spirit' }
];

/**
 * Returns a random pet definition from the supplied list.
 * @param {Array<{species:string, description:string}>} list
 */
function randomPet(list) {
    if (!list || list.length === 0) return { species: 'Unknown', description: 'A mysteriously empty spirit.' };
    return list[Math.floor(Math.random() * list.length)];
}

/**
 * Creates a new pet for the given user. The tier determines the species pool.
 * @param {string} userId
 * @param {'common'|'uncommon'|'rare'|'epic'|'legendary'} tier
 * @returns {Promise<import('../models/Pet.js').default>}
 */
export async function createPet(userId, tier = 'common') {
    let petDef;
    
    switch (tier.toLowerCase()) {
        case 'uncommon':
            petDef = randomPet(UNCOMMON_PETS);
            break;
        case 'rare':
            petDef = randomPet(RARE_PETS);
            break;
        case 'epic':
            petDef = randomPet(EPIC_PETS);
            break;
        case 'legendary':
            petDef = randomPet(LEGENDARY_PETS);
            break;
        case 'common':
        default:
            petDef = randomPet(COMMON_PETS);
            tier = 'common'; // Ensure tier is normalized
            break;
    }

    const pet = await Pet.create({
        owner_id: userId,
        species: petDef.species,
        tier,
        name: petDef.species,
        level: 1,
        acquired_at: new Date(),
        is_active: false
    });
    return pet;
}

/**
 * Increases the level of all active pets by a fraction so that they gain 1.1 levels per day. 
 * This is called on an hourly interval.
 */
export async function incrementActivePetLevels() {
    // 1.1 levels per day means 1.1 / 24 per hour
    const increment = 1.1 / 24;
    
    const activePets = await Pet.findAll({ where: { is_active: true } });
    
    for (const pet of activePets) {
        pet.level += increment;
        await pet.save();
    }
}

/**
 * Retrieves the single active pet for a given user.
 * @param {string} userId
 * @returns {Promise<import('../models/Pet.js').default | null>}
 */
export async function getUsersActivePet(userId) {
    return Pet.findOne({ where: { owner_id: userId, is_active: true } });
}

/**
 * Sets a specific pet as active for the user, deactivating all others.
 * @param {string} userId
 * @param {number} petId The ID of the pet to activate.
 * @returns {Promise<import('../models/Pet.js').default | null>} The activated pet, or null if not found/owned.
 */
export async function setActivePet(userId, petId) {
    // 1. Find the target pet and verify ownership
    const pet = await Pet.findOne({ where: { id: petId, owner_id: userId } });
    if (!pet) return null; 

    // 2. If it's already active, do nothing
    if (pet.is_active) return pet;

    // 3. Deactivate all other pets owned by the user
    await Pet.update(
        { is_active: false }, 
        { where: { owner_id: userId, is_active: true } }
    );
    
    // 4. Activate the target pet
    pet.is_active = true;
    await pet.save();
    
    return pet;
}

/**
 * Retrieves the lore text for a given species.
 * @param {string} species
 */
export function getPetLore(species) {
    const all = [...COMMON_PETS, ...UNCOMMON_PETS, ...RARE_PETS, ...EPIC_PETS, ...LEGENDARY_PETS];
    const pet = all.find((p) => p.species === species);
    if (!pet) return 'Unknown creature.';
    return `${pet.species} – ${pet.description}`;
}
