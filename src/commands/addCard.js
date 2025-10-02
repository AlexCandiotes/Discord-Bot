const pool = require('../utils/mysql');

module.exports = {
    name: 'addcard',
    description: 'Admin: Add a new card to the database. Usage: addcard "Name" "Series" "ImageURL" [Rarity]',
    async execute(message, args) {

        if (message.author.id !== '941763497623187518') {
            return message.reply('Only the bot owner can use this command.');
        }

        // Expect: addcard "Name" "Series" "ImageURL" [Rarity]
        if (args.length < 3) {
            return message.reply('Usage: addcard "Name" "Series" "ImageURL" [Rarity]');
        }

        // Support quoted arguments for names/series with spaces
        const matches = message.content.match(/"([^"]+)"\s+"([^"]+)"\s+"([^"]+)"(?:\s+(\w+))?/);
        if (!matches) {
            return message.reply('Usage: addcard "Name" "Series" "ImageURL" [Rarity]');
        }

        const [, name, series, image, rarity] = matches;

        try {
            const sql = 'INSERT INTO cards (name, series, image, rarity) VALUES (?, ?, ?, ?)';
            const [result] = await pool.execute(sql, [
                name,
                series,
                image,
                rarity || null
            ]);
            return message.reply(`✅ Card added with ID: ${result.insertId}`);
        } catch (err) {
            console.error(err);
            return message.reply('❌ Error adding card.');
        }
    }
};