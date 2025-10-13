const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'shop',
    description: 'View the shop for special items.',
    async execute(message) {
        const embed = new EmbedBuilder()
            .setTitle('🛒 Archeo Shop')
            .setColor(0xFFD700)
            .setDescription(
                [
                    '**Available Items:**',
                    '',
                    '⏳ **Half Cooldown (halfcooldown)**',
                    'Reduces your drop cooldown by 50% for 30 days.',
                    'Cost: `500 essence`',
                    '',
                    '🍀 **Chance to Drop Extra (extrachance)**',
                    'Gives you a chance to drop an extra card for 30 days.',
                    'Cost: `500 essence`',
                    '',
                    '🎨 **Dyes (dye)**',
                    'Change the color of your essence.',
                    'Cost: `50 essence` each',
                    '',
                    '🔮 **Extra Drop (extradrop)**',
                    'Grants you an extra drop instantly.',
                    'Cost: `1 sphere`',
                ].join('\n')
            )
            .setFooter({ text: 'Use the buy command to purchase an item!' });

        await message.channel.send({ embeds: [embed] });
    }
};