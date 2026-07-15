const fs = require('fs');
const path = require('path');

const songsDir = path.join(__dirname, 'songs');
const publicDir = path.join(__dirname, 'public');
const destSongsDir = path.join(publicDir, 'songs');

try {
  // 1. Create the public output directory if it doesn't exist
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // 2. Copy index.html into the public directory for Vercel
  const indexSrc = path.join(__dirname, 'index.html');
  const indexDest = path.join(publicDir, 'index.html');
  if (fs.existsSync(indexSrc)) {
    fs.copyFileSync(indexSrc, indexDest);
  } else {
    console.error("Error: index.html not found in root directory!");
    process.exit(1);
  }

  // 3. Scan the source songs folder and copy assets
  if (fs.existsSync(songsDir)) {
    if (!fs.existsSync(destSongsDir)) {
      fs.mkdirSync(destSongsDir, { recursive: true });
    }

    const files = fs.readdirSync(songsDir);
    const m4aFiles = files.filter(file => file.toLowerCase().endsWith('.m4a'));

    // Copy each .m4a file to public/songs/ for Vercel
    m4aFiles.forEach(file => {
      fs.copyFileSync(path.join(songsDir, file), path.join(destSongsDir, file));
    });

    // Write songs.json to the ROOT directory (so local Python servers continue working)
    fs.writeFileSync(path.join(__dirname, 'songs.json'), JSON.stringify(m4aFiles, null, 2));

    // Write songs.json to the PUBLIC directory (for Vercel deployment)
    fs.writeFileSync(path.join(publicDir, 'songs.json'), JSON.stringify(m4aFiles, null, 2));

    console.log(`Successfully bundled ${m4aFiles.length} songs for Vercel deployment.`);
  } else {
    console.warn("Warning: 'songs/' directory not found. Creating empty playlist configurations.");
    fs.writeFileSync(path.join(__dirname, 'songs.json'), JSON.stringify([]));
    fs.writeFileSync(path.join(publicDir, 'songs.json'), JSON.stringify([]));
  }
} catch (err) {
  console.error("Build failed during bundling:", err);
  process.exit(1);
}