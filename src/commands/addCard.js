const pool = require('../utils/mysql');

async function addCard(card) {
    const sql = 'INSERT INTO cards (name, series, image, rarity) VALUES (?, ?, ?, ?)';
    const [result] = await pool.execute(sql, [
        card.name,
        card.series,
        card.image,
        card.rarity || null
    ]);
    console.log('Card added with ID:', result.insertId);
}

addCard({
    name: "Ichigo Kurosaki",
    series: "Bleach",
    image: "https://cdn.discordapp.com/attachments/1422311970379530462/1422567523055964231/ichigo.png?ex=68dd24bf&is=68dbd33f&hm=2aba55f585537ec4876e31056b0f75d7122a64422b7f8d2354a01828d6375011&",
    rarity: "N"
});

addCard({
    name: "Grimmjow Jaegerjaquez",
    series: "Bleach",
    image: "https://cdn.discordapp.com/attachments/1422311970379530462/1422567522682798143/grimmjow.png?ex=68dd24bf&is=68dbd33f&hm=dbe2731e3e342e10cbe302be89586b2bbf82de1cc2dc233e1a1d71506e926214&",
    rarity: "N"
});

addCard({
    name: "Rukia Kuchiki",
    series: "Bleach",
    image: "https://cdn.discordapp.com/attachments/1422311970379530462/1422567523764928583/rukia.png?ex=68dd24bf&is=68dbd33f&hm=877ab6cb6c9185ed0700beb369094410e745de3d191a7ba6debcbdea5ff74e08&",
    rarity: "N"
});