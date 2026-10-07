const fs = require('fs');
const PNG = require('pngjs').PNG;
const pixelmatchModule = require('pixelmatch');
const pixelmatch = pixelmatchModule.default || pixelmatchModule;

function compare(file1, file2, diffFile) {
    const img1 = PNG.sync.read(fs.readFileSync(file1));
    const img2 = PNG.sync.read(fs.readFileSync(file2));
    const { width, height } = img1;
    const diff = new PNG({ width, height });

    const numDiffPixels = pixelmatch(img1.data, img2.data, diff.data, width, height, { threshold: 0.1 });
    const totalPixels = width * height;
    const mismatchPercent = (numDiffPixels / totalPixels * 100).toFixed(2);
    const similarity = (100 - mismatchPercent).toFixed(2);

    fs.writeFileSync(diffFile, PNG.sync.write(diff));
    console.log(`Comparison ${file1} vs ${file2}:`);
    console.log(`  Total pixels: ${totalPixels}`);
    console.log(`  Diff pixels: ${numDiffPixels}`);
    console.log(`  Diff percent: ${mismatchPercent}%`);
    console.log(`  Similarity: ${similarity}%`);
    return { totalPixels, numDiffPixels, mismatchPercent, similarity };
}

console.log('=== Desktop Diff ===');
compare('target_desktop.png', 'replica_desktop.png', 'diff_desktop.png');

console.log('\n=== Mobile Diff ===');
compare('target_mobile.png', 'replica_mobile.png', 'diff_mobile.png');

