const pool = require('../utils/mysql');

module.exports = {
    name: 'addprintzero',
    description: 'Admin: Add a print 0 card to a user. Usage: addprintzero <user_id> <card_id>',
    async execute(message, args) {
        // Admin check
        if (message.author.id !== '941763497623187518') {
            return message.reply('Only the bot owner can use this command.');
        }

        const userId = args[0];
        const cardId = args[1];

        if (!userId || !cardId) {
            return message.reply('Usage: addprintzero <user_id> <card_id>');
        }

        // Generate a random 6-character code
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();

        await pool.execute(
            'INSERT INTO prints (user_id, card_id, print_number, code) VALUES (?, ?, 0, ?)',
            [userId, cardId, code]
        );

        return message.reply(`Print 0 card added for user ${userId}, card ${cardId}, code ${code}`);
    }
};