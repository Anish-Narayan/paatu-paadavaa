const fs = require('fs');
const path = require('path');

const SONGS_DIR = path.join(__dirname, 'songs');
const OUTPUT_FILE = path.join(__dirname, 'songs.json');

// Supported audio extensions
const SUPPORTED_EXTENSIONS = ['.m4a', '.mp3', '.ogg', '.wav'];

function buildPlaylistRegistry() {
    if (!fs.existsSync(SONGS_DIR)) {
        console.log(`Creating directory: ${SONGS_DIR}`);
        fs.mkdirSync(SONGS_DIR);
    }

    const registry = {
        "Library": [] // Root level songs
    };

    function scanDir(dirPath, currentPlaylistName) {
        const items = fs.readdirSync(dirPath, { withFileTypes: true });

        for (const item of items) {
            const fullPath = path.join(dirPath, item.name);
            
            if (item.isDirectory()) {
                // Directories inside songs/ represent distinct playlists
                const playlistName = item.name;
                if (!registry[playlistName]) {
                    registry[playlistName] = [];
                }
                scanDir(fullPath, playlistName);
            } else if (item.isFile()) {
                const ext = path.extname(item.name).toLowerCase();
                if (SUPPORTED_EXTENSIONS.includes(ext)) {
                    // Calculate relative path inside songs/ directory
                    const relativePath = path.relative(SONGS_DIR, fullPath).replace(/\\/g, '/');
                    const cleanTitle = item.name.replace(ext, '').replace(/[_-]/g, ' ');
                    
                    const songData = {
                        title: cleanTitle,
                        url: `songs/${relativePath}`,
                        fileName: item.name
                    };

                    registry[currentPlaylistName].push(songData);
                }
            }
        }
    }

    scanDir(SONGS_DIR, "Library");

    // Clean up empty folders in registry
    for (const key in registry) {
        if (registry[key].length === 0 && key !== "Library") {
            delete registry[key];
        }
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(registry, null, 2), 'utf-8');
    console.log(`Registry built successfully. Found ${Object.keys(registry).length} playlists written to ${OUTPUT_FILE}`);
}

buildPlaylistRegistry();