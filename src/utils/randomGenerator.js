const pool = require('./mysql');

async function getRandomCards(count) {
    const sql = `SELECT * FROM cards ORDER BY RAND() LIMIT ${parseInt(count, 10)}`;
    const [rows] = await pool.execute(sql);
    const unique = [];
    const seen = new Set();
    for (const card of rows) {
        if (!seen.has(card.id)) {
            unique.push(card);
            seen.add(card.id);
        }
        if (unique.length === count) break;
    }
    return unique;
}

module.exports = { getRandomCards };