const pool = require('../utils/mysql');
module.exports = {
    name: 'createTag',
    description: 'Create a tag for your cards.',
    async execute(message, args) {
        if (args.length < 2) return message.channel.send('Usage: createtag <tagName> <emoji>');

        const tagName = args[0];
        const emoji = args.slice(1).join(' ').trim();

        // Only allow standard Discord emojis (no custom emojis)
        const emojiRegex = /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)$/u;
        if (!emojiRegex.test(emoji)) {
            return message.channel.send('Please use a standard Discord emoji (not a custom emoji).');
        }

        // Check if tag already exists for this user
        const [rows] = await pool.execute(
            'SELECT 1 FROM user_tags WHERE user_id = ? AND tag_name = ?',
            [message.author.id, tagName]
        );
        if (rows.length) {
            return message.channel.send(`You already have a tag named "${tagName}".`);
        }

        await pool.execute(
            'INSERT INTO user_tags (user_id, tag_name, emoji) VALUES (?, ?, ?)',
            [message.author.id, tagName, emoji]
        );
        message.channel.send(`Tag "${tagName}" ${emoji} created!`);
    }
};