require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Command imports
const dropCard = require('./commands/dropCard');
const viewDroppedCards = require('./commands/viewDroppedCards');
const viewCard = require('./commands/viewCard');
const tag = require('./commands/tag');
const taglist = require('./commands/taglist');
const createTag = require('./commands/createTag');
const burnCard = require('./commands/burnCard');
const giftCard = require('./commands/giftCard');
const help = require('./commands/help');
const inventory = require('./commands/inventory');
const updateInventory = require('./commands/updateInventory');
const inventoryPrivacy = require('./commands/inventoryPrivacy');
const collectionPrivacy = require('./commands/collectionPrivacy');
const register = require('./commands/register');
const use = require('./commands/use');
const pool = require('./utils/mysql');
const addPrintZero = require('./commands/addPrintZero');
const lookup = require('./commands/lookup');
const trade = require('./commands/trade');
const addCard = require('./commands/addCard');
const characterLookup = require('./commands/characterLookup');
const ban = require('./commands/ban');
const giveCards = require('./commands/giveCards');
const massBurn = require('./commands/massBurn');
const shop = require('./commands/shop');
const buy = require('./commands/buy');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
    ]
});

// --- Prefix logic ---
const prefixesPath = path.join(__dirname, '..', 'prefixes.json');
let prefixes = {};
if (fs.existsSync(prefixesPath)) {
    prefixes = JSON.parse(fs.readFileSync(prefixesPath, 'utf8'));
}
function getPrefix(guildId) {
    if (!guildId) return '!'; // Default for DMs
    return prefixes[guildId] || '!';
}
function setPrefix(guildId, prefix) {
    prefixes[guildId] = prefix;
    fs.writeFileSync(prefixesPath, JSON.stringify(prefixes, null, 2));
}

// --- Logging channel setup ---
const logChannelId = process.env.LOG_CHANNEL_ID; // Set this in your .env file
let logChannel;

client.once('ready', () => {
    logChannel = client.channels.cache.get(logChannelId);
    if (!logChannel) {
        console.error('Log channel not found!');
    } else {
        console.log('Bot is ready and log channel set.');
    }
});

// --- Drop notification background job ---
const DROP_INTERVAL = 10 * 60 * 1000;
client.once('ready', () => {
    setInterval(async () => {
        const now = Date.now();
        const [rows] = await pool.execute(
            'SELECT user_id, last_drop, notified, channel_id FROM drop_cooldowns WHERE last_drop > 0 AND notified = 0'
        );
        for (const row of rows) {
            if (now - row.last_drop >= DROP_INTERVAL) {
                const channel = client.channels.cache.get(row.channel_id);
                if (channel) {
                    await channel.send(`Your drop is ready <@${row.user_id}>`);
                }
                await pool.execute(
                    'UPDATE drop_cooldowns SET notified = 1 WHERE user_id = ?',
                    [row.user_id]
                );
            }
        }
    }, 60 * 1000);
});

// --- Command handler with improved registration check ---
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    const [banRows] = await pool.execute('SELECT 1 FROM banned_users WHERE user_id = ?', [message.author.id]);
    if (banRows.length) return; // Ignore or send a message if banned

    const prefix = getPrefix(message.guild?.id);

    // Only process messages that start with the prefix
    if (message.content.slice(0, prefix.length).toLowerCase() !== prefix.toLowerCase()) return;

    // Get the command name (first word after prefix)
    const commandBody = message.content.slice(prefix.length).trim();
    const commandName = commandBody.split(/\s+/)[0].toLowerCase();

    // List of commands that require registration
    const commandsNeedingRegistration = [
        'inv', 'inventory', 'collection', 'c', 'dropcard', 'd', 'droptimer', 'cooldown', 'cd',
        'view', 'v', 'tag', 't', 'createtag', 'ct', 'burncard', 'b', 'giftcard', 'g', 'help',
        'updateinventory', 'inventoryprivacy', 'collectionprivacy', 'use'
    ];

    // Allow register command without registration check
    if (commandName === 'register') {
        return await register.execute(message);
    }

    // Only check registration for known commands
    if (commandsNeedingRegistration.includes(commandName)) {
        const [rows] = await pool.execute(
            'SELECT 1 FROM user_inventory WHERE user_id = ?',
            [message.author.id]
        );
        if (!rows.length) {
            return message.reply(`You must register first! Use \`${prefix}register\``);
        }
    }

    // Set prefix command (admin only)
    if (commandName === 'setprefix') {
        if (!message.member.permissions.has('Administrator')) {
            return message.reply('Only administrators can set the prefix.');
        }
        const args = commandBody.slice('setprefix'.length).trim().split(/ +/);
        const newPrefix = args[0];
        if (!newPrefix) return message.reply('Usage: ' + prefix + 'setprefix <newPrefix>');
        setPrefix(message.guild.id, newPrefix);

        return message.channel.send(`Prefix set to \`${newPrefix}\``);
    }

    if (commandName === 'inventoryprivacy') {
        const args = commandBody.slice(commandName.length).trim().split(/ +/);
        await inventoryPrivacy.execute(message, args);
        return;
    }
    if (commandName === 'collectionprivacy') {
        const args = commandBody.slice(commandName.length).trim().split(/ +/);
        await collectionPrivacy.execute(message, args);
        return;
    }

    // --- Only log for giftcard and trade commands ---

    // Gift card (aliases: giftcard, g)
   if (commandName === 'giftcard' || commandName === 'g') {
        const args = commandBody.slice(commandName.length).trim().split(/ +/);
        const replyMsg = await giftCard.execute(message, args);

        // Only log if the command was successful (replyMsg is an object with an embed or content)
        if (
            logChannel &&
            replyMsg &&
            (
                (replyMsg.embeds && replyMsg.embeds.length > 0) ||
                (typeof replyMsg.content === 'string' && replyMsg.content.trim() !== '')
            )
        ) {
            let botReplyText = replyMsg.content;
            if ((!botReplyText || botReplyText === '') && replyMsg.embeds && replyMsg.embeds.length > 0) {
                const embed = replyMsg.embeds[0];
                botReplyText =
                    (embed.title ? `**${embed.title}**\n` : '') +
                    (embed.description ? `${embed.description}\n` : '');
                if (embed.fields && embed.fields.length > 0) {
                    botReplyText += embed.fields.map(f => `**${f.name}**: ${f.value}`).join('\n');
                }
                botReplyText = botReplyText.trim() || '[Embed/No Text]';
            }
            logChannel.send(
                `📝 **Command:** giftcard\n` +
                `👤 **User:** ${message.author.tag} (${message.author.id})\n` +
                `#️⃣ **Channel:** ${message.channel.name} (${message.channel.id})\n` +
                `💬 **Content:** ${message.content}\n` +
                `🔎 **Args:** ${args.join(' ')}\n` +
                `🤖 **Bot Reply:** ${botReplyText}`
            ).catch(() => {});
        }
        return;
    }
    if (commandName === 'givecards') {
        const args = commandBody.slice(commandName.length).trim().split(/ +/);
        await giveCards.execute(message, args);
        return;
    }
    // Add card (admin only)
    if (commandName === 'addcard') {
        const args = commandBody.slice(commandName.length).trim().split(/ +/);
        await addCard.execute(message, args);
        return;
    }
    // Add Print Zero (admin only)
    if (commandName === 'addprintzero') {
        const args = commandBody.slice(commandName.length).trim().split(/ +/);
        await addPrintZero.execute(message, args);
        return;
    }

    // Trade (including "sadd" shortcut)
    if (commandName.startsWith('add')) {
        const args = ['add', ...commandBody.slice(commandName.length).trim().split(/ +/)];
        const replyMsg = await trade.execute(message, args);
        if (
            logChannel &&
            replyMsg &&
            (
                (replyMsg.embeds && replyMsg.embeds.length > 0) ||
                (typeof replyMsg.content === 'string' && replyMsg.content.trim() !== '')
            )
        ) {
            let botReplyText = replyMsg.content;
            if ((!botReplyText || botReplyText === '') && replyMsg.embeds && replyMsg.embeds.length > 0) {
                const embed = replyMsg.embeds[0];
                botReplyText =
                    (embed.title ? `**${embed.title}**\n` : '') +
                    (embed.description ? `${embed.description}\n` : '');
                if (embed.fields && embed.fields.length > 0) {
                    botReplyText += embed.fields.map(f => `**${f.name}**: ${f.value}`).join('\n');
                }
                botReplyText = botReplyText.trim() || '[Embed/No Text]';
            }
            logChannel.send(
                `📝 **Command:** trade add\n` +
                `👤 **User:** ${message.author.tag} (${message.author.id})\n` +
                `#️⃣ **Channel:** ${message.channel.name} (${message.channel.id})\n` +
                `💬 **Content:** ${message.content}\n` +
                `🔎 **Args:** ${args.join(' ')}\n` +
                `🤖 **Bot Reply:** ${botReplyText}`
            ).catch(() => {});
        }
        return;
    }
    if (commandName === 'trade' || commandName === 't') {
        const args = commandBody.slice(commandName.length).trim().split(/ +/);
        const replyMsg = await trade.execute(message, args);
        if (
            logChannel &&
            replyMsg &&
            (
                (replyMsg.embeds && replyMsg.embeds.length > 0) ||
                (typeof replyMsg.content === 'string' && replyMsg.content.trim() !== '')
            )
        ) {
            let botReplyText = replyMsg.content;
            if ((!botReplyText || botReplyText === '') && replyMsg.embeds && replyMsg.embeds.length > 0) {
                const embed = replyMsg.embeds[0];
                botReplyText =
                    (embed.title ? `**${embed.title}**\n` : '') +
                    (embed.description ? `${embed.description}\n` : '');
                if (embed.fields && embed.fields.length > 0) {
                    botReplyText += embed.fields.map(f => `**${f.name}**: ${f.value}`).join('\n');
                }
                botReplyText = botReplyText.trim() || '[Embed/No Text]';
            }
            logChannel.send(
                `📝 **Command:** trade\n` +
                `👤 **User:** ${message.author.tag} (${message.author.id})\n` +
                `#️⃣ **Channel:** ${message.channel.name} (${message.channel.id})\n` +
                `💬 **Content:** ${message.content}\n` +
                `🔎 **Args:** ${args.join(' ')}\n` +
                `🤖 **Bot Reply:** ${botReplyText}`
            ).catch(() => {});
        }
        return;
    }

    // --- All other commands: just execute, no logging ---

    if (commandName === 'inventory' || commandName === 'inv') {
        const args = commandBody.slice(commandName.length).trim().split(/ +/);
        await inventory.execute(message, args);
        return;
    }
    if (commandName === 'collection' || commandName === 'c') {
        const args = commandBody.slice(commandName.length).trim().split(/ +/);
        await viewDroppedCards.execute(message, args);
        return;
    }
    if (commandName === 'dropcard' || commandName === 'd') {
        const args = commandBody.slice(commandName.length).trim().split(/ +/);
        await dropCard.execute(message, args);
        return;
    }
    if (commandName === 'cooldown' || commandName === 'cd') {
        await dropCard.droptimer(message);
        return;
    }
    if (commandName === 'view' || commandName === 'v') {
        const args = commandBody.slice(commandName.length).trim().split(/ +/);
        await viewCard.execute(message, args);
        return;
    }
    if (commandName === 'tag') {
        const args = commandBody.slice(commandName.length).trim().split(/ +/);
        await tag.execute(message, args);
        return;
    }
    if (commandName === 'createtag' || commandName === 'ct') {
        const args = commandBody.slice(commandName.length).trim().split(/ +/);
        await createTag.execute(message, args);
        return;
    }
    if (commandName === 'taglist' || commandName === 'tl') {
        const args = commandBody.slice(commandName.length).trim().split(/ +/);
        await taglist.execute(message, args);
        return;
    }
    if (commandName === 'burncard' || commandName === 'b') {
        const args = commandBody.slice(commandName.length).trim().split(/ +/);
        await burnCard.execute(message, args);
        return;
    }
    if (commandName === 'updateinventory') {
        const args = commandBody.slice(commandName.length).trim().split(/ +/);
        await updateInventory.execute(message, args);
        return;
    }
    if (commandName === 'use' || commandName === 'u') {
        const args = commandBody.slice(commandName.length).trim().split(/ +/);
        await use.execute(message, args);
        return;
    }
    if (commandName === 'lookup' || commandName === 'lu') {
        const args = commandBody.slice(commandName.length).trim().split(/ +/);
        await lookup.execute(message, args);
        return;
    }
    if (commandName === 'info' || commandName === 'i') {
        const args = commandBody.slice(commandName.length).trim().split(/ +/);
        await characterLookup.execute(message, args);
        return;
    }
    if (commandName === 'ban') {
        const args = commandBody.slice(commandName.length).trim().split(/ +/);
        await ban.execute(message, args);
        return;
    }
    if (commandName === 'help') {
        const args = commandBody.slice(commandName.length).trim().split(/ +/);
        await help.execute(message, args);
        return;
    }
    if (commandName === 'massburn' || commandName === 'mb') {
        const args = commandBody.slice(commandName.length).trim().split(/ +/);
        await massBurn.execute(message, args);
        return;
    }
    if (commandName === 'shop') {
        await shop.execute(message);
        return;
    }
    if (commandName === 'buy') {
        const args = commandBody.slice(commandName.length).trim().split(/ +/);
        await buy.execute(message, args);
        return;
    }

});

client.login(process.env.BOT_TOKEN);