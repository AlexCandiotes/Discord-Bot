const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const drawCard = require('../utils/drawCard');
const pool = require('../utils/mysql');

const rarityRates = { N: 50, R: 30, SR: 15 };
const rarityImages = {
    N: 'images/gems/N_gem.png',
    R: 'images/gems/R_gem.png',
    SR: 'images/gems/SR_gem.png',
};
const gemAnimationGif = 'images/gems/gem.gif';
const DROP_INTERVAL = 10 * 60 * 1000;
const cardUploadChannelId = '1423702746728632320';

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
    name: 'dropcard',
    description: 'Drop a card and open the gem to reveal it.',
    async execute(message) {
        const userId = message.author.id;
        const now = Date.now();

        // --- BOOSTS: Fetch user inventory for boosts ---
        const [invRows] = await pool.execute(
            'SELECT half_cooldown_until, extra_drop_until, extra_drop_count FROM user_inventory WHERE user_id = ?',
            [userId]
        );
        const inv = invRows[0] || {};

        // Half Cooldown logic
        const halfCooldownActive = inv.half_cooldown_until > now;
        const cooldown = halfCooldownActive ? (DROP_INTERVAL / 2) : DROP_INTERVAL;

        // Check last drop time
        const [rows] = await pool.execute(
            'SELECT last_drop FROM drop_cooldowns WHERE user_id = ?',
            [userId]
        );
        const lastDrop = rows.length ? Number(rows[0].last_drop) : null;

        // If user has extra_drop_count > 0, allow instant drop (ignore cooldown)
        let usingExtraDrop = false;
        if (inv.extra_drop_count > 0 && lastDrop && now - lastDrop < cooldown) {
            usingExtraDrop = true;
            // Decrement extra_drop_count immediately
            await pool.execute(
                'UPDATE user_inventory SET extra_drop_count = extra_drop_count - 1 WHERE user_id = ?',
                [userId]
            );
        } else if (lastDrop && now - lastDrop < cooldown) {
            const nextDropTimestamp = Math.floor((lastDrop + cooldown) / 1000);
            const remaining = cooldown - (now - lastDrop);
            const minutes = Math.ceil(remaining / 60000);
            const embed = new EmbedBuilder()
                .setTitle('Drop Cooldown')
                .setDescription(
                    `⏳ You must wait **${minutes} minute${minutes !== 1 ? 's' : ''}** to drop again, <@${userId}>.\n(<t:${nextDropTimestamp}:R>)`
                )
                .setColor(0xB39DDB);
            return message.channel.send({ embeds: [embed] });
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
            .setColor(0xB39DDB);

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

                    const buffer = await drawCard(droppedCard.image, droppedCard.name, nextPrint);

                    const cardUploadChannel = await interaction.client.channels.fetch(cardUploadChannelId);
                    const attachment = new AttachmentBuilder(buffer, { name: `${code}.png` });
                    const uploadMsg = await cardUploadChannel.send({ files: [attachment] });
                    const cardImageUrl = uploadMsg.attachments.first().url;

                    await pool.execute(
                        'INSERT INTO prints (user_id, card_id, print_number, code, card_image) VALUES (?, ?, ?, ?, ?)',
                        [message.author.id, droppedCard.id, nextPrint, code, cardImageUrl]
                    );

                    let resultDesc = `**Name:** ${droppedCard.name}\n**Series:** ${droppedCard.series}\n**Rarity:** ${rarity}\n**Print:** #${nextPrint}\n**Code:** ${code}`;

                    // --- Chance to Drop Extra logic as its own EmbedBuilder ---
                    const extraDropActive = inv.extra_drop_until > Date.now();
                    if (extraDropActive && Math.random() < 0.25) { // 25% chance
                        // Drop an extra card (same rarity)
                        const extraCard = await getRandomCardByRarity(rarity);
                        const [extraResult] = await pool.execute(
                            'SELECT MAX(print_number) AS max_print FROM prints WHERE card_id = ?',
                            [extraCard.id]
                        );
                        const extraPrint = (extraResult[0].max_print || 0) + 1;
                        const extraCode = generateCode();
                        const extraBuffer = await drawCard(extraCard.image, extraCard.name, extraPrint);
                        const extraAttachment = new AttachmentBuilder(extraBuffer, { name: `${extraCode}.png` });
                        const extraUploadMsg = await cardUploadChannel.send({ files: [extraAttachment] });
                        const extraCardImageUrl = extraUploadMsg.attachments.first().url;

                        await pool.execute(
                            'INSERT INTO prints (user_id, card_id, print_number, code, card_image) VALUES (?, ?, ?, ?, ?)',
                            [message.author.id, extraCard.id, extraPrint, extraCode, extraCardImageUrl]
                        );

                        // Send a separate embed for the bonus drop
                        const bonusEmbed = new EmbedBuilder()
                            .setTitle('🎉 Bonus Drop! (Chance to Drop Extra)')
                            .setDescription(
                                `**Name:** ${extraCard.name}\n` +
                                `**Series:** ${extraCard.series}\n` +
                                `**Rarity:** ${rarity}\n` +
                                `**Print:** #${extraPrint}\n` +
                                `**Code:** ${extraCode}`
                            )
                            .setImage(extraCardImageUrl)
                            .setColor(0x43B581);

                        await message.channel.send({ embeds: [bonusEmbed] });
                    }

                    // If user used an extra drop, show how many remain
                    let extraDropMsg = '';
                    if (usingExtraDrop) {
                        // Get updated count
                        const [updatedInvRows] = await pool.execute(
                            'SELECT extra_drop_count FROM user_inventory WHERE user_id = ?',
                            [userId]
                        );
                        const remaining = updatedInvRows[0]?.extra_drop_count || 0;
                        extraDropMsg = `\n\nYou used an **Extra Drop (Sphere)**! You have **${remaining}** remaining.`;
                    }

                    const resultEmbed = new EmbedBuilder()
                        .setTitle(`${message.author.username} opened the gem!`)
                        .setDescription(resultDesc + extraDropMsg)
                        .setImage(cardImageUrl)
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
        const { EmbedBuilder } = require('discord.js');
        const userId = message.author.id;
        const now = Date.now();

        // --- BOOSTS: Fetch user inventory for boosts ---
        const [invRows] = await pool.execute(
            'SELECT half_cooldown_until FROM user_inventory WHERE user_id = ?',
            [userId]
        );
        const inv = invRows[0] || {};
        const halfCooldownActive = inv.half_cooldown_until > now;
        const cooldown = halfCooldownActive ? (DROP_INTERVAL / 2) : DROP_INTERVAL;

        const [rows] = await pool.execute(
            'SELECT last_drop FROM drop_cooldowns WHERE user_id = ?',
            [userId]
        );
        const lastDrop = rows.length ? Number(rows[0].last_drop) : null;

        let embed;
        if (!lastDrop || now - lastDrop >= cooldown) {
            embed = new EmbedBuilder()
                .setTitle('Drop Timer')
                .setDescription('✅ You can drop a card now!')
                .setColor(0x42A5F5);
        } else {
            const nextDropTimestamp = Math.floor((lastDrop + cooldown) / 1000);
            const minutes = Math.ceil((cooldown - (now - lastDrop)) / 60000);
            embed = new EmbedBuilder()
                .setTitle('Drop Timer')
                .setDescription(
                    `⏳ You must wait **${minutes} minute${minutes !== 1 ? 's' : ''}** to drop again, <@${userId}>.\n(<t:${nextDropTimestamp}:R>)`
                )
                .setColor(0xB39DDB);
        }
        return message.channel.send({ embeds: [embed] });
    },

    DROP_INTERVAL
};