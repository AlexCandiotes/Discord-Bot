const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const pool = require('../utils/mysql');

module.exports = {
    name: 'inventory',
    description: 'Show your inventory with pages for gems, frames, coins/hearts',
    async execute(message, args) {
        // Parse user: mention or user ID, fallback to self
        let user = message.mentions.users.first();
        if (!user && args[0] && /^\d{17,19}$/.test(args[0])) {
            try {
                user = await message.client.users.fetch(args[0]);
            } catch {
                return message.channel.send('User not found.');
            }
        }
        if (!user) user = message.author;

        const [rows] = await pool.execute('SELECT * FROM user_inventory WHERE user_id = ?', [user.id]);
        if (!rows.length) {
            return message.channel.send(`${user.username} has no items in their inventory!`);
        }
        const inv = rows[0];

        // Privacy check
        if (user.id !== message.author.id && inv.private_inventory) {
            return message.channel.send('This user\'s inventory is private.');
        }

        let frames = [];
        try {
            frames = JSON.parse(inv.frames);
            if (!Array.isArray(frames)) frames = [];
        } catch {
            frames = [];
        }

        function getEmbed(page) {
            if (page === 0) {
                return new EmbedBuilder()
                    .setTitle(`${user.username}'s Gems`)
                    .addFields(
                        { name: 'N Gems', value: `${inv.N_gems}`, inline: true },
                        { name: 'R Gems', value: `${inv.R_gems}`, inline: true },
                        { name: 'SR Gems', value: `${inv.SR_gems}`, inline: true },
                        { name: 'UR Gems', value: `${inv.UR_gems}`, inline: true },
                        { name: 'LR Gems', value: `${inv.LR_gems}`, inline: true }
                    )
                    .setColor(0x42A5F5);
            } else if (page === 1) {
                return new EmbedBuilder()
                    .setTitle(`${user.username}'s Frames`)
                    .addFields(
                        { name: 'Frames', value: frames.length ? frames.join(', ') : 'None', inline: false }
                    )
                    .setColor(0xAB47BC);
            } else {
                return new EmbedBuilder()
                    .setTitle(`${user.username}'s Currency`)
                    .addFields(
                        { name: 'Coins', value: `${inv.coins}`, inline: true },
                        { name: 'Hearts', value: `${inv.hearts}`, inline: true }
                    )
                    .setColor(0xFFD700);
            }
        }

        function getRow(page) {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('gems')
                    .setLabel('Gems')
                    .setStyle(page === 0 ? ButtonStyle.Primary : ButtonStyle.Secondary)
                    .setDisabled(page === 0),
                new ButtonBuilder()
                    .setCustomId('frames')
                    .setLabel('Frames')
                    .setStyle(page === 1 ? ButtonStyle.Primary : ButtonStyle.Secondary)
                    .setDisabled(page === 1),
                new ButtonBuilder()
                    .setCustomId('currency')
                    .setLabel('Currency')
                    .setStyle(page === 2 ? ButtonStyle.Primary : ButtonStyle.Secondary)
                    .setDisabled(page === 2)
            );
        }

        let page = 0;

        const sentMsg = await message.channel.send({
            embeds: [getEmbed(page)],
            components: [getRow(page)]
        });

        const filter = i => i.user.id === message.author.id;
        const collector = sentMsg.createMessageComponentCollector({ filter, time: 120000 });

        collector.on('collect', async interaction => {
            if (interaction.customId === 'gems') page = 0;
            if (interaction.customId === 'frames') page = 1;
            if (interaction.customId === 'currency') page = 2;
            await interaction.update({
                embeds: [getEmbed(page)],
                components: [getRow(page)]
            });
        });

        collector.on('end', () => {
            sentMsg.edit({ components: [] }).catch(() => {});
        });

        return sentMsg;
    }
};