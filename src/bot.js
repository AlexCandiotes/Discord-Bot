require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const dropCard = require('./commands/dropCard');
const viewDroppedCards = require('./commands/viewDroppedCards');
const viewCard = require('./commands/viewCard');
const tag = require('./commands/tag');
const createTag = require('./commands/createTag');
const burnCard = require('./commands/burnCard');
const giftCard = require('./commands/giftCard');
const help = require('./commands/help');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
    ]
});

const DROP_INTERVAL = 10 * 60 * 1000;

client.once('clientReady', () => {
    console.log('Bot is online!');

    setInterval(async () => {
        const now = Date.now();
        // Get all users whose cooldown has expired but haven't been notified
        const [rows] = await pool.execute(
            'SELECT user_id, last_drop, notified, channel_id FROM drop_cooldowns WHERE last_drop > 0 AND notified = 0'
        );
        for (const row of rows) {
            if (now - row.last_drop >= DROP_INTERVAL) {
                // Send the ready message in the channel where the user dropped
                const channel = client.channels.cache.get(row.channel_id);
                if (channel) {
                    await channel.send(`Your drop is ready <@${row.user_id}>`);
                }
                // Mark as notified
                await pool.execute(
                    'UPDATE drop_cooldowns SET notified = 1 WHERE user_id = ?',
                    [row.user_id]
                );
            }
        }
    }, 60 * 1000); // Check every minute
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.content.startsWith('!dropcard')) {
        await dropCard.execute(message);
    }
    if (message.content.startsWith('!collection')) {
        await viewDroppedCards.execute(message);
    }
    if (message.content.startsWith('!view')) {
        await viewCard.execute(message);
    }
    if (message.content.startsWith('!tag')) {
        await tag.execute(message);
    }
    if (message.content.startsWith('!createtag')) {
        await createTag.execute(message);
    }
    if (message.content.startsWith('!burnCard')) {
        await burnCard.execute(message);
    }
    if (message.content.startsWith('!giftCard')) {
        await giftCard.execute(message);
    }
    if (message.content.startsWith('!help')) {
        await help.execute(message);
    }
    if (message.content.startsWith('!droptimer')) {
        await dropCard.droptimer(message);
    }
});

client.login(process.env.BOT_TOKEN);