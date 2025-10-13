const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const pool = require('../utils/mysql');

module.exports = {
    name: 'giftCard',
    description: 'Gift a card to another user.',
    async execute(message) {
        const args = message.content.split(' ');
        if (args.length < 3 || !message.mentions.users.size) {
            return message.channel.send('Usage: !giftCard CARD_CODE @recipient');
        }
        const cardCode = args[1].toUpperCase();
        const recipient = message.mentions.users.first();

        const [rows] = await pool.execute(
            'SELECT p.*, c.name, c.series, c.rarity, c.image FROM prints p JOIN cards c ON p.card_id = c.id WHERE p.code = ? AND p.user_id = ?',
            [cardCode, message.author.id]
        );
        if (rows.length === 0) return message.channel.send('You do not own that card.');

        const card = rows[0];

        const embed = new EmbedBuilder()
            .setTitle(`A gift from ${message.author.username}`)
            .setDescription(`Would you like to accept this gift ${recipient}?`)
            .setImage(card.card_image)
            .setColor(0x2ecc71);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('gift_approve')
                .setLabel('Approve')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('gift_decline')
                .setLabel('Decline')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('gift_cancel')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Secondary)
        );

        const sentMsg = await message.channel.send({ embeds: [embed], components: [row] });

        const filter = i =>
            i.user.id === recipient.id || i.user.id === message.author.id;
        const collector = sentMsg.createMessageComponentCollector({ filter, time: 60000 });

        let completed = false;

        collector.on('collect', async interaction => {
            if (interaction.customId === 'gift_approve') {
                if (interaction.user.id !== recipient.id) {
                    return interaction.reply({ content: 'Only the recipient can approve the gift.', ephemeral: true });
                }
                await pool.execute(
                    'UPDATE prints SET user_id = ? WHERE code = ?',
                    [recipient.id, cardCode]
                );
                completed = true;
                await interaction.update({
                    embeds: [embed.setDescription(`✅ ${recipient} accepted the gift from ${message.author}!`)],
                    components: []
                });
                await message.channel.send(`Card ${cardCode} has been gifted to ${recipient}.`);
                collector.stop();
            } else if (interaction.customId === 'gift_decline') {
                if (interaction.user.id !== recipient.id) {
                    return interaction.reply({ content: 'Only the recipient can decline the gift.', ephemeral: true });
                }
                completed = true;
                await interaction.update({
                    embeds: [embed.setDescription(`❌ ${recipient} declined the gift from ${message.author}.`)],
                    components: []
                });
                collector.stop();
            } else if (interaction.customId === 'gift_cancel') {
                if (interaction.user.id !== message.author.id) {
                    return interaction.reply({ content: 'Only the sender can cancel the gift.', ephemeral: true });
                }
                completed = true;
                await interaction.update({
                    embeds: [embed.setDescription(`🚫 ${message.author} cancelled the gift to ${recipient}.`)],
                    components: []
                });
                collector.stop();
            }
        });

        collector.on('end', async () => {
            if (!completed) {
                await sentMsg.edit({
                    embeds: [embed.setDescription('⏰ Gift timed out.')],
                    components: []
                });
            }
        });
    }
};