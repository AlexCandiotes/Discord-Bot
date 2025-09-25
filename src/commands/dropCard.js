const { EmbedBuilder } = require('discord.js');
const { getRandomCards } = require('../utils/randomGenerator');
const pool = require('../utils/mysql');

function generateCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

const emojiNumbers = ['1️⃣', '2️⃣', '3️⃣'];

module.exports = {
    name: 'dropCard',
    description: 'Drop 3 cards and pick 1.',
    async execute(message) {
        const cards = await getRandomCards(3);
        if (cards && cards.length === 3) {
            let description = `React with 1️⃣, 2️⃣, or 3️⃣ to pick your card!\n\n`;
            cards.forEach((card, idx) => {
                description += `${emojiNumbers[idx]} **${card.name}** (${card.series})\n`;
            });

            const embed = new EmbedBuilder()
                .setTitle('Choose Your Card!')
                .setDescription(description)
                .setColor(0xB39DDB)
                .setImage(cards[0].image);

            const sent = await message.channel.send({ embeds: [embed] });

            for (const emoji of emojiNumbers) {
                await sent.react(emoji);
            }

            const filter = (reaction, user) =>
                emojiNumbers.includes(reaction.emoji.name) &&
                user.id === message.author.id &&
                !user.bot;
            try {
                const collected = await sent.awaitReactions({ filter, max: 1, time: 30000, errors: ['time'] });
                const reaction = collected.first();
                const pickedIdx = emojiNumbers.indexOf(reaction.emoji.name);
                const pickedCard = cards[pickedIdx];

                const [result] = await pool.execute(
                    'SELECT MAX(print_number) AS max_print FROM prints WHERE card_id = ?',
                    [pickedCard.id]
                );
                const nextPrint = (result[0].max_print || 0) + 1;
                const code = generateCode();

                await pool.execute(
                    'INSERT INTO prints (user_id, card_id, print_number, code) VALUES (?, ?, ?, ?)',
                    [message.author.id, pickedCard.id, nextPrint, code]
                );

                await sent.reactions.removeAll().catch(() => {});

                const resultEmbed = new EmbedBuilder()
                    .setTitle('You picked:')
                    .setDescription(`**${pickedCard.name}** from **${pickedCard.series}**\nPrint: #${nextPrint}\nCode: ${code}`)
                    .setImage(pickedCard.image)
                    .setColor(0xB39DDB);

                await message.channel.send({ embeds: [resultEmbed] });
            } catch (err) {
                await sent.reactions.removeAll().catch(() => {});
                await message.channel.send('You did not pick a card in time!');
            }
        } else {
            message.channel.send('Sorry, not enough cards available to drop.');
        }
    },
};