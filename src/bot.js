require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const dropCard = require('./commands/dropCard');
const viewDroppedCards = require('./commands/viewDroppedCards');
const getCards = require('./commands/getCards');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
    ]
});

client.once('clientReady', () => {
    console.log('Bot is online!');
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.content.startsWith('!dropcard')) {
        await dropCard.execute(message);
    }
    if (message.content.startsWith('!viewDroppedCards')) {
        await viewDroppedCards.execute(message);
    }
});

client.login(process.env.BOT_TOKEN);