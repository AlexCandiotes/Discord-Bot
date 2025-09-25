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
    name: "Trailblazer Male",
    series: "Honkai: Star Rail",
    image: "https://raw.githubusercontent.com/yourusername/yourrepo/main/images/TrailblazerMale.jpg",
    description: "The protagonist who travels across worlds on the Astral Express.",
    rarity: "R"
});

addCard({
    name: "Trailblazer Female",
    series: "Honkai: Star Rail",
    image: "https://raw.githubusercontent.com/yourusername/yourrepo/main/images/TrailblazerFemale.jpg",
    description: "The female protagonist who travels across worlds on the Astral Express.",
    rarity: "R"
});

addCard({
    name: "March 7th",
    series: "Honkai: Star Rail",
    image: "https://raw.githubusercontent.com/yourusername/yourrepo/main/images/March7th.jpg",
    description: "A cheerful girl with a mysterious past, wielding an ice bow.",
    rarity: "R"
});