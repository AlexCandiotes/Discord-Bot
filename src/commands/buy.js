const { EmbedBuilder } = require('discord.js');
const pool = require('../utils/mysql');

module.exports = {
    name: 'buy',
    description: 'Buy an item from the shop.',
    async execute(message, args) {
        if (!args.length) {
            return message.reply('Usage: buy <halfcooldown|extrachance|dye|extradrop>');
        }

        const item = args[0].toLowerCase();
        const userId = message.author.id;

        // Fetch user inventory
        const [rows] = await pool.execute('SELECT * FROM user_inventory WHERE user_id = ?', [userId]);
        if (!rows.length) return message.reply('You do not have an inventory!');

        const inv = rows[0];
        let reply = '';
        let color = 0xFFD700;

        const quantity = parseInt(args[1]) > 0 ? parseInt(args[1]) : 1;

        if (item === 'halfcooldown') {
            const cost = 500 * quantity;
            if (inv.essence < cost) return message.reply(`You need ${cost} essence to buy Half Cooldown x${quantity}.`);
            await pool.execute(
                'UPDATE user_inventory SET essence = essence - ?, half_cooldown_until = ? WHERE user_id = ?',
                [cost, Date.now() + 30 * 24 * 60 * 60 * 1000, userId]
            );
            reply = `You bought **Half Cooldown** x${quantity}! Your drop cooldown is halved for 30 days.`;
        } else if (item === 'extrachance') {
            const cost = 500 * quantity;
            if (inv.essence < cost) return message.reply(`You need ${cost} essence to buy Chance to Drop Extra x${quantity}.`);
            await pool.execute(
                'UPDATE user_inventory SET essence = essence - ?, extra_drop_until = ? WHERE user_id = ?',
                [cost, Date.now() + 30 * 24 * 60 * 60 * 1000, userId]
            );
            reply = `You bought **Chance to Drop Extra** x${quantity}! You have a chance to drop an extra card for 30 days.`;
        } else if (item === 'dye') {
            const cost = 50 * quantity;
            if (inv.essence < cost) return message.reply(`You need ${cost} essence to buy Dye x${quantity}.`);
            await pool.execute(
                'UPDATE user_inventory SET essence = essence - ? WHERE user_id = ?',
                [cost, userId]
            );
            reply = `You bought **Dye** x${quantity}! Use it to change the color of your essence.`;
        } else if (item === 'extradrop') {
            if (inv.sphere < quantity) return message.reply(`You need ${quantity} sphere(s) to buy Extra Drop x${quantity}.`);
            await pool.execute(
                'UPDATE user_inventory SET sphere = sphere - ?, extra_drop_count = extra_drop_count + ? WHERE user_id = ?',
                [quantity, quantity, userId]
            );
            reply = `You bought **Extra Drop** x${quantity}! Use it to get extra drops instantly.`;
        } else {
            return message.reply('That item does not exist. Valid items: halfcooldown, extrachance, dye, extradrop');
        }

        const embed = new EmbedBuilder()
            .setTitle('Shop Purchase')
            .setDescription(reply)
            .setColor(color);

        await message.channel.send({ embeds: [embed] });
    }
};