import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import { config as dotenvConfig } from 'dotenv';
import { sequelize } from './models/index.js';
import { setupTwitchMonitoring } from './utils/twitchAuth.js';
import config from './config.js';
import fs from 'fs';
import path from 'path';

// Load environment variables from .env if present
dotenvConfig();

// --- DB PRAGMA UTILITIES ---

/**
 * Enforces or disables foreign key constraints on the SQLite database.
 * @param {boolean} enable Set to true to enable, false to disable.
 */
async function setForeignKeys(enable) {
    const state = enable ? 'ON' : 'OFF';
    try {
        await sequelize.query(`PRAGMA foreign_keys = ${state}`);
        console.log(`✅ Foreign key constraints turned ${state}.`);
    } catch (e) {
        console.warn(`⚠️ Failed to set foreign keys to ${state}:`, e.message);
    }
}

/**
 * Enforce FKs and create helpful indexes. This should be run AFTER sync.
 */
async function enforceDbConstraints(sequelize) {
    // ENHANCEMENT: Removed PRAGMA call here as it's now in setForeignKeys
    try {
        await sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_useritems_unique ON UserItems(user_id, item_id)');
        // Unique index for active pet, ensuring only one pet can be active per owner
        await sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_pet ON Pets(owner_id) WHERE is_active = 1');
    } catch (e) {
        console.warn('Index setup warning:', e?.message || e);
    }
}

// Create a Discord client with necessary intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ],
    partials: [Partials.Channel]
});

client.commands = new Collection();

async function registerCommandsAndEvents() {
    const appDir = path.resolve();

    // Commands
    const commandsPath = path.join(appDir, 'src', 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

    for (const file of commandFiles) {
        const { default: command } = await import(`./commands/${file}`);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        } else {
            console.warn(`⚠️ Command in ${file} missing required properties.`);
        }
    }

    // Events
    const eventsPath = path.join(appDir, 'src', 'events');
    const eventFiles = fs.readdirSync(eventsPath).filter((file) => file.endsWith('.js'));

    for (const file of eventFiles) {
        const { default: event } = await import(`./events/${file}`);
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args));
        } else {
            client.on(event.name, (...args) => event.execute(...args));
        }
    }
}

async function initDatabase() {
    console.log('--- Database Initialization ---');

    // 1) Disable FKs during sync
    await setForeignKeys(false); 

    // 2) Backup Users (deduplicated by user_id)
    try {
        // ENHANCEMENT: Cleaner deduplication SQL
        await sequelize.query(`
            DROP TABLE IF EXISTS Users_backup;
            CREATE TABLE Users_backup AS
            SELECT * FROM Users
            WHERE rowid IN (
                SELECT MAX(rowid)
                FROM Users
                GROUP BY user_id
            );
        `);
        console.log('✅ Created Users_backup with unique user_id entries.');
    } catch (e) {
        // This is not a fatal error, just a warning if the Users table doesn't exist yet
        console.warn('⚠️ User backup/deduplication skipped (table likely empty or new).');
    }

    // 3) Sync schema (non-destructive where possible)
    try {
        await sequelize.sync({ alter: true });
        console.log('✅ Synced database schema (alter mode).');
    } catch (e) {
        console.error('❌ sequelize.sync(alter) failed. Falling back to plain sync:', e);
        try {
            await sequelize.sync();
            console.log('✅ Synced database schema (plain).');
        } catch (syncError) {
            console.error('❌ FATAL: sequelize.sync failed completely:', syncError);
            throw new Error('Database synchronization failed.');
        }
    }

    // 4) Re‑enable FKs and ensure helpful indexes
    await setForeignKeys(true);
    await enforceDbConstraints(sequelize);
    console.log('✅ Database setup complete.');
    console.log('-----------------------------');
}

client.on('ready', async () => {
    try {
        // DB first
        await initDatabase();

        // Register slash commands
        const commandsArray = client.commands.map((cmd) => cmd.data.toJSON());
        if (config.guildId) {
            const guild = await client.guilds.fetch(config.guildId);
            await guild.commands.set(commandsArray);
            console.log(`✅ Registered ${commandsArray.length} guild commands in ${guild.name}.`);
        } else {
            await client.application.commands.set(commandsArray);
            console.log(`✅ Registered ${commandsArray.length} global commands.`);
        }

        // Start Twitch monitoring
        await setupTwitchMonitoring(client, config);
    } catch (error) {
        console.error('❌ Error during startup:', error);
        // ENHANCEMENT: Exit process on critical startup failure
        process.exit(1); 
    }
}); // <-- This is the missing brace for client.on('ready', ...)

// Initialize bot
registerCommandsAndEvents()
    .then(() => client.login(process.env.BOT_TOKEN || config.token))
    .catch((err) => {
        console.error('❌ FATAL Initialization error (Login failed or modules failed to load):', err);
        process.exit(1);
    });