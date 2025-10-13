const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const pool = require('../utils/mysql');

const paginationCache = {};

async function buildEmbed(card, index, total) {
    
    const [printRows] = await pool.execute(
        'SELECT MAX(print_number) AS maxPrint FROM prints WHERE card_id = ?',
        [card.id]
    );
    const maxPrint = printRows[0].maxPrint ?? 0;

    return new EmbedBuilder()
        .setTitle(`Character Lookup:`)
        .setDescription(
            `**ID:** ${card.id}\n` +
            `**Name:** ${card.name}\n` +
            `**Series:** ${card.series}\n` +
            `**Rarity:** ${card.rarity}\n` +
            `**Prints:** ${maxPrint}\n` +
            (card.print_number !== undefined ? `**Print:** #${card.print_number}\n` : '')
        )
        .setImage(card.image)
        .setColor(0x42A5F5)
        .setFooter({ text: `${index + 1} of ${total}` });
}

module.exports = {
    name: 'characterlookup',
    description: 'Lookup a character by name or card ID.',
    async execute(message, args) {
        if (!args.length) {
            return message.reply('Usage: characterlookup <name or id>');
        }

        const search = args.join(' ').trim();

        let cardRows;
        if (/^\d+$/.test(search)) {
            [cardRows] = await pool.execute('SELECT * FROM cards WHERE id = ?', [search]);
        } else {
            [cardRows] = await pool.execute('SELECT * FROM cards WHERE name LIKE ?', [`%${search}%`]);
        }

        if (!cardRows.length) {
            return message.reply('No character found.');
        }

        if (cardRows.length === 1) {
            const card = cardRows[0];
            const embed = await buildEmbed(card, 0, 1);
            return message.channel.send({ embeds: [embed] });
        }

        let page = 0;
        const total = cardRows.length;
        const cacheKey = `charlookup_${message.channel.id}_${message.author.id}_${Date.now()}`;
        paginationCache[cacheKey] = {
            cards: cardRows,
            page
        };

        const embed = await buildEmbed(cardRows[page], page, total);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('charlookup_prev')
                .setEmoji('⬅️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId('charlookup_next')
                .setEmoji('➡️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(total <= 1)
        );

        const sentMsg = await message.channel.send({ embeds: [embed], components: [row] });

        const collector = sentMsg.createMessageComponentCollector({
            filter: i => i.user.id === message.author.id,
            time: 120000
        });

        collector.on('collect', async interaction => {
            let cache = paginationCache[cacheKey];
            if (!cache) return interaction.reply({ content: 'Session expired.', ephemeral: true });

            if (interaction.customId === 'charlookup_prev') {
                if (cache.page > 0) cache.page--;
            } else if (interaction.customId === 'charlookup_next') {
                if (cache.page < cache.cards.length - 1) cache.page++;
            }

            const newEmbed = await buildEmbed(cache.cards[cache.page], cache.page, cache.cards.length);
            const newRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('charlookup_prev')
                    .setEmoji('⬅️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(cache.page === 0),
                new ButtonBuilder()
                    .setCustomId('charlookup_next')
                    .setEmoji('➡️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(cache.page === cache.cards.length - 1)
            );
            await interaction.update({ embeds: [newEmbed], components: [newRow] });
        });

        collector.on('end', () => {
            delete paginationCache[cacheKey];
            sentMsg.edit({ components: [] }).catch(() => {});
        });
    }
};