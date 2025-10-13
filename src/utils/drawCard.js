const { createCanvas, loadImage } = require('canvas');

async function drawCard(cardImageUrl, characterName, printNumber) {
    const width = 225, height = 350;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    try {
        const cardImg = await loadImage(cardImageUrl);
        ctx.drawImage(cardImg, 0, 0, width, height);
    } catch (e) {
        ctx.fillStyle = '#888';
        ctx.fillRect(0, 0, width, height);
    }

    const printBoxW = 44, printBoxH = 32;
    ctx.fillStyle = 'rgba(255,255,255,0)';
    ctx.fillRect(0, 0, printBoxW, printBoxH);

    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    ctx.lineWidth = 4;
    ctx.strokeStyle = '#000';
    ctx.strokeText(printNumber, 10, printBoxH / 2);
    ctx.fillStyle = '#fff';
    ctx.fillText(printNumber, 10, printBoxH / 2);

    let fontSize = 28;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    function wrapText(text, maxWidth) {
        let words = text.split(' ');
        let lines = [];
        let line = '';
        for (let i = 0; i < words.length; i++) {
            let testLine = line ? line + ' ' + words[i] : words[i];
            ctx.font = `bold ${fontSize}px Arial`;
            let testWidth = ctx.measureText(testLine).width;
            if (testWidth > maxWidth && line) {
                lines.push(line);
                line = words[i];
            } else {
                line = testLine;
            }
        }
        lines.push(line);
        return lines;
    }
    let lines = wrapText(characterName, width - 20);
    while (lines.length > 2 && fontSize > 14) {
        fontSize -= 2;
        lines = wrapText(characterName, width - 20);
    }

    if (lines.length > 2) {
        lines = lines.slice(0, 2);
        let last = lines[1];
        while (ctx.measureText(last + '...').width > width - 20 && last.length > 0) {
            last = last.slice(0, -1);
        }
        lines[1] = last + '...';
    }

    const lineHeight = fontSize + 4;
    const nameBoxHeight = lineHeight * lines.length + 8;
    ctx.fillStyle = 'rgba(255,255,255,0)';
    ctx.fillRect(0, height - nameBoxHeight, width, nameBoxHeight);

    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#000';
    ctx.fillStyle = '#fff';
    for (let i = 0; i < lines.length; i++) {
        const y = height - nameBoxHeight + lineHeight / 2 + i * lineHeight;
        ctx.strokeText(lines[i], width / 2, y);
        ctx.fillText(lines[i], width / 2, y);
    }

    return canvas.toBuffer();
}

module.exports = drawCard;