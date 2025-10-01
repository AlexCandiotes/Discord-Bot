const { EmbedBuilder } = require('discord.js');
const pool = require('../utils/mysql');

module.exports = {
    name: 'lookup',
    description: 'Lookup cards by name or series. Usage: lookup name <name> OR lookup series <series>',
    async execute(message, args) {
        if (args.length < 2) {
            return message.reply('Usage: lookup name <name> OR lookup series <series>');
        }

        const type = args[0].toLowerCase();
        const search = args.slice(1).join(' ');

        let sql, params;
        if (type === 'name') {
            sql = 'SELECT * FROM cards WHERE name LIKE ? LIMIT 10';
            params = [`%${search}%`];
        } else if (type === 'series') {
            sql = 'SELECT * FROM cards WHERE series LIKE ? LIMIT 10';
            params = [`%${search}%`];
        } else {
            return message.reply('Usage: lookup name <name> OR lookup series <series>');
        }

        const [rows] = await pool.execute(sql, params);

        if (!rows.length) {
            return message.reply('No cards found.');
        }

        const embed = new EmbedBuilder()
            .setTitle('Card Lookup Results')
            .setColor(0x42A5F5)
            .setDescription(
                rows.map(card =>
                    `**${card.name}** [${card.rarity}] — *${card.series}*`
                ).join('\n')
            );

        await message.channel.send({ embeds: [embed] });
    }
};