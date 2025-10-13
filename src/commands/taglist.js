const { EmbedBuilder } = require('discord.js');
const pool = require('../utils/mysql');

module.exports = {
    name: 'taglist',
    description: 'Show a list of all tags for yourself or another user.',
    async execute(message, args) {
        
        let userId;
        if (args.length && args[0].match(/^\d+$/)) {
            userId = args[0];
        } else if (args.length && message.mentions.users.size) {
            userId = message.mentions.users.first().id;
        } else {
            userId = message.author.id;
        }

        const [rows] = await pool.execute(
            'SELECT tag_name, emoji FROM user_tags WHERE user_id = ?',
            [userId]
        );

        if (!rows.length) {
            return message.reply('No tags found for this user.');
        }

        const tagList = rows
            .map(row => row.emoji ? `${row.emoji} - ${row.tag_name}` : row.tag_name)
            .join('\n');

        const embed = new EmbedBuilder()
            .setTitle('Tag List:')
            .setDescription(`<@${userId}>'s Tags:\n${tagList}`)
            .setColor(0x7289da);

        await message.channel.send({ embeds: [embed] });
    }
};