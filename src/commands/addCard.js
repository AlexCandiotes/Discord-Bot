const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const pool = require('../utils/mysql');

module.exports = {
    name: 'addcard',
    description: 'Admin: Add one or more cards. Usage: addcard "Name" "Series" "ImageURL" [Rarity] ...',
    async execute(message, args) {
        if (message.author.id !== '941763497623187518') {
            return message.reply('Only the bot owner can use this command.');
        }

        // Match all sets of "Name" "Series" "ImageURL" [Rarity]
        const regex = /"([^"]+)"\s+"([^"]+)"\s+"([^"]+)"(?:\s+(\w+))?/g;
        const matches = [...message.content.matchAll(regex)];

        if (!matches.length) {
            return message.reply('Usage: addcard "Name" "Series" "ImageURL" [Rarity] ...');
        }

        const channelId = '1424462286357139516'; // Replace with your channel ID
        const channel = await message.client.channels.fetch(channelId);

        let replyMsg = '';
        for (const match of matches) {
            const [, name, series, image, rarity] = match;
            try {
                const sql = 'INSERT INTO cards (name, series, image, rarity) VALUES (?, ?, ?, ?)';
                const [result] = await pool.execute(sql, [
                    name,
                    series,
                    image,
                    rarity || null
                ]);

                replyMsg += `✅ Card added: ${name} [${result.insertId}]\n`;

                const embed = new EmbedBuilder()
                    .setTitle(`${name} · (${result.insertId})`)
                    .setThumbnail(image)
                    .setDescription(
                        `**Series:** ${series}\n` +
                        `**Rarity:** ${rarity || 'N/A'}\n`
                    )
                    .setColor(0x3498db);

                await channel.send({ embeds: [embed] });
            } catch (err) {
                console.error(err);
                replyMsg += `❌ Error adding card: ${name}\n`;
            }
        }

        await message.reply(replyMsg.trim());
    }
};