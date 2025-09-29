const { EmbedBuilder } = require('discord.js');
const pool = require('../utils/mysql');

// Map user input to DB column and rarity
const gemMap = {
    'n gem': { column: 'N_gems', rarity: 'N', label: 'N Gem' },
    'r gem': { column: 'R_gems', rarity: 'R', label: 'R Gem' },
    'sr gem': { column: 'SR_gems', rarity: 'SR', label: 'SR Gem' },
    'ur gem': { column: 'UR_gems', rarity: 'UR', label: 'UR Gem' },
    'lr gem': { column: 'LR_gems', rarity: 'LR', label: 'LR Gem' }
};

module.exports = {
    name: 'use',
    description: 'Use a gem from your inventory to get a card of that rarity. Usage: !use <n gem|r gem|sr gem|ur gem|lr gem>',
    async execute(message, args) {
        const gemType = args.slice(0, 2).join(' ').toLowerCase();
        if (!gemMap[gemType]) {
            return message.reply('Usage: !use <n gem|r gem|sr gem|ur gem|lr gem>');
        }
        const { column, rarity, label } = gemMap[gemType];

        // Check if user has the gem
        const [rows] = await pool.execute(
            `SELECT ${column} FROM user_inventory WHERE user_id = ?`,
            [message.author.id]
        );
        if (!rows.length || rows[0][column] < 1) {
            return message.reply(`You do not have any ${label}s to use.`);
        }

        // Get a random card of the correct rarity
        const [cards] = await pool.execute(
            'SELECT * FROM cards WHERE rarity = ? ORDER BY RAND() LIMIT 1',
            [rarity]
        );
        if (!cards.length) {
            return message.reply(`No cards available for rarity ${rarity}.`);
        }
        const card = cards[0];

        // Decrement gem count
        await pool.execute(
            `UPDATE user_inventory SET ${column} = ${column} - 1 WHERE user_id = ?`,
            [message.author.id]
        );

        // Add card to user's prints
        const [result] = await pool.execute(
            'SELECT MAX(print_number) AS max_print FROM prints WHERE card_id = ?',
            [card.id]
        );
        const nextPrint = (result[0].max_print || 0) + 1;
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();

        await pool.execute(
            'INSERT INTO prints (user_id, card_id, print_number, code) VALUES (?, ?, ?, ?)',
            [message.author.id, card.id, nextPrint, code]
        );

        // Show result
        const embed = new EmbedBuilder()
            .setTitle(`You used a ${label}!`)
            .setDescription(`You received **${card.name}** from **${card.series}**!\nPrint: #${nextPrint}\nCode: \`${code}\``)
            .setImage(card.image)
            .setColor(0xB39DDB);

        await message.channel.send({ embeds: [embed] });
    }
};