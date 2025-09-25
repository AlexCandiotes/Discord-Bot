const pool = require('../utils/mysql');

module.exports = {
    name: 'getCards',
    description: 'Shows all cards in the database.',
    async execute(message) {
        const sql = 'SELECT * FROM cards';
        const [rows] = await pool.execute(sql);
        if (rows.length > 0) {
            let reply = 'All cards:\n';
            rows.forEach((card, idx) => {
                reply += `\n**Card ${idx + 1}:**\n**Name:** ${card.name}\n**Series:** ${card.series}\n**Description:** ${card.description}\n**Rarity:** ${card.rarity || 'N/A'}\n`;
            });
            message.channel.send(reply);
        } else {
            message.channel.send('No cards found in the database.');
        }
    }
};