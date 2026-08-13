const { Jimp } = require('jimp');

async function createSquareIcons() {
  try {
    console.log('📦 Creating square PNG icons...\n');

    // Read the original logo
    const logo = await Jimp.read('public/fmb-logo.png');
    console.log(`Original logo size: ${logo.width}×${logo.height}`);

    // Create 192×192 icon
    console.log('\n📐 Creating 192×192 icon...');
    const size192 = 192;
    const canvas192 = new Jimp({ width: size192, height: size192, color: 0xFFFFFFFF });

    // Calculate scaling
    const logoAspect = logo.width / logo.height;
    let scaledWidth = Math.floor(size192 * 0.85);
    let scaledHeight = Math.floor(scaledWidth / logoAspect);

    const scaled192 = logo.clone().resize({ w: scaledWidth, h: scaledHeight });
    const x192 = Math.floor((size192 - scaledWidth) / 2);
    const y192 = Math.floor((size192 - scaledHeight) / 2);

    for (let y = 0; y < scaled192.height; y++) {
      for (let x = 0; x < scaled192.width; x++) {
        const pixel = scaled192.getPixelColor(x, y);
        canvas192.setPixelColor(pixel, x192 + x, y192 + y);
      }
    }

    await canvas192.write('public/fmb-logo-192.png');
    console.log('✓ Created public/fmb-logo-192.png (192×192)');

    // Create 512×512 icon
    console.log('\n📐 Creating 512×512 icon...');
    const size512 = 512;
    const canvas512 = new Jimp({ width: size512, height: size512, color: 0xFFFFFFFF });

    scaledWidth = Math.floor(size512 * 0.85);
    scaledHeight = Math.floor(scaledWidth / logoAspect);

    const scaled512 = logo.clone().resize({ w: scaledWidth, h: scaledHeight });
    const x512 = Math.floor((size512 - scaledWidth) / 2);
    const y512 = Math.floor((size512 - scaledHeight) / 2);

    for (let y = 0; y < scaled512.height; y++) {
      for (let x = 0; x < scaled512.width; x++) {
        const pixel = scaled512.getPixelColor(x, y);
        canvas512.setPixelColor(pixel, x512 + x, y512 + y);
      }
    }

    await canvas512.write('public/fmb-logo-512.png');
    console.log('✓ Created public/fmb-logo-512.png (512×512)');

    console.log('\n✅ Square PNG icons created successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createSquareIcons();
