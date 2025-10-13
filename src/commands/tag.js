const pool = require('../utils/mysql');
module.exports = {
    name: 'tag',
    description: 'Tag one or more cards in your collection.',
    async execute(message) {
        const args = message.content.split(' ');
        if (args.length < 3) return message.channel.send('Usage: !tag cardCode1 [cardCode2 ...] tagName');
        const tagName = args[args.length - 1];
        const cardCodes = args.slice(1, -1).map(code => code.toUpperCase());

        let tagged = [];
        let failed = [];

        for (const cardCode of cardCodes) {
            // Optionally, check if the user owns the card before tagging
            const [rows] = await pool.execute(
                'SELECT 1 FROM prints WHERE code = ? AND user_id = ?',
                [cardCode, message.author.id]
            );
            if (rows.length) {
                await pool.execute(
                    'INSERT INTO card_tags (user_id, card_code, tag_name) VALUES (?, ?, ?)',
                    [message.author.id, cardCode, tagName]
                );
                tagged.push(cardCode);
            } else {
                failed.push(cardCode);
            }
        }

        let reply = '';
        if (tagged.length) reply += `Tagged card(s) [${tagged.join(', ')}] with "${tagName}".\n`;
        if (failed.length) reply += `You do not own: [${failed.join(', ')}]`;
        message.channel.send(reply.trim());
    }
};