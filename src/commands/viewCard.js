const { EmbedBuilder } = require('discord.js');
const pool = require('../utils/mysql');

module.exports = {
    name: 'viewCard',
    description: 'View a card by its code.',
    async execute(message) {
        const args = message.content.split(' ');
        if (args.length < 2) {
            return message.channel.send('Please provide a card code. Usage: `!viewCard CODE`');
        }
        const code = args[1].toUpperCase();

        const sql = `
            SELECT p.print_number, p.code, c.name, c.series, c.rarity, c.image, c.description
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
            `**Owned by:** <@${message.author.id}>\n` +
            `**Series:** ${card.series}\n**Print:** #${card.print_number}\n**Code:** ${card.code}\n\n${card.description || ''}`
        )
        .setImage(card.image)
        .setColor(0x42A5F5);

        await message.channel.send({ embeds: [embed] });
    }
};