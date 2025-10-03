const { createCanvas, loadImage } = require('canvas');

/**
 * Draws a card image with the character name in the bottom box and print number in the top-left box.
 * @param {string} cardImageUrl - The URL of the character/card image.
 * @param {string} characterName - The character's name to display.
 * @param {string|number} printNumber - The print number to display.
 * @returns {Promise<Buffer>} - The image buffer.
 */
async function drawCard(cardImageUrl, characterName, printNumber) {
    const width = 300, height = 400;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Draw card border/frame
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, width, height);

    // Draw main card image area (with padding)
    const imgArea = { x: 10, y: 10, w: width - 20, h: height - 80 };
    try {
        const cardImg = await loadImage(cardImageUrl);
        ctx.drawImage(cardImg, imgArea.x, imgArea.y, imgArea.w, imgArea.h);
    } catch (e) {
        // If image fails to load, fill with gray
        ctx.fillStyle = '#888';
        ctx.fillRect(imgArea.x, imgArea.y, imgArea.w, imgArea.h);
    }

    // Draw bottom box for character name
    ctx.fillStyle = '#fff8dc';
    ctx.fillRect(0, height - 60, width, 60);
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, height - 60, width, 60);

    ctx.font = 'bold 28px Arial';
    ctx.fillStyle = '#222';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(characterName, width / 2, height - 30);

    // Draw top-left box for print number
    ctx.fillStyle = '#fff8dc';
    ctx.fillRect(0, 0, 70, 40);
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, 70, 40);

    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = '#222';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(printNumber, 10, 20);

    return canvas.toBuffer();
}

module.exports = drawCard;