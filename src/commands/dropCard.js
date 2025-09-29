const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const path = require('path');
const pool = require('../utils/mysql');

const rarityRates = { N: 50, R: 30, SR: 15, UR: 4 };
const rarityImages = {
    N: path.join(__dirname, '../../images/gems/N_gem.png'),
    R: path.join(__dirname, '../../images/gems/R_gem.png'),
    SR: path.join(__dirname, '../../images/gems/SR_gem.png'),
    UR: path.join(__dirname, '../../images/gems/UR_gem.png'),
};
const gemAnimationGif = path.join(__dirname, '../../images/gems/gem.gif');
const DROP_INTERVAL = 10 * 60 * 1000;

function getRandomRarity() {
    const rand = Math.random() * 100;
    let sum = 0;
    for (const [rarity, rate] of Object.entries(rarityRates)) {
        sum += rate;
        if (rand < sum) return rarity;
    }
    return 'N';
}

async function getRandomCardByRarity(rarity) {
    const sql = 'SELECT * FROM cards WHERE rarity = ? ORDER BY RAND() LIMIT 1';
    const [rows] = await pool.execute(sql, [rarity]);
    return rows[0];
}

function generateCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

module.exports = {
    name: 'dropCard',
    description: 'Drop a card and open the gem to reveal it.',
    async execute(message) {
        const userId = message.author.id;
        const now = Date.now();

        const [rows] = await pool.execute(
            'SELECT last_drop FROM drop_cooldowns WHERE user_id = ?',
            [userId]
        );
        const lastDrop = rows.length ? Number(rows[0].last_drop) : null;

        if (lastDrop && now - lastDrop < DROP_INTERVAL) {
            const nextDropTimestamp = Math.floor((lastDrop + DROP_INTERVAL) / 1000);
            const remaining = DROP_INTERVAL - (now - lastDrop);
            const minutes = Math.ceil(remaining / 60000);
            return message.channel.send(
                `You must wait ${minutes} minute${minutes !== 1 ? 's' : ''} to drop again, <@${userId}>. (<t:${nextDropTimestamp}:R>)`
            );
        }

        await pool.execute(
            'REPLACE INTO drop_cooldowns (user_id, last_drop, notified, channel_id) VALUES (?, ?, 0, ?)',
            [userId, now, message.channel.id]
        );

        const rarity = getRandomRarity();
        const droppedCard = await getRandomCardByRarity(rarity);

        if (!droppedCard) {
            return message.channel.send('Sorry, no cards available for that rarity.');
        }

        const embed = new EmbedBuilder()
        .setTitle(`${message.author.username}'s Drop`)
        .setDescription('You found a gem! It shimmers mysteriously...')
        .setImage('attachment://gem.gif')
        .setColor(0xB39DDB)

        const sentMsg = await message.channel.send({
            embeds: [embed],
            files: [{ attachment: gemAnimationGif, name: 'gem.gif' }]
        });

        setTimeout(async () => {
            const gemEmbed = new EmbedBuilder()
            .setTitle(`${message.author.username}'s Drop`)
            .setDescription('The gem shimmers with energy. What will you do?')
            .setImage('attachment://gem.png')
            .setColor(0xB39DDB);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('open_gem')
                    .setLabel('Open Gem')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('store_gem')
                    .setLabel('Store Gem')
                    .setStyle(ButtonStyle.Secondary)
            );

            await sentMsg.edit({
                embeds: [gemEmbed],
                files: [{ attachment: rarityImages[rarity], name: 'gem.png' }],
                components: [row]
            });

            const collector = sentMsg.createMessageComponentCollector({
                filter: i => i.user.id === message.author.id,
                max: 1,
                time: 30000
            });

            collector.on('collect', async interaction => {
                if (interaction.customId === 'open_gem') {
                    const [result] = await pool.execute(
                        'SELECT MAX(print_number) AS max_print FROM prints WHERE card_id = ?',
                        [droppedCard.id]
                    );
                    const nextPrint = (result[0].max_print || 0) + 1;
                    const code = generateCode();

                    await pool.execute(
                        'INSERT INTO prints (user_id, card_id, print_number, code) VALUES (?, ?, ?, ?)',
                        [message.author.id, droppedCard.id, nextPrint, code]
                    );

                    const resultEmbed = new EmbedBuilder()
                        .setTitle(`${message.author.username} opened the gem!`)
                        .setDescription(`**${droppedCard.name}** from **${droppedCard.series}**\nPrint: #${nextPrint}\nCode: ${code}`)
                        .setImage(droppedCard.image)
                        .setColor(0xB39DDB);

                    await interaction.update({ embeds: [resultEmbed], files: [], components: [] });
                } else if (interaction.customId === 'store_gem') {
                    const column = `${rarity}_gems`;
                    await pool.execute(
                        `UPDATE user_inventory SET ${column} = ${column} + 1 WHERE user_id = ?`,
                        [message.author.id]
                    );

                    const storeEmbed = new EmbedBuilder()
                        .setTitle('Gem Stored!')
                        .setDescription(`${message.author.username} stored a **${rarity}** gem in your inventory.`)
                        .setColor(0x42A5F5);

                    await interaction.update({ embeds: [storeEmbed], files: [], components: [] });
                }
            });

            collector.on('end', collected => {
                if (collected.size === 0) {
                    sentMsg.edit({ content: 'You did not choose in time!', components: [] });
                }
            });
        }, 3000);
    },

    async droptimer(message) {
        const userId = message.author.id;
        const now = Date.now();

        const [rows] = await pool.execute(
            'SELECT last_drop FROM drop_cooldowns WHERE user_id = ?',
            [userId]
        );
        const lastDrop = rows.length ? Number(rows[0].last_drop) : null;

        if (!lastDrop || now - lastDrop >= DROP_INTERVAL) {
            return message.channel.send('✅ You can drop a card now!');
        } else {
            const nextDropTimestamp = Math.floor((lastDrop + DROP_INTERVAL) / 1000);
            return message.channel.send(
                `You must wait ${Math.ceil((DROP_INTERVAL - (now - lastDrop)) / 60000)} minutes to drop again, <@${userId}>.`
            );
        }
    },

    DROP_INTERVAL
};