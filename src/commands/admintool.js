import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export default {
    // Only available to users with the Administrator permission
    data: new SlashCommandBuilder()
        .setName('admintool')
        .setDescription('[ADMIN] Access various administrative utilities.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        
        // Subcommand 1: force_sync (for development/debugging)
        .addSubcommand(subcommand =>
            subcommand
                .setName('force_sync')
                .setDescription('[ADMIN] Force a manual database sync (USE CAREFULLY).')
        )
        
        // Subcommand 2: reset_user (for moderation/cleanup)
        .addSubcommand(subcommand =>
            subcommand
                .setName('reset_user')
                .setDescription('[ADMIN] Completely reset a user\'s currency and inventory.')
                .addUserOption(option => 
                    option.setName('target').setDescription('The user to reset.').setRequired(true)
                )
        ),
    
    async execute(interaction) {
        // This is where the actual logic for handling the subcommands will go.
        // For now, it's just a placeholder to ensure the command registers.
        const subcommand = interaction.options.getSubcommand();
        
        await interaction.reply({ 
            content: `Admin Tool: Executed subcommand \`${subcommand}\`. Logic still needs implementation!`, 
            ephemeral: true 
        });
    }
};
