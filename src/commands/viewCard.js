const { EmbedBuilder } = require('discord.js');
const pool = require('../utils/mysql');

module.exports = {
    name: 'viewCard',
    description: 'View a card by its code, or your most recent card if no code is given.',
    async execute(message) {
        const args = message.content.split(' ');
        let code = null;

        if (args.length < 2) {
            // No code provided: get the most recent card for the user
            const sql = `
                SELECT p.user_id, p.print_number, p.code, c.name, c.series, c.rarity, c.image
                FROM prints p
                JOIN cards c ON p.card_id = c.id
                WHERE p.user_id = ?
                ORDER BY p.obtained_at DESC, p.id DESC
                LIMIT 1
            `;
            const [rows] = await pool.execute(sql, [message.author.id]);
            if (rows.length === 0) {
                return message.channel.send('You do not own any cards yet.');
            }
            const card = rows[0];
            const embed = new EmbedBuilder()
                .setTitle(`${card.name} [${card.rarity || 'N'}]`)
                .setDescription(
                    `**Owned by:** <@${card.user_id}>\n` +
                    `**Series:** ${card.series}\n**Print:** #${card.print_number}\n**Code:** ${card.code}`
                )
                .setImage(card.image)
                .setColor(0x42A5F5);

            await message.channel.send({ embeds: [embed] });
            return;
        }

        // Code provided: show that card
        code = args[1].toUpperCase();

        const sql = `
            SELECT p.user_id, p.print_number, p.code, c.name, c.series, c.rarity, c.image
            FROM prints p
            JOIN cards c ON p.card_id = c.id
            WHERE p.code = ?
            LIMIT 1
        `;
        const [rows] = await pool.execute(sql, [code]);
        if (rows.length === 0) {
            return message.channel.send('Card not found.');
        }
        const card = rows[0];
        const embed = new EmbedBuilder()
            .setTitle(`${card.name} [${card.rarity || 'N'}]`)
            .setDescription(
                `**Owned by:** <@${card.user_id}>\n` +
                `**Series:** ${card.series}\n**Print:** #${card.print_number}\n**Code:** ${card.code}`
            )
            .setImage(card.image)
            .setColor(0x42A5F5);

        await message.channel.send({ embeds: [embed] });
    }
};