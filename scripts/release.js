const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const packageJson = require('../package.json');

const version = packageJson.version;
const buildDir = path.join(__dirname, '..', 'build', 'chat-copilot');
const outputZip = path.join(__dirname, '..', 'build', `chat-copilot-${version}.zip`);

// Check if build directory exists
if (!fs.existsSync(buildDir)) {
  console.error(`Build directory does not exist: ${buildDir}`);
  console.error('Please run "npm run build" first');
  process.exit(1);
}

console.log(`Creating release package: chat-copilot-${version}.zip`);

// Create a file to stream archive data to
const output = fs.createWriteStream(outputZip);
const archive = archiver('zip', {
  zlib: { level: 9 } // Maximum compression
});

// Listen for all archive data to be written
output.on('close', () => {
  const MB = (archive.pointer() / 1024 / 1024).toFixed(2);
  console.log(`Successfully created release package: chat-copilot-${version}.zip`);
  console.log(`Total size: ${MB} MB (${archive.pointer()} bytes)`);
});

// Handle warnings
archive.on('warning', (err) => {
  if (err.code === 'ENOENT') {
    console.warn('Archive warning:', err);
  } else {
    throw err;
  }
});

// Handle errors
archive.on('error', (err) => {
  console.error('Archive error:', err);
  process.exit(1);
});

// Pipe archive data to the file
archive.pipe(output);

// Add entire build directory to archive
archive.directory(buildDir, false);

// Finalize the archive
archive.finalize();
