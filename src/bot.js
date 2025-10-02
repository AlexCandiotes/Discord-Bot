require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Command imports
const dropCard = require('./commands/dropCard');
const viewDroppedCards = require('./commands/viewDroppedCards');
const viewCard = require('./commands/viewCard');
const tag = require('./commands/tag');
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

client.once('clientReady', () => {
    logChannel = client.channels.cache.get(logChannelId);
    if (!logChannel) {
        console.error('Log channel not found!');
    } else {
        console.log('Bot is ready and log channel set.');
    }
});

// --- Drop notification background job ---
const DROP_INTERVAL = 10 * 60 * 1000;
client.once('clientReady', () => {
    console.log('Bot is online!');
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
        const replyMsg = await register.execute(message);
        if (logChannel && replyMsg) {
            logChannel.send(
                `📝 **Command:** register\n` +
                `👤 **User:** ${message.author.tag} (${message.author.id})\n` +
                `#️⃣ **Channel:** ${message.channel.name} (${message.channel.id})\n` +
                `💬 **Content:** ${message.content}\n` +
                `🔎 **Args:** ${args.join(' ')}\n` +
                `🤖 **Bot Reply:** ${replyMsg.content || '[Embed/No Text]'}`
            ).catch(() => {});
        }
        return;
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

    // Privacy commands (stop further processing after)
    if (commandName === 'inventoryprivacy') {
        const replyMsg = await inventoryPrivacy.execute(message);
        if (logChannel && replyMsg) {
            logChannel.send(
                `📝 **Command:** inventoryprivacy\n` +
                `👤 **User:** ${message.author.tag} (${message.author.id})\n` +
                `#️⃣ **Channel:** ${message.channel.name} (${message.channel.id})\n` +
                `💬 **Content:** ${message.content}\n` +
                `🔎 **Args:** ${args.join(' ')}\n` +
                `🤖 **Bot Reply:** ${replyMsg.content || '[Embed/No Text]'}`
            ).catch(() => {});
        }
        return;
    }
    if (commandName === 'collectionprivacy') {
        const replyMsg = await collectionPrivacy.execute(message);
        if (logChannel && replyMsg) {
            logChannel.send(
                `📝 **Command:** collectionprivacy\n` +
                `👤 **User:** ${message.author.tag} (${message.author.id})\n` +
                `#️⃣ **Channel:** ${message.channel.name} (${message.channel.id})\n` +
                `💬 **Content:** ${message.content}\n` +
                `🔎 **Args:** ${args.join(' ')}\n` +
                `🤖 **Bot Reply:** ${replyMsg.content || '[Embed/No Text]'}`
            ).catch(() => {});
        }
        return;
    }

    // Inventory (aliases: inventory, inv)
    if (commandName === 'inventory' || commandName === 'inv') {
    const args = commandBody.slice(commandName.length).trim().split(/ +/);
    const replyMsg = await inventory.execute(message, args);
    if (logChannel && replyMsg) {
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
            `📝 **Command:** inventory\n` +
            `👤 **User:** ${message.author.tag} (${message.author.id})\n` +
            `#️⃣ **Channel:** ${message.channel.name} (${message.channel.id})\n` +
            `💬 **Content:** ${message.content}\n` +
            `🔎 **Args:** ${args.join(' ')}\n` +
            `🤖 **Bot Reply:** ${botReplyText}`
        ).catch(() => {});
    }
    return;
}

    // Collection (aliases: collection, c)
    if (commandName === 'collection' || commandName === 'c') {
        const args = commandBody.slice(commandName.length).trim().split(/ +/);
        const replyMsg = await viewDroppedCards.execute(message, args);
        if (logChannel && replyMsg) {
            logChannel.send(
                `📝 **Command:** collection\n` +
                `👤 **User:** ${message.author.tag} (${message.author.id})\n` +
                `#️⃣ **Channel:** ${message.channel.name} (${message.channel.id})\n` +
                `💬 **Content:** ${message.content}\n` +
                `🤖 **Bot Reply:** ${replyMsg?.content || '[Embed/No Text]'}`
            ).catch(() => {});
        }
        return;
    }

    // Drop card (aliases: dropcard, d)
    if (commandName === 'dropcard' || commandName === 'd') {
        const args = commandBody.slice(commandName.length).trim().split(/ +/);
        const replyMsg = await dropCard.execute(message, args);
        if (logChannel && replyMsg) {
            logChannel.send(
                `📝 **Command:** dropcard\n` +
                `👤 **User:** ${message.author.tag} (${message.author.id})\n` +
                `#️⃣ **Channel:** ${message.channel.name} (${message.channel.id})\n` +
                `💬 **Content:** ${message.content}\n` +
                `🤖 **Bot Reply:** ${replyMsg?.content || '[Embed/No Text]'}`
            ).catch(() => {});
        }
        return;
    }

    // Drop timer (aliases: droptimer, cooldown, cd)
    if (commandName === 'droptimer' || commandName === 'cooldown' || commandName === 'cd') {
        const args = commandBody.slice(commandName.length).trim().split(/ +/);
        const replyMsg = await dropCard.droptimer.execute(message, args);
        if (logChannel && replyMsg) {
            logChannel.send(
                `📝 **Command:** droptimer\n` +
                `👤 **User:** ${message.author.tag} (${message.author.id})\n` +
                `#️⃣ **Channel:** ${message.channel.name} (${message.channel.id})\n` +
                `💬 **Content:** ${message.content}\n` +
                `🤖 **Bot Reply:** ${replyMsg?.content || '[Embed/No Text]'}`
            ).catch(() => {});
        }
        return;
    }

    // View card (aliases: view, v)
    if (commandName === 'view' || commandName === 'v') {
        const args = commandBody.slice(commandName.length).trim().split(/ +/);
        const replyMsg = await viewCard.execute(message, args);
        if (logChannel && replyMsg) {
            logChannel.send(
                `📝 **Command:** view\n` +
                `👤 **User:** ${message.author.tag} (${message.author.id})\n` +
                `#️⃣ **Channel:** ${message.channel.name} (${message.channel.id})\n` +
                `💬 **Content:** ${message.content}\n` +
                `🤖 **Bot Reply:** ${replyMsg?.content || '[Embed/No Text]'}`
            ).catch(() => {});
        }
        return;
    }

    // Tag (aliases: tag, t)
    if (commandName === 'tag' || commandName === 't') {
        const args = commandBody.slice(commandName.length).trim().split(/ +/);
        const replyMsg = await tag.execute(message, args);
        if (logChannel && replyMsg) {
            logChannel.send(
                `📝 **Command:** tag\n` +
                `👤 **User:** ${message.author.tag} (${message.author.id})\n` +
                `#️⃣ **Channel:** ${message.channel.name} (${message.channel.id})\n` +
                `💬 **Content:** ${message.content}\n` +
                `🤖 **Bot Reply:** ${replyMsg?.content || '[Embed/No Text]'}`
            ).catch(() => {});
        }
        return;
    }

    // Create tag (aliases: createtag, ct)
    if (commandName === 'createtag' || commandName === 'ct') {
        const args = commandBody.slice(commandName.length).trim().split(/ +/);
        const replyMsg = await createTag.execute(message, args);
        if (logChannel && replyMsg) {
            logChannel.send(
                `📝 **Command:** createtag\n` +
                `👤 **User:** ${message.author.tag} (${message.author.id})\n` +
                `#️⃣ **Channel:** ${message.channel.name} (${message.channel.id})\n` +
                `💬 **Content:** ${message.content}\n` +
                `🤖 **Bot Reply:** ${replyMsg?.content || '[Embed/No Text]'}`
            ).catch(() => {});
        }
        return;
    }

    // Burn card (aliases: burncard, b)
    if (commandName === 'burncard' || commandName === 'b') {
        const args = commandBody.slice(commandName.length).trim().split(/ +/);
        const replyMsg = await burnCard.execute(message, args);
        if (logChannel && replyMsg) {
            logChannel.send(
                `📝 **Command:** burncard\n` +
                `👤 **User:** ${message.author.tag} (${message.author.id})\n` +
                `#️⃣ **Channel:** ${message.channel.name} (${message.channel.id})\n` +
                `💬 **Content:** ${message.content}\n` +
                `🤖 **Bot Reply:** ${replyMsg?.content || '[Embed/No Text]'}`
            ).catch(() => {});
        }
        return;
    }

    // Gift card (aliases: giftcard, g)
    if (commandName === 'giftcard' || commandName === 'g') {
        const args = commandBody.slice(commandName.length).trim().split(/ +/);
        const replyMsg = await giftCard.execute(message, args);
        if (logChannel && replyMsg) {
            logChannel.send(
                `📝 **Command:** giftcard\n` +
                `👤 **User:** ${message.author.tag} (${message.author.id})\n` +
                `#️⃣ **Channel:** ${message.channel.name} (${message.channel.id})\n` +
                `💬 **Content:** ${message.content}\n` +
                `🤖 **Bot Reply:** ${replyMsg?.content || '[Embed/No Text]'}`
            ).catch(() => {});
        }
        return;
    }

    // Help
    if (commandName === 'help') {
       const args = commandBody.slice(commandName.length).trim().split(/ +/);
        const replyMsg = await help.execute(message, args);
        if (logChannel && replyMsg) {
            logChannel.send(
                `📝 **Command:** help\n` +
                `👤 **User:** ${message.author.tag} (${message.author.id})\n` +
                `#️⃣ **Channel:** ${message.channel.name} (${message.channel.id})\n` +
                `💬 **Content:** ${message.content}\n` +
                `🤖 **Bot Reply:** ${replyMsg?.content || '[Embed/No Text]'}`
            ).catch(() => {});
        }
        return;
    }

    // Update inventory
    if (commandName === 'updateinventory') {
        const args = commandBody.slice(commandName.length).trim().split(/ +/);
        const replyMsg = await updateInventory.execute(message, args);
        if (logChannel && replyMsg) {
            logChannel.send(
                `📝 **Command:** updateinventory\n` +
                `👤 **User:** ${message.author.tag} (${message.author.id})\n` +
                `#️⃣ **Channel:** ${message.channel.name} (${message.channel.id})\n` +
                `💬 **Content:** ${message.content}\n` +
                `🤖 **Bot Reply:** ${replyMsg?.content || '[Embed/No Text]'}`
            ).catch(() => {});
        }
        return;
    }

    // Use gem
    if (commandName === 'use' || commandName === 'u') {
        const args = commandBody.slice(commandName.length).trim().split(/ +/);
        const replyMsg = await use.execute(message, args);
        if (logChannel && replyMsg) {
            logChannel.send(
                `📝 **Command:** use\n` +
                `👤 **User:** ${message.author.tag} (${message.author.id})\n` +
                `#️⃣ **Channel:** ${message.channel.name} (${message.channel.id})\n` +
                `💬 **Content:** ${message.content}\n` +
                `🤖 **Bot Reply:** ${replyMsg?.content || '[Embed/No Text]'}`
            ).catch(() => {});
        }
        return;
    }
    // Add card
    if (commandName === 'addcard') {
        const args = commandBody.slice(commandName.length).trim().split(/ +/);
        const replyMsg = await addCard.execute(message, args);
        if (logChannel && replyMsg) {
            logChannel.send(
                `📝 **Command:** addcard\n` +
                `👤 **User:** ${message.author.tag} (${message.author.id})\n` +
                `#️⃣ **Channel:** ${message.channel.name} (${message.channel.id})\n` +
                `💬 **Content:** ${message.content}\n` +
                `🤖 **Bot Reply:** ${replyMsg?.content || '[Embed/No Text]'}`
            ).catch(() => {});
        }
        return;
    }
    // Add print zero
    if (commandName === 'addprintzero') {
        const args = commandBody.slice(commandName.length).trim().split(/ +/);
        const replyMsg = await addPrintZero.execute(message, args);
        if (logChannel && replyMsg) {
            logChannel.send(
                `📝 **Command:** addprintzero\n` +
                `👤 **User:** ${message.author.tag} (${message.author.id})\n` +
                `#️⃣ **Channel:** ${message.channel.name} (${message.channel.id})\n` +
                `💬 **Content:** ${message.content}\n` +
                `🤖 **Bot Reply:** ${replyMsg?.content || '[Embed/No Text]'}`
            ).catch(() => {});
        }
        return;
    }
    // Trade (including "sadd" shortcut)
    if (commandName.startsWith('add')) {
        // e.g. "sadd card 15BILY" or "sadd n gem 2"
        const args = ['add', ...commandBody.slice(commandName.length).trim().split(/ +/)];
        const replyMsg = await lookup.trade(message, args);
        if (logChannel && replyMsg) {
            logChannel.send(
                `📝 **Command:** trade add\n` +
                `👤 **User:** ${message.author.tag} (${message.author.id})\n` +
                `#️⃣ **Channel:** ${message.channel.name} (${message.channel.id})\n` +
                `💬 **Content:** ${message.content}\n` +
                `🔎 **Args:** ${args.join(' ')}\n` +
                `🤖 **Bot Reply:** ${replyMsg.content || '[Embed/No Text]'}`
            ).catch(() => {});
        }
        return;
    }
    // Trade
    if (commandName === 'trade' || commandName === 't') {
        const args = commandBody.slice(commandName.length).trim().split(/ +/);
        const replyMsg = await trade.execute(message, args);
        if (logChannel && replyMsg) {
            logChannel.send(
                `📝 **Command:** trade\n` +
                `👤 **User:** ${message.author.tag} (${message.author.id})\n` +
                `#️⃣ **Channel:** ${message.channel.name} (${message.channel.id})\n` +
                `💬 **Content:** ${message.content}\n` +
                `🔎 **Args:** ${args.join(' ')}\n` +
                `🤖 **Bot Reply:** ${replyMsg.content || '[Embed/No Text]'}`
            ).catch(() => {});
        }
        return;
    }
    // Lookup
    if (commandName === 'lookup' || commandName === 'lu') {
        const args = commandBody.slice(commandName.length).trim().split(/ +/);
        const replyMsg = await lookup.execute(message, args);
        if (logChannel && replyMsg) {
            logChannel.send(
                `📝 **Command:** lookup\n` +
                `👤 **User:** ${message.author.tag} (${message.author.id})\n` +
                `#️⃣ **Channel:** ${message.channel.name} (${message.channel.id})\n` +
                `💬 **Content:** ${message.content}\n` +
                `🔎 **Args:** ${args.join(' ')}\n` +
                `🤖 **Bot Reply:** ${replyMsg.content || '[Embed/No Text]'}`
            ).catch(() => {});
        }
        return;
    }
    if (commandName === 'info' || commandName === 'i') {
        const args = commandBody.slice(commandName.length).trim().split(/ +/);
        const replyMsg = await characterLookup.execute(message, args);
        if (logChannel && replyMsg) {
            logChannel.send(
                `📝 **Command:** characterlookup\n` +
                `👤 **User:** ${message.author.tag} (${message.author.id})\n` +
                `#️⃣ **Channel:** ${message.channel.name} (${message.channel.id})\n` +
                `💬 **Content:** ${message.content}\n` +
                `🔎 **Args:** ${args.join(' ')}\n` +
                `🤖 **Bot Reply:** ${replyMsg.content || '[Embed/No Text]'}`
            ).catch(() => {});
        }
        return;
    }
});

client.login(process.env.BOT_TOKEN);