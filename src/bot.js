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
        await register.execute(message);
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
        await inventoryPrivacy.execute(message);
        return;
    }
    if (commandName === 'collectionprivacy') {
        await collectionPrivacy.execute(message);
        return;
    }

    // Inventory (aliases: inventory, inv)
    if (commandName === 'inventory' || commandName === 'inv') {
        const args = commandBody.slice(commandName.length).trim().split(/ +/);
        await inventory.execute(message, args);
        return;
    }

    // Collection (aliases: collection, c)
    if (commandName === 'collection' || commandName === 'c') {
        await viewDroppedCards.execute(message);
        return;
    }

    // Drop card (aliases: dropcard, d)
    if (commandName === 'dropcard' || commandName === 'd') {
        await dropCard.execute(message);
        return;
    }

    // Drop timer (aliases: droptimer, cooldown, cd)
    if (commandName === 'droptimer' || commandName === 'cooldown' || commandName === 'cd') {
        await dropCard.droptimer(message);
        return;
    }

    // View card (aliases: view, v)
    if (commandName === 'view' || commandName === 'v') {
        await viewCard.execute(message);
        return;
    }

    // Tag (aliases: tag, t)
    if (commandName === 'tag' || commandName === 't') {
        await tag.execute(message);
        return;
    }

    // Create tag (aliases: createtag, ct)
    if (commandName === 'createtag' || commandName === 'ct') {
        await createTag.execute(message);
        return;
    }

    // Burn card (aliases: burncard, b)
    if (commandName === 'burncard' || commandName === 'b') {
        await burnCard.execute(message);
        return;
    }

    // Gift card (aliases: giftcard, g)
    if (commandName === 'giftcard' || commandName === 'g') {
        await giftCard.execute(message);
        return;
    }

    // Help
    if (commandName === 'help') {
        await help.execute(message);
        return;
    }

    // Update inventory
    if (commandName === 'updateinventory') {
        const args = commandBody.slice(commandName.length).trim().split(/ +/);
        await updateInventory.execute(message, args);
        return;
    }

    // Use gem
    if (commandName === 'use') {
        const args = commandBody.slice(commandName.length).trim().split(/ +/);
        await use.execute(message, args);
        return;
    }
    // Add print zero
    if (commandName === 'addprintzero') {
        const args = commandBody.slice(commandName.length).trim().split(/ +/);
        await addPrintZero.execute(message, args);
        return;
    }
    if (commandName === 'lookup') {
        const args = commandBody.slice(commandName.length).trim().split(/ +/);
        await lookup.execute(message, args);
        return;
    }
    if (commandName === 'trade') {
    const args = commandBody.slice(commandName.length).trim().split(/ +/);
    await trade.execute(message, args);
    return;
}
    
});

client.login(process.env.BOT_TOKEN);