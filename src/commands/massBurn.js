const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const pool = require('../utils/mysql');

module.exports = {
    name: 'massburn',
    description: 'Burn multiple cards by code or by tag and receive coins for each.',
    async execute(message, args) {
        if (!args.length) {
            return message.channel.send('Usage: !massburn <CARD_CODE1> <CARD_CODE2> ... | !massburn -tag <TAG_NAME>');
        }

        let cardCodes = [];
        let cardsToBurn = [];
        let totalCoins = 0;
        let coinMap = { N: 75, R: 100, SR: 125 };

        // Burn by tag
        if (args[0] === '-tag' && args[1]) {
            const tagName = args[1];
            // Get all card codes with this tag for the user
            const [taggedRows] = await pool.execute(
                `SELECT p.code, c.name, c.series, c.rarity, p.print_number
                FROM prints p
                JOIN cards c ON p.card_id = c.id
                JOIN card_tags t ON t.card_code = p.code
                WHERE t.tag_name = ? AND p.user_id = ?`,
                [tagName, message.author.id]
            );
            if (!taggedRows.length) {
                return message.channel.send(`No cards found with tag "${tagName}".`);
            }
            cardsToBurn = taggedRows.map(row => ({
                code: row.code,
                name: row.name,
                series: row.series,
                rarity: row.rarity,
                print_number: row.print_number
            }));
        } else {
            // Burn by card codes
            cardCodes = args.map(code => code.toUpperCase());
            if (!cardCodes.length) {
                return message.channel.send('No card codes provided.');
            }
            // Get all cards the user owns with those codes
            const [rows] = await pool.execute(
                `SELECT p.code, c.name, c.series, c.rarity, p.print_number
                 FROM prints p
                 JOIN cards c ON p.card_id = c.id
                 WHERE p.code IN (${cardCodes.map(() => '?').join(',')}) AND p.user_id = ?`,
                [...cardCodes, message.author.id]
            );
            if (!rows.length) {
                return message.channel.send('You do not own any of those cards.');
            }
            cardsToBurn = rows.map(row => ({
                code: row.code,
                name: row.name,
                series: row.series,
                rarity: row.rarity,
                print_number: row.print_number
            }));
        }

        if (!cardsToBurn.length) {
            return message.channel.send('No cards to burn.');
        }

        // Calculate total coins
        for (const card of cardsToBurn) {
            totalCoins += coinMap[card.rarity] || 0;
        }

        // Pagination setup
        const pageSize = 10;
        let page = 0;
        const totalPages = Math.ceil(cardsToBurn.length / pageSize);

        function buildEmbed(page) {
            const start = page * pageSize;
            const end = start + pageSize;
            const cards = cardsToBurn.slice(start, end);

            const embed = new EmbedBuilder()
                .setTitle('Confirm Mass Burn')
                .setDescription(
                    cards.map(card =>
                        `\`${card.code}\`  #${card.print_number}  ·  *${card.series}*  ·  ${card.name} ${card.rarity ? `[${card.rarity}]` : ''}`
                    ).join('\n')
                )
                .setFooter({ text: `Page ${page + 1} of ${totalPages} | Total coins: ${totalCoins}` })
                .setColor(0xE67E22);

            return embed;
        }

        function buildRow(page) {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('massburn_prev')
                    .setLabel('Previous')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page === 0),
                new ButtonBuilder()
                    .setCustomId('massburn_next')
                    .setLabel('Next')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page === totalPages - 1),
                new ButtonBuilder()
                    .setCustomId('massburn_accept')
                    .setLabel('Accept')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('massburn_decline')
                    .setLabel('Decline')
                    .setStyle(ButtonStyle.Danger)
            );
        }

        const embed = buildEmbed(page);
        const row = buildRow(page);

        const sentMsg = await message.channel.send({ embeds: [embed], components: [row] });

        const filter = i => i.user.id === message.author.id;
        const collector = sentMsg.createMessageComponentCollector({ filter, time: 60000 });

        collector.on('collect', async interaction => {
            if (interaction.customId === 'massburn_prev') {
                page--;
                await interaction.update({ embeds: [buildEmbed(page)], components: [buildRow(page)] });
            } else if (interaction.customId === 'massburn_next') {
                page++;
                await interaction.update({ embeds: [buildEmbed(page)], components: [buildRow(page)] });
            } else if (interaction.customId === 'massburn_accept') {
                // Give coins to user
                await pool.execute(
                    'UPDATE user_inventory SET coins = coins + ? WHERE user_id = ?',
                    [totalCoins, message.author.id]
                );
                // Transfer cards to bot
                const botId = message.client.user.id;
                for (const card of cardsToBurn) {
                    await pool.execute(
                        'UPDATE prints SET user_id = ? WHERE code = ?',
                        [botId, card.code]
                    );
                }
                await interaction.update({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('Mass Burn Complete')
                            .setDescription(
                                `Burned cards: [${cardsToBurn.map(c => c.code).join(', ')}]\nYou received ${totalCoins} coins.`
                            )
                            .setColor(0x2ecc71)
                    ],
                    components: []
                });
                collector.stop();
            } else if (interaction.customId === 'massburn_decline') {
                await interaction.update({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('Mass Burn Cancelled')
                            .setDescription('No cards were burned.')
                            .setColor(0x95a5a6)
                    ],
                    components: []
                });
                collector.stop();
            }
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                sentMsg.edit({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('Mass Burn Cancelled')
                            .setDescription('No response received. No cards were burned.')
                            .setColor(0x95a5a6)
                    ],
                    components: []
                }).catch(() => {});
            }
        });
    }
};