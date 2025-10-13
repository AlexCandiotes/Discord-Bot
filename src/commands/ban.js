const pool = require('../utils/mysql');

module.exports = {
    name: 'ban',
    description: 'Ban a user: transfer all their cards/inventory to the bot and block their access.',
    async execute(message, args) {

        if (message.author.id !== '941763497623187518') {
            return message.reply('Only the bot owner can use this command.');
        }

        const userId = args[0]?.replace(/[<@!>]/g, '');
        if (!userId) {
            return message.reply('Please mention a user or provide their user ID.');
        }

        const botId = message.client.user.id;

        await pool.execute(
            'UPDATE prints SET user_id = ? WHERE user_id = ?',
            [botId, userId]
        );

        const [userInvRows] = await pool.execute('SELECT * FROM user_inventory WHERE user_id = ?', [userId]);
        if (userInvRows.length) {
            const userInv = userInvRows[0];
            const [botInvRows] = await pool.execute('SELECT * FROM user_inventory WHERE user_id = ?', [botId]);
            if (botInvRows.length) {
                let botFrames = botInvRows[0].frames || '';
                let userFrames = userInv.frames || '';
                let mergedFrames;
                if (botFrames && userFrames) {
                    const set = new Set([...botFrames.split(','), ...userFrames.split(',')].filter(f => f));
                    mergedFrames = Array.from(set).join(',');
                } else {
                    mergedFrames = botFrames || userFrames;
                }

                await pool.execute(
                    `UPDATE user_inventory SET 
                        coins = coins + ?, hearts = hearts + ?, N_gems = N_gems + ?, R_gems = R_gems + ?, 
                        SR_gems = SR_gems + ?, UR_gems = UR_gems + ?, LR_gems = LR_gems + ?, frames = ?
                     WHERE user_id = ?`,
                    [
                        userInv.coins, userInv.hearts, userInv.N_gems, userInv.R_gems,
                        userInv.SR_gems, userInv.UR_gems, userInv.LR_gems, mergedFrames, botId
                    ]
                );
            } else {
                await pool.execute(
                    `INSERT INTO user_inventory 
                        (user_id, coins, hearts, N_gems, R_gems, SR_gems, UR_gems, LR_gems, frames) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        botId, userInv.coins, userInv.hearts, userInv.N_gems, userInv.R_gems,
                        userInv.SR_gems, userInv.UR_gems, userInv.LR_gems, userInv.frames
                    ]
                );
            }
            await pool.execute('DELETE FROM user_inventory WHERE user_id = ?', [userId]);
        }

        await pool.execute(
            'INSERT IGNORE INTO banned_users (user_id) VALUES (?)',
            [userId]
        );

        return message.reply(`${userId} has been banned.`);
    }
};