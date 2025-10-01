import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export default {
    // Only available to users with the Administrator permission
    data: new SlashCommandBuilder()
        .setName('twitch')
        .setDescription('[ADMIN] Manage Twitch stream monitoring settings.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

        // Subcommand 1: add
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Start monitoring a new Twitch channel for live announcements.')
                .addStringOption(option => 
                    option.setName('channel_name').setDescription('The exact Twitch username (e.g., "dotbotdev").').setRequired(true)
                )
        )

        // Subcommand 2: remove
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Stop monitoring an existing Twitch channel.')
                .addStringOption(option => 
                    option.setName('channel_name').setDescription('The Twitch username to stop monitoring.').setRequired(true)
                )
        )

        // Subcommand 3: status
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('View all currently monitored Twitch channels.')
        ),

    async execute(interaction) {
        // This is where the actual logic for handling the subcommands will go.
        // For now, it's just a placeholder to ensure the command registers.
        const subcommand = interaction.options.getSubcommand();
        
        await interaction.reply({ 
            content: `Twitch Manager: Executed subcommand \`${subcommand}\`. Logic still needs implementation!`, 
            ephemeral: true 
        });
    }
};
