const pool = require('../utils/mysql');

module.exports = {
    name: 'givecard',
    description: 'Give one or more cards from the bot to a user by their user ID. Usage: givecard <user_id> <card_code1> <card_code2> ...',
    async execute(message, args) {
        if (message.author.id !== '941763497623187518') {
            return message.reply('Only the bot owner can use this command.');
        }

        const [userId, ...cardCodes] = args;
        if (!userId || cardCodes.length === 0) {
            return message.reply('Usage: givecard <user_id> <card_code1> <card_code2> ...');
        }

        const botId = message.client.user.id;
        let given = [];
        let notFound = [];

        for (const code of cardCodes) {
            const [rows] = await pool.execute(
                'SELECT * FROM prints WHERE code = ? AND user_id = ?',
                [code, botId]
            );
            if (rows.length) {
                await pool.execute(
                    'UPDATE prints SET user_id = ? WHERE code = ?',
                    [userId, code]
                );
                given.push(code);
            } else {
                notFound.push(code);
            }
        }

        let reply = `Gave cards [${given.join(', ')}] to user ${userId}.`;
        if (notFound.length) {
            reply += `\nCould not find or not owned by bot: [${notFound.join(', ')}]`;
        }

        await message.channel.send(reply);
    }
};