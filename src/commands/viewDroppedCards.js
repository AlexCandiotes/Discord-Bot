const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const pool = require('../utils/mysql');

const rarityIcons = {
    SR: '🌟',
    R: '🔷',
    N: '⬜',
    default: '⬜'
};

// In-memory cache for pagination (per user, per channel)
const paginationCache = {};

function getPage(cards, page, pageSize) {
    const start = page * pageSize;
    return cards.slice(start, start + pageSize);
}

function buildEmbed(cards, page, pageSize, total, userId, userTag) {
    const pageCards = getPage(cards, page, pageSize);
    let collectionLines = pageCards.map(card => {
        const icon = card.emoji || rarityIcons[card.rarity] || rarityIcons.default;
        return `${icon} \`${card.code}\`  #${card.print_number}  ·  *${card.series}*  ·  ${card.name} ${card.rarity ? `[${card.rarity}]` : ''}`;
    });

    return new EmbedBuilder()
        .setColor(0x5DADE2)
        .setTitle(`🌈 Card Collection`)
        .setDescription(`Cards owned by <@${userId}> (${userTag})\n\n` + (collectionLines.join('\n') || '*No cards on this page.*'))
        .setFooter({ text: `✨ Page ${page + 1} of ${Math.ceil(total / pageSize)} • Use arrows to scroll pages!` });
}

module.exports = {
    name: 'viewDroppedCards',
    description: 'Shows all cards you have dropped. Supports filtering by -series, -name, -rarity, -print, or -tag. You can also view another user\'s collection by mention or user ID.',
    async execute(message) {
        const args = message.content.split(' ');

        // --- User parsing: mention, user ID, or self ---
        let user = message.mentions.users.first();
        if (!user && args[1] && /^\d{17,19}$/.test(args[1])) {
            try {
                user = await message.client.users.fetch(args[1]);
            } catch {
                return message.channel.send('User not found.');
            }
        }
        if (!user) user = message.author;
        const targetUserId = user.id;
        const targetUserTag = user.tag;

        // Privacy check
        const [invRows] = await pool.execute('SELECT private_collection FROM user_inventory WHERE user_id = ?', [targetUserId]);
        if (targetUserId !== message.author.id && invRows.length && invRows[0].private_collection) {
            return message.channel.send('This user\'s collection is private.');
        }

        let sql, params;

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
            `;
            params = [targetUserId, tagName];
        } else {
            let filterSql = '';
            let filterValue = '';

            if (args.includes('-series') || args.includes('-s')) {
                const idx = args.indexOf('-series') !== -1 ? args.indexOf('-series') : args.indexOf('-s');
                filterSql = 'AND c.series LIKE ?';
                filterValue = `%${args.slice(idx + 1).join(' ')}%`;
            } else if (args.includes('-character')|| args.includes('-c')) {
                const idx = args.indexOf('-character') !== -1 ? args.indexOf('-character') : args.indexOf('-c');
                filterSql = 'AND c.name LIKE ?';
                filterValue = `%${args.slice(idx + 1).join(' ')}%`;
            } else if (args.includes('-rarity') || args.includes('-r')) {
                const idx = args.indexOf('-rarity') !== -1 ? args.indexOf('-rarity') : args.indexOf('-r');
                filterSql = 'AND c.rarity = ?';
                filterValue = args[idx + 1];
            } else if (args.some(arg => arg.startsWith('-print') || arg.startsWith('-p'))) {
                const printArg = args.find(arg => arg.startsWith('-print') || arg.startsWith('-p'));
                const match = printArg.match(/-(?:print|p)([=<>])(\d+)/);
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
            `;
            params = filterSql ? [targetUserId, filterValue] : [targetUserId];
        }

        const [rows] = await pool.execute(sql, params);

        if (!rows.length) {
            return message.channel.send('No cards found with that filter.');
        }

        // Pagination setup
        const pageSize = 10;
        let page = 0;
        const total = rows.length;

        // Store in cache for this user/channel
        const cacheKey = `${message.channel.id}_${message.author.id}`;
        paginationCache[cacheKey] = {
            cards: rows,
            page,
            pageSize,
            userId: targetUserId,
            userTag: targetUserTag
        };

        // Build first embed
        const embed = buildEmbed(rows, page, pageSize, total, targetUserId, targetUserTag);

        // Buttons
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('prev_page')
                .setEmoji('⬅️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId('next_page')
                .setEmoji('➡️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(total <= pageSize)
        );

        const sentMsg = await message.channel.send({ embeds: [embed], components: [row] });

        // Collector for button interactions
        const collector = sentMsg.createMessageComponentCollector({
            filter: i => i.user.id === message.author.id,
            time: 120000
        });

        collector.on('collect', async interaction => {
            let cache = paginationCache[cacheKey];
            if (!cache) return interaction.reply({ content: 'Session expired.', ephemeral: true });

            if (interaction.customId === 'prev_page') {
                if (cache.page > 0) cache.page--;
            } else if (interaction.customId === 'next_page') {
                if ((cache.page + 1) * cache.pageSize < cache.cards.length) cache.page++;
            }

            // Update embed and buttons
            const newEmbed = buildEmbed(cache.cards, cache.page, cache.pageSize, cache.cards.length, cache.userId, cache.userTag);
            const newRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('prev_page')
                    .setEmoji('⬅️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(cache.page === 0),
                new ButtonBuilder()
                    .setCustomId('next_page')
                    .setEmoji('➡️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled((cache.page + 1) * cache.pageSize >= cache.cards.length)
            );
            await interaction.update({ embeds: [newEmbed], components: [newRow] });
        });

        collector.on('end', () => {
            delete paginationCache[cacheKey];
            sentMsg.edit({ components: [] }).catch(() => {});
        });
    },
};