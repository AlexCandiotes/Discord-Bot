const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, userMention } = require('discord.js');
const pool = require('../utils/mysql');
const activeTrades = {}; // In-memory trade sessions

function getTrade(userId) {
    return activeTrades[userId];
}

function setTrade(userId, trade) {
    activeTrades[userId] = trade;
}

function clearTrade(userId, otherUserId) {
    delete activeTrades[userId];
    delete activeTrades[otherUserId];
}

function tradeBoxEmbed(userA, offerA, userB, offerB) {
    function offerLines(offer) {
        let lines = [];
        if (offer.cards.length) lines.push(`**Cards:**\n${offer.cards.map(c => `\`${c}\``).join('\n')}`);
        if (Object.keys(offer.gems).length)
            lines.push(
                '**Gems:**\n' +
                    Object.entries(offer.gems)
                        .map(([r, n]) => `\`${n} ${r}\``)
                        .join('\n')
            );
        if (offer.coins) lines.push(`**Coins:** \`${offer.coins}\``);
        if (offer.hearts) lines.push(`**Hearts:** \`${offer.hearts}\``);
        if (offer.frames.length) lines.push(`**Frames:**\n${offer.frames.map(f => `\`${f}\``).join('\n')}`);
        if (!lines.length) lines.push('*Nothing*');
        return lines.join('\n');
    }
    return new EmbedBuilder()
        .setTitle('Trade Offer')
        .addFields(
            { name: `${userA.username}'s Offer`, value: offerLines(offerA), inline: true },
            { name: `${userB.username}'s Offer`, value: offerLines(offerB), inline: true }
        )
        .setColor(0x5865F2);
}

module.exports = {
    name: 'trade',
    description: 'Trade cards, gems, coins, hearts, or frames with another user.',
    async execute(message, args) {
        const userId = message.author.id;
        const mention = message.mentions.users.first();

        // Start a trade with accept/reject buttons (only mentioned user can accept/reject)
        if (mention && (!args[0] || args[0] === `<@${mention.id}>` || args[0] === `<@!${mention.id}>`)) {
            if (getTrade(userId) || getTrade(mention.id)) {
                return message.reply('One of you is already in a trade.');
            }
            setTrade(userId, {
                with: mention.id,
                offer: { cards: [], gems: {}, coins: 0, hearts: 0, frames: [] },
                confirmed: false,
                tradeBoxMsgId: null
            });
            setTrade(mention.id, {
                with: userId,
                offer: { cards: [], gems: {}, coins: 0, hearts: 0, frames: [] },
                confirmed: false,
                tradeBoxMsgId: null
            });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('trade_confirm_start')
                    .setLabel('Accept')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('trade_reject_start')
                    .setLabel('Reject')
                    .setStyle(ButtonStyle.Danger)
            );

            const tradeStartMsg = await message.channel.send({
                content: `🔄 ${userMention(userId)} wants to trade with ${userMention(mention.id)}!\n${userMention(mention.id)}, please accept or reject the trade to proceed.`,
                components: [row]
            });

            const filter = i =>
                i.user.id === mention.id &&
                (i.customId === 'trade_confirm_start' || i.customId === 'trade_reject_start');
            const collector = tradeStartMsg.createMessageComponentCollector({ filter, time: 60000 });

            collector.on('collect', async interaction => {
                if (interaction.customId === 'trade_confirm_start') {
                    await interaction.reply({ content: 'You have accepted the trade. Both users can now add items and proceed.', ephemeral: true });
                    await tradeStartMsg.edit({ content: '✅ Trade accepted! Both users can now add items and proceed.', components: [] });

                    // Show the initial trade box (empty offers) WITH LOCK BUTTON
                    const userA = await message.client.users.fetch(userId);
                    const userB = await message.client.users.fetch(mention.id);

                    let embed = tradeBoxEmbed(userA, getTrade(userId).offer, userB, getTrade(mention.id).offer)
                        .setTitle('Trade Offer')
                        .setDescription('🔒 Lock your offer when ready. Both users must lock to confirm.');

                    let row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('trade_lock')
                            .setEmoji('🔒')
                            .setLabel('Lock Offer')
                            .setStyle(ButtonStyle.Secondary)
                    );

                    // Send the trade box and store its message ID
                    const tradeBoxMsg = await message.channel.send({
                        content: `🔄 ${userMention(userId)} and ${userMention(mention.id)}, add items if you wish, then lock your offer with 🔒.`,
                        embeds: [embed],
                        components: [row]
                    });

                    // Store the trade box message ID in both trade sessions
                    const tradeA = getTrade(userId);
                    const tradeB = getTrade(mention.id);
                    tradeA.tradeBoxMsgId = tradeBoxMsg.id;
                    tradeB.tradeBoxMsgId = tradeBoxMsg.id;
                    setTrade(userId, tradeA);
                    setTrade(mention.id, tradeB);

                    // Start the lock/confirm collector immediately
                    const locked = { [userId]: false, [mention.id]: false };
                    const ready = { [userId]: false, [mention.id]: false };

                    const lockFilter = i =>
                        (i.user.id === userId || i.user.id === mention.id) &&
                        (i.customId === 'trade_lock' || i.customId === 'trade_tick');
                    const lockCollector = tradeBoxMsg.createMessageComponentCollector({ filter: lockFilter, time: 120000 });

                    lockCollector.on('collect', async interaction => {
                        const tradeA = getTrade(userId);
                        const tradeB = getTrade(mention.id);

                        if (interaction.customId === 'trade_lock') {
                            if (locked[interaction.user.id]) {
                                await interaction.reply({ content: 'You have already locked your offer.', ephemeral: true });
                                return;
                            }
                            locked[interaction.user.id] = true;
                            await interaction.reply({ content: 'You have locked your offer.', ephemeral: true });

                            // Update embed to show lock status
                            let updatedEmbed = tradeBoxEmbed(userA, tradeA.offer, userB, tradeB.offer)
                                .setTitle('Trade Offer')
                                .setDescription('🔒 Lock your offer when ready. Both users must lock to confirm.');

                            // If both locked, show tick button
                            if (locked[userId] && locked[mention.id]) {
                                row = new ActionRowBuilder().addComponents(
                                    new ButtonBuilder()
                                        .setCustomId('trade_tick')
                                        .setEmoji('✅')
                                        .setLabel('Confirm Trade')
                                        .setStyle(ButtonStyle.Success)
                                );
                                await tradeBoxMsg.edit({
                                    content: `🔒 Both offers are locked! ${userMention(userId)} and ${userMention(mention.id)}, click ✅ to complete the trade.`,
                                    embeds: [updatedEmbed],
                                    components: [row]
                                });
                            } else {
                                await tradeBoxMsg.edit({
                                    content: `🔄 ${userMention(userId)} and ${userMention(mention.id)}, lock your offers with 🔒.\n` +
                                        `${locked[userId] ? `${userMention(userId)} has locked.` : ''} ${locked[mention.id] ? `${userMention(mention.id)} has locked.` : ''}`,
                                    embeds: [updatedEmbed],
                                    components: [row]
                                });
                            }
                        } else if (interaction.customId === 'trade_tick') {
                            if (!locked[interaction.user.id]) {
                                await interaction.reply({ content: 'You must lock your offer first (🔒).', ephemeral: true });
                                return;
                            }
                            if (ready[interaction.user.id]) {
                                await interaction.reply({ content: 'You have already confirmed.', ephemeral: true });
                                return;
                            }
                            ready[interaction.user.id] = true;
                            await interaction.reply({ content: 'You are ready to complete the trade.', ephemeral: true });

                            let updatedEmbed = tradeBoxEmbed(userA, tradeA.offer, userB, tradeB.offer)
                                .setTitle('Trade Offer')
                                .setDescription('🔒 Lock your offer when ready. Both users must lock to confirm.');

                            if (ready[userId] && ready[mention.id]) {
                                lockCollector.stop('completed');
                            } else {
                                await tradeBoxMsg.edit({
                                    content: `✅ Waiting for both to confirm with ✅.\n` +
                                        `${ready[userId] ? `${userMention(userId)} is ready.` : ''} ${ready[mention.id] ? `${userMention(mention.id)} is ready.` : ''}`,
                                    embeds: [updatedEmbed],
                                    components: [row]
                                });
                            }
                        }
                    });

                    lockCollector.on('end', async (collected, reason) => {
                        if (reason === 'completed') {
                            // Execute trade logic here (move cards, gems, etc.)
                            const tradeA = getTrade(userId);
                            const tradeB = getTrade(mention.id);
                            // Cards
                            for (const code of tradeA.offer.cards) {
                                await pool.execute('UPDATE prints SET user_id = ? WHERE code = ?', [mention.id, code]);
                            }
                            for (const code of tradeB.offer.cards) {
                                await pool.execute('UPDATE prints SET user_id = ? WHERE code = ?', [userId, code]);
                            }
                            // Gems
                            for (const [rarity, amount] of Object.entries(tradeA.offer.gems)) {
                                await pool.execute(`UPDATE user_inventory SET ${rarity}_gems = ${rarity}_gems - ? WHERE user_id = ?`, [amount, userId]);
                                await pool.execute(`UPDATE user_inventory SET ${rarity}_gems = ${rarity}_gems + ? WHERE user_id = ?`, [amount, mention.id]);
                            }
                            for (const [rarity, amount] of Object.entries(tradeB.offer.gems)) {
                                await pool.execute(`UPDATE user_inventory SET ${rarity}_gems = ${rarity}_gems - ? WHERE user_id = ?`, [amount, mention.id]);
                                await pool.execute(`UPDATE user_inventory SET ${rarity}_gems = ${rarity}_gems + ? WHERE user_id = ?`, [amount, userId]);
                            }
                            // Coins
                            await pool.execute('UPDATE user_inventory SET coins = coins - ? WHERE user_id = ?', [tradeA.offer.coins, userId]);
                            await pool.execute('UPDATE user_inventory SET coins = coins + ? WHERE user_id = ?', [tradeA.offer.coins, mention.id]);
                            await pool.execute('UPDATE user_inventory SET coins = coins - ? WHERE user_id = ?', [tradeB.offer.coins, mention.id]);
                            await pool.execute('UPDATE user_inventory SET coins = coins + ? WHERE user_id = ?', [tradeB.offer.coins, userId]);
                            // Hearts
                            await pool.execute('UPDATE user_inventory SET hearts = hearts - ? WHERE user_id = ?', [tradeA.offer.hearts, userId]);
                            await pool.execute('UPDATE user_inventory SET hearts = hearts + ? WHERE user_id = ?', [tradeA.offer.hearts, mention.id]);
                            await pool.execute('UPDATE user_inventory SET hearts = hearts - ? WHERE user_id = ?', [tradeB.offer.hearts, mention.id]);
                            await pool.execute('UPDATE user_inventory SET hearts = hearts + ? WHERE user_id = ?', [tradeB.offer.hearts, userId]);
                            // Frames
                            for (const frame of tradeA.offer.frames) {
                                const [rows] = await pool.execute('SELECT frames FROM user_inventory WHERE user_id = ?', [userId]);
                                let frames = [];
                                try { frames = JSON.parse(rows[0].frames); } catch {}
                                frames = frames.filter(f => f !== frame);
                                await pool.execute('UPDATE user_inventory SET frames = ? WHERE user_id = ?', [JSON.stringify(frames), userId]);
                                const [otherRows] = await pool.execute('SELECT frames FROM user_inventory WHERE user_id = ?', [mention.id]);
                                let otherFrames = [];
                                try { otherFrames = JSON.parse(otherRows[0].frames); } catch {}
                                otherFrames.push(frame);
                                await pool.execute('UPDATE user_inventory SET frames = ? WHERE user_id = ?', [JSON.stringify(otherFrames), mention.id]);
                            }
                            for (const frame of tradeB.offer.frames) {
                                const [rows] = await pool.execute('SELECT frames FROM user_inventory WHERE user_id = ?', [mention.id]);
                                let frames = [];
                                try { frames = JSON.parse(rows[0].frames); } catch {}
                                frames = frames.filter(f => f !== frame);
                                await pool.execute('UPDATE user_inventory SET frames = ? WHERE user_id = ?', [JSON.stringify(frames), mention.id]);
                                const [otherRows] = await pool.execute('SELECT frames FROM user_inventory WHERE user_id = ?', [userId]);
                                let otherFrames = [];
                                try { otherFrames = JSON.parse(otherRows[0].frames); } catch {}
                                otherFrames.push(frame);
                                await pool.execute('UPDATE user_inventory SET frames = ? WHERE user_id = ?', [JSON.stringify(otherFrames), userId]);
                            }

                            clearTrade(userId, mention.id);
                            await tradeBoxMsg.edit({ content: '✅ Trade complete! Items have been exchanged.', components: [], embeds: [] });
                        } else {
                            clearTrade(userId, mention.id);
                            await tradeBoxMsg.edit({ content: 'Trade cancelled or timed out.', components: [], embeds: [] });
                        }
                    });

                    collector.stop('accepted');
                } else if (interaction.customId === 'trade_reject_start') {
                    await interaction.reply({ content: 'You have rejected the trade.', ephemeral: true });
                    clearTrade(userId, mention.id);
                    await tradeStartMsg.edit({ content: '❌ Trade cancelled.', components: [] });
                    collector.stop('rejected');
                }
            });

            collector.on('end', async (collected, reason) => {
                if (reason !== 'accepted' && reason !== 'rejected') {
                    clearTrade(userId, mention.id);
                    await tradeStartMsg.edit({ content: '❌ Trade timed out or was cancelled.', components: [] });
                }
            });

            return;
        }

        // Allow both "add" and "sadd" as the command
        if (args[0] === 'add' || args[0] === 'sadd') {
            const trade = getTrade(userId);
            if (!trade) return message.reply('You are not in a trade.');
            if (trade.confirmed) return message.reply('You already confirmed. Wait for the other user.');

            let itemType = args[1]?.toLowerCase();
            let itemArgs = args.slice(2);

            if (!itemType) return message.reply('Specify what to add: card, n gem, r gem, coins, hearts, frame.');

            if (itemType === 'card') {
                const code = itemArgs[0]?.toUpperCase();
                if (!code) return message.reply('Specify the card code.');
                const [rows] = await pool.execute('SELECT * FROM prints WHERE user_id = ? AND code = ?', [userId, code]);
                if (!rows.length) return message.reply('You do not own that card.');
                trade.offer.cards.push(code);
                setTrade(userId, trade);
            }
            // Gems: support both "r gem 1" and "r 1"
            else if (
                (itemType.length === 1 && ['n', 'r', 's', 'u', 'l'].includes(itemType)) || // "r"
                itemType.endsWith('gem') // "r gem"
            ) {
                let rarity, amount;
                if (itemType.endsWith('gem')) {
                    rarity = itemType.replace(' gem', '').toUpperCase();
                    amount = parseInt(itemArgs[0]) || 1;
                } else {
                    rarity = itemType.toUpperCase();
                    amount = parseInt(itemArgs[1]) || 1;
                }
                const column = `${rarity}_gems`;
                const [rows] = await pool.execute(`SELECT ${column} FROM user_inventory WHERE user_id = ?`, [userId]);
                if (!rows.length || rows[0][column] < amount) return message.reply(`You do not have enough ${rarity} gems.`);
                trade.offer.gems[rarity] = (trade.offer.gems[rarity] || 0) + amount;
                setTrade(userId, trade);
            }
            else if (itemType === 'coins') {
                const amount = parseInt(itemArgs[0]);
                if (!amount || amount < 1) return message.reply('Specify a valid amount.');
                const [rows] = await pool.execute('SELECT coins FROM user_inventory WHERE user_id = ?', [userId]);
                if (!rows.length || rows[0].coins < amount) return message.reply('You do not have enough coins.');
                trade.offer.coins += amount;
                setTrade(userId, trade);
            } else if (itemType === 'hearts') {
                const amount = parseInt(itemArgs[0]);
                if (!amount || amount < 1) return message.reply('Specify a valid amount.');
                const [rows] = await pool.execute('SELECT hearts FROM user_inventory WHERE user_id = ?', [userId]);
                if (!rows.length || rows[0].hearts < amount) return message.reply('You do not have enough hearts.');
                trade.offer.hearts += amount;
                setTrade(userId, trade);
            } else if (itemType === 'frame') {
                const frameName = itemArgs.join(' ');
                if (!frameName) return message.reply('Specify the frame name.');
                const [rows] = await pool.execute('SELECT frames FROM user_inventory WHERE user_id = ?', [userId]);
                let frames = [];
                try { frames = JSON.parse(rows[0].frames); } catch {}
                if (!frames.includes(frameName)) return message.reply('You do not own that frame.');
                trade.offer.frames.push(frameName);
                setTrade(userId, trade);
            } else {
                return message.reply('Unknown item type.');
            }

            // Edit the existing trade box message instead of sending a new one
            const userA = await message.client.users.fetch(userId);
            const userB = await message.client.users.fetch(trade.with);
            const tradeA = getTrade(userId);
            const tradeB = getTrade(trade.with);
            const channel = message.channel;
            if (tradeA.tradeBoxMsgId) {
                try {
                    const tradeBoxMsg = await channel.messages.fetch(tradeA.tradeBoxMsgId);
                    await tradeBoxMsg.edit({
                        embeds: [tradeBoxEmbed(userA, tradeA.offer, userB, tradeB ? tradeB.offer : { cards: [], gems: {}, coins: 0, hearts: 0, frames: [] })]
                    });
                } catch (e) {
                    // fallback: send a new one if not found
                    const newMsg = await channel.send({
                        embeds: [tradeBoxEmbed(userA, tradeA.offer, userB, tradeB ? tradeB.offer : { cards: [], gems: {}, coins: 0, hearts: 0, frames: [] })]
                    });
                    tradeA.tradeBoxMsgId = newMsg.id;
                    tradeB.tradeBoxMsgId = newMsg.id;
                    setTrade(userId, tradeA);
                    setTrade(trade.with, tradeB);
                }
            }

            return message.reply('Item added to your trade offer.');
        }

        // Cancel trade
        if (args[0] === 'cancel') {
            const trade = getTrade(userId);
            if (!trade) return message.reply('You are not in a trade.');
            clearTrade(userId, trade.with);
            return message.channel.send('Trade cancelled.');
        }

        // Show trade status
        if (args[0] === 'status') {
            const trade = getTrade(userId);
            if (!trade) return message.reply('You are not in a trade.');
            const otherTrade = getTrade(trade.with);
            const userA = await message.client.users.fetch(userId);
            const userB = await message.client.users.fetch(trade.with);
            return message.channel.send({
                embeds: [
                    tradeBoxEmbed(userA, trade.offer, userB, otherTrade.offer)
                        .setTitle('Current Trade Status')
                ]
            });
        }

        // Help
        if (args[0] === 'help' || !args.length) {
            return message.channel.send(
                '**Trade Command Usage:**\n' +
                '`trade @user` — Start a trade\n' +
                '`add card CODE` or `sadd card CODE` — Add a card\n' +
                '`add n gem 2` or `sadd n gem 2` or `sadd n 2` — Add 2 N gems\n' +
                '`add coins 100` or `sadd coins 100` — Add 100 coins\n' +
                '`add hearts 5` or `sadd hearts 5` — Add 5 hearts\n' +
                '`add frame FrameName` or `sadd frame FrameName` — Add a frame\n' +
                '`trade status` — Show your current offer\n' +
                '`trade cancel` — Cancel the trade'
            );
        }
    }
};