const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, 'mobile', 'assets');
const files = fs.readdirSync(assetsDir);

// Install jimp temporarily
console.log('Preparing conversion tool...');

files.forEach(file => {
  if (file.endsWith('.png')) {
    const filePath = path.join(assetsDir, file);
    if (fs.lstatSync(filePath).isDirectory()) return;

    // Check if it's actually a JPEG
    const buffer = Buffer.alloc(3);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 3, 0);
    fs.closeSync(fd);

    if (buffer.toString('hex').toUpperCase() === 'FFD8FF') {
      console.log(`Converting ${file} from JPEG to true PNG...`);
      try {
        // Use npx to run jimp without permanent install
        execSync(`npx -y jimp "${filePath}" -o "${filePath}"`, { stdio: 'inherit' });
      } catch (err) {
        console.error(`Failed to convert ${file}:`, err.message);
      }
    }
  }
});

console.log('Conversion complete!');
