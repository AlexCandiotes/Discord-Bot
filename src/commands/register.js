const pool = require('../utils/mysql');

module.exports = {
    name: 'register',
    description: 'Register yourself to use the bot (creates your inventory and data).',
    async execute(message) {
        
        const [rows] = await pool.execute(
            'SELECT * FROM user_inventory WHERE user_id = ?',
            [message.author.id]
        );
        if (rows.length) {
            return message.reply('You are already registered!');
        }

        await pool.execute(
            `INSERT INTO user_inventory 
            (user_id, coins, essence, sphere, N_gems, R_gems, SR_gems, UR_gems, LR_gems, frames, private_inventory, private_collection)
            VALUES (?, 0, 0, 0, 0, 0, 0, 0, 0, '[]', 0, 0)`,
            [message.author.id]
        );

        await pool.execute(
            'INSERT IGNORE INTO drop_cooldowns (user_id, last_drop, notified, channel_id) VALUES (?, 0, 0, NULL)',
            [message.author.id]
        );

        return message.reply('Registration complete! You can now use all bot features.');
    }
};