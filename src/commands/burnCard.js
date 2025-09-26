const pool = require('../utils/mysql');

module.exports = {
    name: 'burnCard',
    description: 'Burn a card and give it to the bot.',
    async execute(message) {
        const args = message.content.split(' ');
        if (args.length < 2) return message.channel.send('Usage: !burnCard CARD_CODE');
        const cardCode = args[1].toUpperCase();

        const [rows] = await pool.execute(
            'SELECT * FROM prints WHERE code = ? AND user_id = ?',
            [cardCode, message.author.id]
        );
        if (rows.length === 0) return message.channel.send('You do not own that card.');
        
        await pool.execute(
            'UPDATE prints SET user_id = ? WHERE code = ?',
            [process.env.BOT_USER_ID, cardCode]
        );

        message.channel.send(`Card ${cardCode} has been burned and given to the bot.`);
    }
};