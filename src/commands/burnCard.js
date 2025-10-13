const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const pool = require('../utils/mysql');

module.exports = {
    name: 'burnCard',
    description: 'Burn a card and give it to the bot.',
    async execute(message) {
        const args = message.content.split(' ');
        if (args.length < 2) return message.channel.send('Usage: !burnCard CARD_CODE');
        const cardCode = args[1].toUpperCase();

        const [rows] = await pool.execute(
            `SELECT p.*, c.rarity, c.name, c.series, c.image FROM prints p JOIN cards c ON p.card_id = c.id WHERE p.code = ? AND p.user_id = ?`,
            [cardCode, message.author.id]
        );
        if (rows.length === 0) return message.channel.send('You do not own that card.');

        const card = rows[0];
        const rarity = card.rarity;
        let coins = 0;
        if (rarity === 'N') coins = 75;
        else if (rarity === 'R') coins = 100;
        else if (rarity === 'SR') coins = 125;

        const embed = new EmbedBuilder()
            .setTitle('Burn Card Confirmation')
            .setThumbnail(card.image)
            .setDescription(
                `\`${card.code}\`  #${card.print_number}  ·  *${card.series}*  ·  ${card.name} ${card.rarity ? `[${card.rarity}]` : ''}\n\n` +
                `You will receive **${coins} coins** for burning this card.\n\nAre you sure?`
            )
            .setColor(0xE67E22);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('burn_accept')
                .setLabel('Accept')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('burn_decline')
                .setLabel('Decline')
                .setStyle(ButtonStyle.Danger)
        );

        const sentMsg = await message.channel.send({ embeds: [embed], components: [row] });

        const filter = i => i.user.id === message.author.id;
        const collector = sentMsg.createMessageComponentCollector({ filter, time: 30000, max: 1 });

        collector.on('collect', async interaction => {
            if (interaction.customId === 'burn_accept') {
                // Give coins to user
                await pool.execute(
                    'UPDATE user_inventory SET coins = coins + ? WHERE user_id = ?',
                    [coins, message.author.id]
                );

                // Transfer card to bot
                await pool.execute(
                    'UPDATE prints SET user_id = ? WHERE code = ?',
                    [process.env.BOT_USER_ID, cardCode]
                );

                await interaction.update({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('Card Burned')
                            .setThumbnail(card.image)
                            .setDescription(
                                `\`${card.code}\`  #${card.print_number}  ·  *${card.series}*  ·  ${card.name} ${card.rarity ? `[${card.rarity}]` : ''}\n\n` +
                                `You received **${coins} coins**.`
                            )
                            .setColor(0x2ecc71)
                    ],
                    components: []
                });
            } else {
                await interaction.update({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('Burn Cancelled')
                            .setDescription('No card was burned.')
                            .setColor(0x95a5a6)
                    ],
                    components: []
                });
            }
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                sentMsg.edit({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('Burn Cancelled')
                            .setDescription('No response received. No card was burned.')
                            .setColor(0x95a5a6)
                    ],
                    components: []
                }).catch(() => {});
            }
        });
    }
};