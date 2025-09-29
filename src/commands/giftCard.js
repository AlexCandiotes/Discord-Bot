const pool = require('../utils/mysql');

module.exports = {
    name: 'giftCard',
    description: 'Gift a card to another user.',
    async execute(message) {
        const args = message.content.split(' ');
        if (args.length < 3 || !message.mentions.users.size) {
            return message.channel.send('Usage: !giftCard CARD_CODE @recipient');
        }
        const cardCode = args[1].toUpperCase();
        const recipient = message.mentions.users.first();

        const [rows] = await pool.execute(
            'SELECT * FROM prints WHERE code = ? AND user_id = ?',
            [cardCode, message.author.id]
        );
        if (rows.length === 0) return message.channel.send('You do not own that card.');

        await pool.execute(
            'UPDATE prints SET user_id = ? WHERE code = ?',
            [recipient.id, cardCode]
        );

        message.channel.send(`Card ${cardCode} has been gifted to ${recipient}.`);
    }
};