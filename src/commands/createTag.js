const pool = require('../utils/mysql');
module.exports = {
    name: 'createTag',
    description: 'Create a tag for your cards.',
    async execute(message) {
        const args = message.content.split(' ');
        if (args.length < 3) return message.channel.send('Usage: !createtag tagName emoji');
        const tagName = args[1];
        const emoji = args[2];
        await pool.execute(
            'INSERT IGNORE INTO user_tags (user_id, tag_name, emoji) VALUES (?, ?, ?)',
            [message.author.id, tagName, emoji]
        );
        message.channel.send(`Tag "${tagName}" ${emoji} created!`);
    }
};