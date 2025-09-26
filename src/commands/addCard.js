const pool = require('../utils/mysql');

async function addCard(card) {
    const sql = 'INSERT INTO cards (name, series, image, description, rarity) VALUES (?, ?, ?, ?, ?)';
    const [result] = await pool.execute(sql, [
        card.name,
        card.series,
        card.image,
        card.description,
        card.rarity || null
    ]);
    console.log('Card added with ID:', result.insertId);
}

addCard({
    name: "Marin Kitagawa",
    series: "My Dress-Up Darling",
    image: "https://raw.githubusercontent.com/AlexCandiotes/Discord-Bot/main/images/lr_cards/Marin_Kitagawa.gif",
    description: "The high school gyaru who lives boldly and pours her heart into cosplay.",
    rarity: "LR"
});