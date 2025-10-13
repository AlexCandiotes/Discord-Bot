const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const pool = require('../utils/mysql');

module.exports = {
    name: 'inventory',
    description: 'Show your inventory with pages for gems, frames, coins/hearts',
    async execute(message, args) {
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
            } else if (page === 2) {
                return new EmbedBuilder()
                    .setTitle(`${user.username}'s Currency`)
                    .addFields(
                        { name: 'Coins', value: `${inv.coins}`, inline: true },
                        { name: 'Sphere', value: `${inv.sphere}`, inline: true },
                        { name: 'Essence', value: `${inv.essence}`, inline: true }
                    )
                    .setColor(0xFFD700);
            }
            else if (page === 3) {
                return new EmbedBuilder()
                    .setTitle(`${user.username}'s Boosts and Items`)
                    .addFields(
                        { name: 'Half Cooldown', value: inv.half_cooldown_until > Date.now() ? `<t:${Math.floor(inv.half_cooldown_until/1000)}:R>` : 'Inactive', inline: false },
                        { name: 'Chance to Drop Extra', value: inv.extra_drop_until > Date.now() ? `<t:${Math.floor(inv.extra_drop_until/1000)}:R>` : 'Inactive', inline: false },
                        { name: 'Extra Drops', value: `${inv.extra_drop_count || 0}`, inline: false }
                    )
                    .setColor(0x00bcd4);
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
                    .setDisabled(page === 2),
                new ButtonBuilder()
                    .setCustomId('boosts')
                    .setLabel('Boosts')
                    .setStyle(page === 3 ? ButtonStyle.Primary : ButtonStyle.Secondary)
                    .setDisabled(page === 3),
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
            if (interaction.customId === 'boosts') page = 3;
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