const { EmbedBuilder } = require('discord.js');
const pool = require('../utils/mysql');

module.exports = {
    name: 'viewcard',
    async execute(message, args) {
        let code = args[0];
        let print;

        if (!code) {

            const [rows] = await pool.execute(
                `SELECT p.*, c.name AS card_name, c.series AS card_series
                 FROM prints p
                 JOIN cards c ON p.card_id = c.id
                 WHERE p.user_id = ?
                 ORDER BY p.obtained_at DESC LIMIT 1`,
                [message.author.id]
            );
            print = rows[0];
            if (!print) {
                return message.reply('You do not have any cards.');
            }
        } else {
            const [rows] = await pool.execute(
                `SELECT p.*, c.name AS card_name, c.series AS card_series
                 FROM prints p
                 JOIN cards c ON p.card_id = c.id
                 WHERE p.code = ?`,
                [code]
            );
            print = rows[0];
            if (!print) {
                return message.reply('Card not found.');
            }
        }

        if (print.card_image) {
            const embed = new EmbedBuilder()
                .setTitle('Card View')
                .setDescription(
                    `**Name:** ${print.card_name}\n` +
                    `**Series:** ${print.card_series}\n` +
                    `**Print:** #${print.print_number}\n` +
                    `**Code:** ${print.code}\n` +
                    `**Owned by:** <@${print.user_id}>`
                )
                .setImage(print.card_image);
            await message.channel.send({ embeds: [embed] });
        } else {
            await message.channel.send('Card image not found.');
        }
    }
};