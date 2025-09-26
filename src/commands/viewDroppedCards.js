const { EmbedBuilder } = require('discord.js');
const pool = require('../utils/mysql');

const rarityIcons = {
    SR: '🌟',
    R: '🔷',
    N: '⬜',
    default: '⬜'
};

module.exports = {
    name: 'viewDroppedCards',
    description: 'Shows all cards you have dropped. Supports filtering by -series, -name, -rarity, -print, or -tag. You can also view another user\'s collection by mention or user ID.',
    async execute(message) {
        const args = message.content.split(' ');
        let sql, params;

        // Get target user (default to message author)
        let targetUserId = message.author.id;
        let targetUserTag = message.author.tag;
        const userMention = message.mentions.users.first();
        if (userMention) {
            targetUserId = userMention.id;
            targetUserTag = userMention.tag;
        } else {
            // Check for user ID in args
            const userIdArg = args.find(arg => /^\d{17,19}$/.test(arg));
            if (userIdArg) {
                targetUserId = userIdArg;
                const userObj = await message.client.users.fetch(userIdArg).catch(() => null);
                if (userObj) targetUserTag = userObj.tag;
            }
        }

        // Check for -tag argument
        const tagIndex = args.indexOf('-tag');
        if (tagIndex !== -1 && args[tagIndex + 1]) {
            const tagName = args[tagIndex + 1];
            sql = `
                SELECT ct.card_code AS code, c.name, c.series, c.rarity, p.print_number, ut.emoji
                FROM card_tags ct
                JOIN prints p ON ct.card_code = p.code AND ct.user_id = p.user_id
                JOIN cards c ON p.card_id = c.id
                LEFT JOIN user_tags ut ON ut.user_id = ct.user_id AND ut.tag_name = ct.tag_name
                WHERE ct.user_id = ? AND ct.tag_name = ?
                ORDER BY p.obtained_at DESC
                LIMIT 10
            `;
            params = [targetUserId, tagName];
        } else {
            let filterSql = '';
            let filterValue = '';

            if (args.includes('-series')) {
                const idx = args.indexOf('-series');
                filterSql = 'AND c.series LIKE ?';
                filterValue = `%${args.slice(idx + 1).join(' ')}%`;
            } else if (args.includes('-name')) {
                const idx = args.indexOf('-name');
                filterSql = 'AND c.name LIKE ?';
                filterValue = `%${args.slice(idx + 1).join(' ')}%`;
            } else if (args.includes('-rarity')) {
                const idx = args.indexOf('-rarity');
                filterSql = 'AND c.rarity = ?';
                filterValue = args[idx + 1];
            } else if (args.some(arg => arg.startsWith('-print'))) {
                const printArg = args.find(arg => arg.startsWith('-print'));
                const match = printArg.match(/-print([=<>])(\d+)/);
                if (match) {
                    const operator = match[1];
                    const value = match[2];
                    filterSql = `AND p.print_number ${operator} ?`;
                    filterValue = value;
                }
            }

            sql = `
                SELECT p.print_number, p.code, c.name, c.series, c.rarity
                FROM prints p
                JOIN cards c ON p.card_id = c.id
                WHERE p.user_id = ?
                ${filterSql}
                ORDER BY p.obtained_at DESC
                LIMIT 10
            `;
            params = filterSql ? [targetUserId, filterValue] : [targetUserId];
        }

        const [rows] = await pool.execute(sql, params);

        if (rows.length > 0) {
            let collectionLines = rows.map(card => {
                const icon = card.emoji || rarityIcons[card.rarity] || rarityIcons.default;
                return `${icon} \`${card.code}\`  #${card.print_number}  ·  *${card.series}*  ·  ${card.name} ${card.rarity ? `[${card.rarity}]` : ''}`;
            });

            const embed = new EmbedBuilder()
                .setColor(0x5DADE2)
                .setTitle(`🌈 Card Collection`)
                .setDescription(`Cards owned by <@${targetUserId}> (${targetUserTag})\n\n` + collectionLines.join('\n'))
                .setFooter({ text: '✨ Showing your latest 10 cards • Use arrows to scroll pages!' });

            await message.channel.send({ embeds: [embed] });
        } else {
            message.channel.send('No cards found with that filter.');
        }
    },
};