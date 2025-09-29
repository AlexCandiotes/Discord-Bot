const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const pool = require('../utils/mysql');

module.exports = {
    name: 'inventoryprivacy',
    description: 'Set your inventory privacy (private/unprivate)',
    async execute(message) {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('set_private')
                .setLabel('Private')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('set_unprivate')
                .setLabel('Unprivate')
                .setStyle(ButtonStyle.Success)
        );

        const sentMsg = await message.channel.send({
            content: 'Choose your inventory privacy setting:',
            components: [row]
        });

        const filter = i => i.user.id === message.author.id;
        const collector = sentMsg.createMessageComponentCollector({ filter, max: 1, time: 30000 });

        collector.on('collect', async interaction => {
            let value, mode;
            if (interaction.customId === 'set_private') {
                value = 1;
                mode = 'private';
            } else {
                value = 0;
                mode = 'unprivate';
            }
            await pool.execute(
                'INSERT INTO user_inventory (user_id, private_inventory) VALUES (?, ?) ON DUPLICATE KEY UPDATE private_inventory = ?',
                [message.author.id, value, value]
            );
            await interaction.update({
                content: `Your inventory is now ${mode}.`,
                components: []
            });
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                sentMsg.edit({ content: 'No option selected. Privacy unchanged.', components: [] });
            }
        });
    }
};