const { Jimp } = require('jimp');

async function createAppIcons() {
  try {
    console.log('🎨 Creating app icons with colored background...\n');

    // Read the original logo
    const logo = await Jimp.read('public/fmb-logo.png');
    console.log(`Original logo size: ${logo.width}×${logo.height}`);

    // Forest green background color (matching theme)
    const bgColor = 0x3c7441ff; // #3c7441 with full opacity

    // Create 192×192 icon with background
    console.log('\n📐 Creating 192×192 icon...');
    const size192 = 192;
    const canvas192 = new Jimp({ width: size192, height: size192, color: bgColor });

    // Calculate scaling to fit logo
    const logoAspect = logo.width / logo.height;
    let scaledWidth = Math.floor(size192 * 0.75);
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
    console.log('✓ Created public/fmb-logo-192.png (192×192 with forest green bg)');

    // Create 512×512 icon with background
    console.log('\n📐 Creating 512×512 icon...');
    const size512 = 512;
    const canvas512 = new Jimp({ width: size512, height: size512, color: bgColor });

    scaledWidth = Math.floor(size512 * 0.75);
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
    console.log('✓ Created public/fmb-logo-512.png (512×512 with forest green bg)');

    // Create maskable versions for Android adaptive icons
    console.log('\n📐 Creating maskable icon variants...');

    // 192x192 maskable (slightly larger logo to fill the safe zone)
    const canvas192m = new Jimp({ width: size192, height: size192, color: bgColor });
    scaledWidth = Math.floor(size192 * 0.85);
    scaledHeight = Math.floor(scaledWidth / logoAspect);

    const scaled192m = logo.clone().resize({ w: scaledWidth, h: scaledHeight });
    const x192m = Math.floor((size192 - scaledWidth) / 2);
    const y192m = Math.floor((size192 - scaledHeight) / 2);

    for (let y = 0; y < scaled192m.height; y++) {
      for (let x = 0; x < scaled192m.width; x++) {
        const pixel = scaled192m.getPixelColor(x, y);
        canvas192m.setPixelColor(pixel, x192m + x, y192m + y);
      }
    }

    await canvas192m.write('public/fmb-logo-192-maskable.png');
    console.log('✓ Created public/fmb-logo-192-maskable.png (maskable variant)');

    // 512x512 maskable
    const canvas512m = new Jimp({ width: size512, height: size512, color: bgColor });
    scaledWidth = Math.floor(size512 * 0.85);
    scaledHeight = Math.floor(scaledWidth / logoAspect);

    const scaled512m = logo.clone().resize({ w: scaledWidth, h: scaledHeight });
    const x512m = Math.floor((size512 - scaledWidth) / 2);
    const y512m = Math.floor((size512 - scaledHeight) / 2);

    for (let y = 0; y < scaled512m.height; y++) {
      for (let x = 0; x < scaled512m.width; x++) {
        const pixel = scaled512m.getPixelColor(x, y);
        canvas512m.setPixelColor(pixel, x512m + x, y512m + y);
      }
    }

    await canvas512m.write('public/fmb-logo-512-maskable.png');
    console.log('✓ Created public/fmb-logo-512-maskable.png (maskable variant)');

    console.log('\n✅ App icons created successfully!');
    console.log('   - fmb-logo-192.png (192×192 with green background)');
    console.log('   - fmb-logo-512.png (512×512 with green background)');
    console.log('   - fmb-logo-192-maskable.png (maskable variant)');
    console.log('   - fmb-logo-512-maskable.png (maskable variant)');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createAppIcons();
