const fs = require('fs');
const path = require('path');
const { BlobServiceClient, StorageSharedKeyCredential } = require('@azure/storage-blob');

// Load environment variables from .env file
require('dotenv').config();

const SONGS_DIR = path.join(__dirname, 'songs');
const OUTPUT_FILE = path.join(__dirname, 'songs.json');
const SUPPORTED_EXTENSIONS = ['.m4a', '.mp3', '.ogg', '.wav'];

// ─── AZURE CONFIGURATION ───────────────────────────────────────────
const AZURE_ACCOUNT_NAME = 'sydspotifystorage';
const AZURE_CONTAINER_NAME = 'songs';

// Load key securely from environment variable
const AZURE_STORAGE_KEY = process.env.AZURE_STORAGE_KEY; 

const AZURE_BASE_URL = `https://${AZURE_ACCOUNT_NAME}.blob.core.windows.net/${AZURE_CONTAINER_NAME}`;

async function buildPlaylistRegistry() {
    console.log("Initializing registry build...");
    const registry = {
        "Library": [] // Root level songs
    };

    if (!AZURE_STORAGE_KEY) {
        console.warn("WARNING: AZURE_STORAGE_KEY environment variable is missing. Skipping Azure Cloud fetch.");
    } else {
        // ─── 1. FETCH CLOUD TRACKS FROM AZURE CONTAINER ──────────────────
        try {
            console.log(`Connecting to Azure container: "${AZURE_CONTAINER_NAME}"...`);
            const credential = new StorageSharedKeyCredential(AZURE_ACCOUNT_NAME, AZURE_STORAGE_KEY);
            const blobServiceClient = new BlobServiceClient(
                `https://${AZURE_ACCOUNT_NAME}.blob.core.windows.net`,
                credential
            );
            const containerClient = blobServiceClient.getContainerClient(AZURE_CONTAINER_NAME);

            let count = 0;
            // List all files inside the public songs container
            for await (const blob of containerClient.listBlobsFlat()) {
                const ext = path.extname(blob.name).toLowerCase();
                if (SUPPORTED_EXTENSIONS.includes(ext)) {
                    // Deduce playlist structure from path segments (e.g. "Chill/song.mp3")
                    const pathSegments = blob.name.split('/');
                    let currentPlaylistName = "Library";
                    
                    if (pathSegments.length > 1) {
                        currentPlaylistName = pathSegments[0]; // First folder level is the playlist name
                    }

                    if (!registry[currentPlaylistName]) {
                        registry[currentPlaylistName] = [];
                    }

                    const cleanTitle = pathSegments[pathSegments.length - 1]
                        .replace(ext, '')
                        .replace(/[_-]/g, ' ');

                    // Generate public stream URL
                    const urlSafePath = pathSegments.map(seg => encodeURIComponent(seg)).join('/');
                    const azureUrl = `${AZURE_BASE_URL}/${urlSafePath}`;

                    registry[currentPlaylistName].push({
                        title: cleanTitle + " (Cloud)",
                        url: azureUrl,
                        localUrl: null, // Cloud-only
                        fileName: pathSegments[pathSegments.length - 1]
                    });
                    count++;
                }
            }
            console.log(`Successfully mapped ${count} songs from Azure Cloud.`);
        } catch (err) {
            console.warn("Could not fetch from Azure. (Verify your credentials & network):", err.message);
        }
    }

    // ─── 2. SCAN LOCAL PATHS FOR GITHUB TESTING FILES ────────────────
    if (fs.existsSync(SONGS_DIR)) {
        console.log("Scanning local directory for testing files...");
        
        function scanLocalDir(dirPath, currentPlaylistName) {
            const items = fs.readdirSync(dirPath, { withFileTypes: true });

            for (const item of items) {
                const fullPath = path.join(dirPath, item.name);
                
                if (item.isDirectory()) {
                    const playlistName = item.name;
                    if (!registry[playlistName]) {
                        registry[playlistName] = [];
                    }
                    scanLocalDir(fullPath, playlistName);
                } else if (item.isFile()) {
                    const ext = path.extname(item.name).toLowerCase();
                    if (SUPPORTED_EXTENSIONS.includes(ext)) {
                        const relativePath = path.relative(SONGS_DIR, fullPath).replace(/\\/g, '/');
                        const cleanTitle = item.name.replace(ext, '').replace(/[_-]/g, ' ');
                        const localUrl = `songs/${relativePath}`;

                        // Ensure we don't list duplicates if they are in both places
                        const isAlreadyRegistered = registry[currentPlaylistName].some(
                            song => song.fileName === item.name
                        );

                        if (!isAlreadyRegistered) {
                            registry[currentPlaylistName].push({
                                title: cleanTitle + " (Local)",
                                url: localUrl, // Points directly to local GitHub path
                                localUrl: localUrl,
                                fileName: item.name
                            });
                        } else {
                            // If it exists in both, attach local path as backup on the cloud entry
                            const existingTrack = registry[currentPlaylistName].find(
                                song => song.fileName === item.name
                            );
                            if (existingTrack) {
                                existingTrack.localUrl = localUrl;
                            }
                        }
                    }
                }
            }
        }
        scanLocalDir(SONGS_DIR, "Library");
    }

    // Clean up empty registry categories
    for (const key in registry) {
        if (registry[key].length === 0 && key !== "Library") {
            delete registry[key];
        }
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(registry, null, 2), 'utf-8');
    console.log(`Registry compiled successfully inside ${OUTPUT_FILE}`);
}

buildPlaylistRegistry();