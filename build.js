const fs = require('fs');
const path = require('path');

const songsDir = path.join(__dirname, 'songs');
const outputFile = path.join(__dirname, 'songs.json');

try {
  if (fs.existsSync(songsDir)) {
    const files = fs.readdirSync(songsDir);
    // Filter only .m4a files
    const songs = files.filter(file => file.toLowerCase().endsWith('.m4a'));
    
    fs.writeFileSync(outputFile, JSON.stringify(songs, null, 2));
    console.log(`Successfully generated songs.json with ${songs.length} tracks.`);
  } else {
    console.warn("Warning: 'songs/' directory not found. Creating empty list.");
    fs.writeFileSync(outputFile, JSON.stringify([]));
  }
} catch (err) {
  console.error("Error scanning songs directory:", err);
  process.exit(1);
}