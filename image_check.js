const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, 'mobile', 'assets');
const files = fs.readdirSync(assetsDir);

console.log('--- IMAGE DIAGNOSTIC ---');

files.forEach(file => {
  const filePath = path.join(assetsDir, file);
  if (fs.lstatSync(filePath).isDirectory()) return;

  const buffer = Buffer.alloc(8);
  const fd = fs.openSync(filePath, 'r');
  fs.readSync(fd, buffer, 0, 8, 0);
  fs.closeSync(fd);

  const hex = buffer.toString('hex').toUpperCase();
  let type = 'UNKNOWN';
  
  if (hex.startsWith('89504E47')) type = 'PNG (Valid Header)';
  else if (hex.startsWith('FFD8FF')) type = 'JPEG (Valid Header)';
  else if (hex.startsWith('47494638')) type = 'GIF (Valid Header)';
  else if (hex.startsWith('424D')) type = 'BMP (Valid Header)';

  console.log(`${file}: ${type} | Header: ${hex}`);
  
  if (file.endsWith('.png') && !hex.startsWith('89504E47')) {
    console.log(`!! ERROR: ${file} is named .png but is NOT a PNG file !!`);
  }
});
