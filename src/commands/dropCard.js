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
const DROP_INTERVAL = 10 * 60 * 1000; // 10 minutes

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

        // Get last drop from DB
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

        // Set cooldown in DB and reset notified, store channel_id
        await pool.execute(
            'REPLACE INTO drop_cooldowns (user_id, last_drop, notified, channel_id) VALUES (?, ?, 0, ?)',
            [userId, now, message.channel.id]
        );

        const rarity = getRandomRarity();
        const droppedCard = await getRandomCardByRarity(rarity);

        if (!droppedCard) {
            return message.channel.send('Sorry, no cards available for that rarity.');
        }

        // 1. Send initial embed with gem GIF as attachment
        const embed = new EmbedBuilder()
            .setTitle('A mysterious gem appears...')
            .setImage('attachment://gem.gif')
            .setColor(0xB39DDB);

        const sentMsg = await message.channel.send({
            embeds: [embed],
            files: [{ attachment: gemAnimationGif, name: 'gem.gif' }]
        });

        // 2. After 3 seconds, edit embed to show gem image and add button
        setTimeout(async () => {
            const gemEmbed = new EmbedBuilder()
                .setTitle('A mysterious gem appears...')
                .setImage('attachment://gem.png')
                .setColor(0xB39DDB);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('open_gem')
                    .setLabel('Open Gem')
                    .setStyle(ButtonStyle.Primary)
            );

            await sentMsg.edit({
                embeds: [gemEmbed],
                files: [{ attachment: rarityImages[rarity], name: 'gem.png' }],
                components: [row]
            });

            // 3. Wait for button interaction
            const collector = sentMsg.createMessageComponentCollector({
                filter: i => i.user.id === message.author.id,
                max: 1,
                time: 30000
            });

            collector.on('collect', async interaction => {
                // Insert print record
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

                // 4. Edit embed to show card details and card image
                const resultEmbed = new EmbedBuilder()
                    .setTitle('You opened the gem!')
                    .setDescription(`**${droppedCard.name}** from **${droppedCard.series}**\nPrint: #${nextPrint}\nCode: ${code}`)
                    .setImage(droppedCard.image)
                    .setColor(0xB39DDB);

                await interaction.update({ embeds: [resultEmbed], files: [], components: [] });
            });

            collector.on('end', collected => {
                if (collected.size === 0) {
                    sentMsg.edit({ content: 'You did not open the gem in time!', components: [] });
                }
            });
        }, 3000);
    },

    // Drop timer command
    async droptimer(message) {
        const userId = message.author.id;
        const now = Date.now();

        // Get last drop from DB
        const [rows] = await pool.execute(
            'SELECT last_drop FROM drop_cooldowns WHERE user_id = ?',
            [userId]
        );
        const lastDrop = rows.length ? Number(rows[0].last_drop) : null;

        let embed;
        if (!lastDrop || now - lastDrop >= DROP_INTERVAL) {
            embed = new EmbedBuilder()
                .setTitle('Cooldowns')
                .setDescription('Your current cooldowns are:\n\n**Drop Cooldown**\nYou can drop a card now!')
                .setColor(0x42A5F5);
        } else {
            const nextDropTimestamp = Math.floor((lastDrop + DROP_INTERVAL) / 1000);
            embed = new EmbedBuilder()
                .setTitle('Cooldowns')
                .setDescription(
                    `Your current cooldowns are:\n\n**Drop Cooldown**\n<t:${nextDropTimestamp}:R> (<t:${nextDropTimestamp}:f>)`
                )
                .setColor(0x42A5F5);
        }
        return message.channel.send({ embeds: [embed] });
    },

    DROP_INTERVAL
};