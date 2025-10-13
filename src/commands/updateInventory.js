const pool = require('../utils/mysql');

module.exports = {
    name: 'updateinventory',
    description: 'Update a user\'s inventory (admin only)',
    async execute(message, args) {
        if (message.author.id !== '941763497623187518') {
            return message.reply('Only the bot owner can use this command.');
        }

        const user = message.mentions.users.first();
        if (!user) return message.reply('Please mention a user.');

        let mode = 'set';
        let startIdx = 1;
        if (args[1] && args[1].toLowerCase() === 'add') {
            mode = 'add';
            startIdx = 2;
        }

        let coins, N_gems, R_gems, SR_gems, UR_gems, LR_gems, frames;
        let sphere, essence, half_cooldown_until, extra_drop_until, extra_drop_count;
        for (let i = startIdx; i < args.length; i += 2) {
            const key = args[i]?.toLowerCase();
            const value = args[i + 1];
            if (!value) continue;
            if (key === 'coins') coins = parseInt(value);
            if (key === 'n_gems') N_gems = parseInt(value);
            if (key === 'r_gems') R_gems = parseInt(value);
            if (key === 'sr_gems') SR_gems = parseInt(value);
            if (key === 'ur_gems') UR_gems = parseInt(value);
            if (key === 'lr_gems') LR_gems = parseInt(value);
            if (key === 'frames') frames = value.split(',').map(f => f.trim()).filter(f => f);
            if (key === 'sphere') sphere = parseInt(value);
            if (key === 'essence') essence = parseInt(value);
            if (key === 'half_cooldown_until') half_cooldown_until = parseInt(value);
            if (key === 'extra_drop_until') extra_drop_until = parseInt(value);
            if (key === 'extra_drop_count') extra_drop_count = parseInt(value);
        }

        const [rows] = await pool.execute('SELECT * FROM user_inventory WHERE user_id = ?', [user.id]);
        let inv = rows[0] || {
            user_id: user.id, coins: 0, N_gems: 0, R_gems: 0, SR_gems: 0, UR_gems: 0, LR_gems: 0,
            frames: '[]', sphere: 0, essence: 0, half_cooldown_until: 0, extra_drop_until: 0, extra_drop_count: 0
        };

        if (mode === 'add') {
            if (coins !== undefined) inv.coins += coins;
            if (N_gems !== undefined) inv.N_gems += N_gems;
            if (R_gems !== undefined) inv.R_gems += R_gems;
            if (SR_gems !== undefined) inv.SR_gems += SR_gems;
            if (UR_gems !== undefined) inv.UR_gems += UR_gems;
            if (LR_gems !== undefined) inv.LR_gems += LR_gems;
            if (sphere !== undefined) inv.sphere += sphere;
            if (essence !== undefined) inv.essence += essence;
            if (half_cooldown_until !== undefined) inv.half_cooldown_until += half_cooldown_until;
            if (extra_drop_until !== undefined) inv.extra_drop_until += extra_drop_until;
            if (extra_drop_count !== undefined) inv.extra_drop_count += extra_drop_count;
            if (frames !== undefined) {
                let currentFrames = [];
                try { currentFrames = JSON.parse(inv.frames); } catch { currentFrames = []; }
                inv.frames = JSON.stringify([...currentFrames, ...frames]);
            }
        } else {
            if (coins !== undefined) inv.coins = coins;
            if (N_gems !== undefined) inv.N_gems = N_gems;
            if (R_gems !== undefined) inv.R_gems = R_gems;
            if (SR_gems !== undefined) inv.SR_gems = SR_gems;
            if (UR_gems !== undefined) inv.UR_gems = UR_gems;
            if (LR_gems !== undefined) inv.LR_gems = LR_gems;
            if (sphere !== undefined) inv.sphere = sphere;
            if (essence !== undefined) inv.essence = essence;
            if (half_cooldown_until !== undefined) inv.half_cooldown_until = half_cooldown_until;
            if (extra_drop_until !== undefined) inv.extra_drop_until = extra_drop_until;
            if (extra_drop_count !== undefined) inv.extra_drop_count = extra_drop_count;
            if (frames !== undefined) inv.frames = JSON.stringify(frames);
        }

        await pool.execute(
            `REPLACE INTO user_inventory 
            (user_id, coins, N_gems, R_gems, SR_gems, UR_gems, LR_gems, frames, sphere, essence, half_cooldown_until, extra_drop_until, extra_drop_count) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                user.id, inv.coins, inv.N_gems, inv.R_gems, inv.SR_gems, inv.UR_gems, inv.LR_gems,
                inv.frames, inv.sphere, inv.essence, inv.half_cooldown_until, inv.extra_drop_until, inv.extra_drop_count
            ]
        );

        message.reply(`Inventory updated for <@${user.id}>.`);
    }
};