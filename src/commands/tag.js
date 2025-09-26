const pool = require('../utils/mysql');
module.exports = {
    name: 'tag',
    description: 'Tag a card in your collection.',
    async execute(message) {
        const args = message.content.split(' ');
        if (args.length < 3) return message.channel.send('Usage: !tag cardCode tagName');
        const cardCode = args[1].toUpperCase();
        const tagName = args[2];
        await pool.execute(
            'INSERT INTO card_tags (user_id, card_code, tag_name) VALUES (?, ?, ?)',
            [message.author.id, cardCode, tagName]
        );
        message.channel.send(`Card ${cardCode} tagged with "${tagName}".`);
    }
};