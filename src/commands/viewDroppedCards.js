const { EmbedBuilder } = require('discord.js');
const pool = require('../utils/mysql');

const rarityIcons = {
    SR: '🌟',
    R: '🔷',
    N: '⬜',
    default: '⬜'
};

module.exports = {
    name: 'viewDroppedCards',
    description: 'Shows all cards you have dropped.',
    async execute(message) {
        const sql = `
            SELECT p.print_number, p.code, c.name, c.series, c.rarity
            FROM prints p
            JOIN cards c ON p.card_id = c.id
            WHERE p.user_id = ?
            ORDER BY p.obtained_at DESC
            LIMIT 10
        `;
        const [rows] = await pool.execute(sql, [message.author.id]);
        if (rows.length > 0) {
            let collectionLines = rows.map(card => {
                const icon = rarityIcons[card.rarity] || rarityIcons.default;
                return `${icon} \`${card.code}\`  #${card.print_number}  ·  *${card.series}*  ·  ${card.name} ${card.rarity ? `[${card.rarity}]` : ''}`;
            });

            const embed = new EmbedBuilder()
                .setColor(0x5DADE2)
                .setTitle(`🌈 ${message.author.username}'s Card Showcase`)
                .setDescription(collectionLines.join('\n'))
                .setFooter({ text: '✨ Showing your latest 10 cards • Use arrows to scroll pages!' });

            await message.channel.send({ embeds: [embed] });
        } else {
            message.channel.send('You have not dropped any cards yet.');
        }
    },
};