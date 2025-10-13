const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const pool = require('../utils/mysql');

const paginationCache = {};

function getPage(cards, page, pageSize) {
    const start = page * pageSize;
    return cards.slice(start, start + pageSize);
}

function buildEmbed(cards, page, pageSize, total, searchType, searchValue) {
    const pageCards = getPage(cards, page, pageSize);
    return new EmbedBuilder()
        .setTitle('Card Lookup Results')
        .setColor(0x42A5F5)
        .setDescription(
            (pageCards.length
                ? pageCards.map(card =>
                    `\`${card.id}\` — **${card.name}** \`${card.rarity}\` — *${card.series}*`
                ).join('\n')
                : '*No cards on this page.*')
        )
        .setFooter({ text: `🔎 ${searchType}: ${searchValue} | Page ${page + 1} of ${Math.ceil(total / pageSize)}` });
}

module.exports = {
    name: 'lookup',
    description: 'Lookup cards by name or series. Usage: lookup name <name> OR lookup series <series>',
    async execute(message, args) {
        if (!args.length) {
            return message.reply('Usage: lookup <name or series>');
        }

        const search = args.join(' ');

        const sql = 'SELECT * FROM cards WHERE name LIKE ? OR series LIKE ?';
        const params = [`%${search}%`, `%${search}%`];

        const [rows] = await pool.execute(sql, params);

        if (!rows.length) {
            return message.reply('No cards found.');
        }

        const pageSize = 10;
        let page = 0;
        const total = rows.length;

        const cacheKey = `lookup_${message.channel.id}_${message.author.id}`;
        paginationCache[cacheKey] = {
            cards: rows,
            page,
            pageSize,
            searchValue: search
        };

        const embed = buildEmbed(rows, page, pageSize, total, 'search', search);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('lookup_prev_page')
                .setEmoji('⬅️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId('lookup_next_page')
                .setEmoji('➡️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(total <= pageSize)
        );

        const sentMsg = await message.channel.send({ embeds: [embed], components: [row] });

        const collector = sentMsg.createMessageComponentCollector({
            filter: i => i.user.id === message.author.id,
            time: 120000
        });

        collector.on('collect', async interaction => {
            let cache = paginationCache[cacheKey];
            if (!cache) return interaction.reply({ content: 'Session expired.', ephemeral: true });

            if (interaction.customId === 'lookup_prev_page') {
                if (cache.page > 0) cache.page--;
            } else if (interaction.customId === 'lookup_next_page') {
                if ((cache.page + 1) * cache.pageSize < cache.cards.length) cache.page++;
            }

            const newEmbed = buildEmbed(cache.cards, cache.page, cache.pageSize, cache.cards.length, 'search', cache.searchValue);
            const newRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('lookup_prev_page')
                    .setEmoji('⬅️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(cache.page === 0),
                new ButtonBuilder()
                    .setCustomId('lookup_next_page')
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
    }
};