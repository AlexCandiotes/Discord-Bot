const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'help',
    description: 'Shows a list of available commands.',
    async execute(message) {
        const embed = new EmbedBuilder()
            .setTitle('📖 Archeo Commands')
            .setColor(0x42A5F5)
            .setDescription(
                [
                    '**General**',
                    `• \`help\` — Show this help message.`,
                    `• \`register\` — Register to use the bot.`,
                    `• \`setprefix <prefix>\` — Set a custom prefix (admin only).`,
                    '',
                    '**Inventory & Privacy**',
                    `• \`inventory\` or \`inv\` — View your inventory.`,
                    `• \`inventory @user|userID\` — View another user's inventory.`,
                    `• \`inventoryprivacy\` — Set your inventory privacy.`,
                    '',
                    '**Gems**',
                    `• \`use <n gem|r gem|sr gem|ur gem|lr gem>\` — Use a gem to get a card.`,
                    '',
                    '**Cards**',
                    `• \`dropcard\` or \`d\` — Drop a card and open/store the gem.`,
                    `• \`droptimer\` or \`cd\` — Check your drop cooldown.`,
                    `• \`viewcard [CODE]\` or \`v\` — View a card by code or your most recent card.`,
                    `• \`giftcard\` or \`g\` \`CARD_CODE @user\` — Gift a card to another user.`,
                    `• \`burncard\` or \`b\` \`CARD_CODE\` — Burn a card and give it to the bot.`,
                    '',
                    '**Collection**',
                    `• \`collection\` or \`c\` — View your card collection.`,
                    `• \`collection\` or \`c\` \`@user|userID\` — View another user's collection.`,
                    `• \`collectionprivacy\` — Set your collection privacy.`,
                    '',
                    '**Filtering & Tags**',
                    `• \`collection -tag TAG\` or \`-c -t TAG\` — View cards with a specific tag.`,
                    `• \`collection -series NAME\` or \`-c -s NAME\` — Filter by series.`,
                    `• \`collection -name NAME\` or \`-c -n NAME\` — Filter by card name.`,
                    `• \`collection -rarity RARITY\` or \`-c -r RARITY\` — Filter by rarity.`,
                    `• \`collection -print=NUM\`, \`-print>NUM\`, \`-print<NUM\` or \`-c -p ...\` — Filter by print number.`,
                    '',
                    '**Tags**',
                    `• \`createtag\` or \`ct\` \`TAG EMOJI\` — Create a tag for your cards.`,
                    `• \`tag\` or \`t\` \`CARD_CODE TAG\` — Tag a card.`,
                    `• \`taglist\` or \`tl\` \`[@user|userID]\` — Show your or another user's tags.`,
                    '',
                    '**Lookup**',
                    `• \`lookup\` or \`lu\` \`<name|series>\` — Lookup a character name or series.`,
                    `• \`info\` or \`i\` \`<name|id>\` — Lookup a character by name and get info on it.`,
                    '',
                ].join('\n')
            )
            .setFooter({ text: 'Need help? Ask in the server!' });

        await message.channel.send({ embeds: [embed] });
    }
};