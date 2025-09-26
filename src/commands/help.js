const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'help',
    description: 'Shows a list of available commands.',
    async execute(message) {
        const embed = new EmbedBuilder()
            .setTitle('📖 Anime Bot Commands')
            .setColor(0x42A5F5)
            .setDescription(
                [
                    '**General**',
                    '• `!help` — Show this help message.',
                    '',
                    '**Cards**',
                    '• `!dropcard` — Drop 3 cards and pick one.',
                    '• `!collection` — View your card collection.',
                    '• `!viewCard CARD_CODE` — View details of a specific card.',
                    '',
                    '**Filtering & Tags**',
                    '• `!collection -tag TAG` — View cards with a specific tag.',
                    '• `!collection -series NAME` — Filter by series.',
                    '• `!collection -name NAME` — Filter by card name.',
                    '• `!collection -rarity RARITY` — Filter by rarity.',
                    '• `!collection -print=NUM`, `-print>NUM`, `-print<NUM` — Filter by print number.',
                    '',
                    '**Tags**',
                    '• `!createtag TAG EMOJI` — Create a tag for your cards.',
                    '• `!tag CARD_CODE TAG` — Tag a card.',
                    '',
                    '**Card Actions**',
                    '• `!burnCard CARD_CODE` — Burn a card and give it to the bot.',
                    '• `!giftCard CARD_CODE @user` — Gift a card to another user.',
                ].join('\n')
            )
            .setFooter({ text: 'Need help? Ask in the server!' });

        await message.channel.send({ embeds: [embed] });
    }
};