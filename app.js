const audio = new Audio();
let playlistGroups = {}; // Folder mapped songs: { "Library": [...], "Chill": [...] }
let activePlaylistName = "Library";
let currentPlaylistSongs = [];
let currentIndex = -1;

// History Stack to back-track through played songs properly
let playbackHistory = [];

// Non-repeating Shuffle Registry
let isShuffle = false;
let isRepeat = false;
let shuffleQueue = [];
let previousVolume = 0.8;

// DOM References - Standard Theme UI
const wrapperEl = document.getElementById('app-wrapper');
const playlistTabs = document.getElementById('playlist-tabs');
const songsList = document.getElementById('songs-list');
const jumboTitle = document.getElementById('jumbo-title');
const jumboSubtitle = document.getElementById('jumbo-subtitle');
const currentPlaylistLabel = document.getElementById('current-playlist-label');
const playerTrackName = document.getElementById('player-track-name');
const progressBar = document.getElementById('progress-bar');
const volumeBar = document.getElementById('volume-bar');
const timeCurrent = document.getElementById('time-current');
const timeDuration = document.getElementById('time-duration');

const btnPlayPause = document.getElementById('btn-play-pause');
const playIcon = document.getElementById('play-icon');
const pauseIcon = document.getElementById('pause-icon');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const btnShuffle = document.getElementById('btn-shuffle');
const btnRepeat = document.getElementById('btn-repeat');
const btnMute = document.getElementById('btn-mute');
const volumeIcon = document.getElementById('volume-icon');
const muteIcon = document.getElementById('mute-icon');

// DOM References - Excel Theme UI Controls
const btnCorporate = document.getElementById('btn-corporate');
const btnStandardView = document.getElementById('btn-standard-view');
const excelCloseToStandard = document.getElementById('excel-close-to-standard');
const excelGridBody = document.getElementById('excel-grid-body');
const excelSheetTabs = document.getElementById('excel-sheet-tabs');
const excelFormulaInput = document.getElementById('excel-formula-input');
const excelAddressBox = document.getElementById('excel-address-box');
const excelRunningStat = document.getElementById('excel-running-stat');
const excelZoomLabel = document.getElementById('excel-zoom-label');
const excelZoomSlider = document.getElementById('excel-zoom-slider');

const excelBtnPlay = document.getElementById('excel-btn-play');
const excelPlaySymbol = document.getElementById('excel-play-symbol');
const excelPlayText = document.getElementById('excel-play-text');
const excelBtnPrev = document.getElementById('excel-btn-prev');
const excelBtnNext = document.getElementById('excel-btn-next');
const excelBtnShuffle = document.getElementById('excel-btn-shuffle');
const excelBtnRepeat = document.getElementById('excel-btn-repeat');

async function init() {
    try {
        const response = await fetch('./songs.json');
        if (!response.ok) {
            throw new Error("Could not find songs.json. Running build.js first is required.");
        }
        playlistGroups = await response.json();
        
        // Ensure standard "Library" key fallback
        if (!playlistGroups["Library"]) {
            playlistGroups["Library"] = [];
        }

        const folders = Object.keys(playlistGroups);
        if (folders.length === 0 || (folders.length === 1 && playlistGroups["Library"].length === 0)) {
            const noSongsMsg = `<div class="empty-state">No audio files located.<br>Place media files inside <code>songs/</code> directories and execute <code>node build.js</code></div>`;
            songsList.innerHTML = noSongsMsg;
            excelGridBody.innerHTML = `<tr><td colspan="7" class="loading">No local audit log files parsed. Run build configuration.</td></tr>`;
            return;
        }

        // Initialize display with the first available folder/playlist
        activePlaylistName = folders.includes("Library") && playlistGroups["Library"].length > 0 ? "Library" : folders[0];
        currentPlaylistSongs = playlistGroups[activePlaylistName];

        renderPlaylistsUI();
        loadPlaylist(activePlaylistName, false);
        
        updateSliderBackground(progressBar);
        updateSliderBackground(volumeBar);
    } catch (err) {
        console.error(err);
        songsList.innerHTML = `<div class="empty-state">Load configuration error. Ensure JSON index was properly constructed via building logs.</div>`;
    }
}

// Render playlist lists inside sidebar and sheets tabs inside Spreadsheet View
function renderPlaylistsUI() {
    playlistTabs.innerHTML = '';
    excelSheetTabs.innerHTML = '';

    Object.keys(playlistGroups).forEach(playlistName => {
        const songCount = playlistGroups[playlistName].length;
        if (songCount === 0) return;

        // 1. Standard Sidebar UI Item
        const item = document.createElement('div');
        item.className = 'playlist-item';
        if (playlistName === activePlaylistName) item.classList.add('active');
        item.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="opacity: 0.8;"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12z"/></svg>
            <span>${playlistName}</span>
        `;
        item.addEventListener('click', () => loadPlaylist(playlistName));
        playlistTabs.appendChild(item);

        // 2. Disguised Spreadsheet Tab UI Item
        const sheetTab = document.createElement('div');
        sheetTab.className = 'excel-tab-item';
        if (playlistName === activePlaylistName) sheetTab.classList.add('active');
        sheetTab.textContent = playlistName;
        sheetTab.addEventListener('click', () => loadPlaylist(playlistName));
        excelSheetTabs.appendChild(sheetTab);
    });
}

function loadPlaylist(playlistName, autoPlayFirst = false) {
    activePlaylistName = playlistName;
    currentPlaylistSongs = playlistGroups[playlistName] || [];
    shuffleQueue = []; // Clear shuffle rules on context switch

    // Refresh active UI classes
    document.querySelectorAll('.playlist-item').forEach(el => {
        el.classList.toggle('active', el.textContent.trim() === playlistName);
    });
    document.querySelectorAll('.excel-tab-item').forEach(el => {
        el.classList.toggle('active', el.textContent.trim() === playlistName);
    });

    currentPlaylistLabel.textContent = playlistName.toUpperCase();
    
    renderSongsTable();
    
    if (currentPlaylistSongs.length > 0) {
        loadTrack(0, autoPlayFirst);
    } else {
        jumboTitle.textContent = "No Track Available";
        jumboSubtitle.textContent = "Playlist is empty";
    }
}

// Generate the standard layout table rows and disguise sheet cells
function renderSongsTable() {
    songsList.innerHTML = '';
    excelGridBody.innerHTML = '';

    currentPlaylistSongs.forEach((song, idx) => {
        // A. Modern Song Row Item
        const row = document.createElement('div');
        row.className = 'song-row';
        if (idx === currentIndex) row.classList.add('active');
        row.innerHTML = `
            <span class="row-index">${idx + 1}</span>
            <span class="row-title">${song.title}</span>
            <span class="row-source">${song.url}</span>
        `;
        row.addEventListener('click', () => loadTrack(idx, true));
        songsList.appendChild(row);

        // B. Stealth Row Item styled as an Excel process/audit log entry
        const excelRow = document.createElement('tr');
        excelRow.setAttribute('data-index', idx);
        if (idx === currentIndex) excelRow.classList.add('active');
        
        excelRow.innerHTML = `
            <td class="row-num-col">${idx + 1}</td>
            <td>LOG_ID_${1000 + idx}</td>
            <td class="excel-status-cell ${idx === currentIndex ? 'excel-status-playing' : 'excel-status-idle'}">
                ${idx === currentIndex ? (audio.paused ? 'PAUSED' : 'RUNNING') : 'READY'}
            </td>
            <td><strong>${song.title}</strong></td>
            <td>--</td> <!-- Updated on meta-load -->
            <td>${activePlaylistName}</td>
            <td style="color: #666; font-family: monospace; font-size: 8.5pt;">file:///${song.url}</td>
        `;

        // Selection actions mimicking spreadsheets cell clicks
        excelRow.addEventListener('click', (e) => {
            document.querySelectorAll('#excel-grid-body tr').forEach(r => r.classList.remove('active'));
            excelRow.classList.add('active');
            excelAddressBox.textContent = `C${idx + 3}`; // Map to cell coordinates
            updateFormulaBarValue(song.title, "READY");
        });

        // Double-click to execute/play track from spreadsheet
        excelRow.addEventListener('dblclick', () => {
            loadTrack(idx, true);
        });

        excelGridBody.appendChild(excelRow);
    });

    // Pad Excel sheet visual mockup with fake empty cell rows
    const minPaddingRows = 15;
    const currentLength = currentPlaylistSongs.length;
    if (currentLength < minPaddingRows) {
        for (let i = currentLength; i < minPaddingRows; i++) {
            const padRow = document.createElement('tr');
            padRow.innerHTML = `
                <td class="row-num-col">${i + 1}</td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
            `;
            excelGridBody.appendChild(padRow);
        }
    }
}

// Generate complete track shuffle registry preventing repetitions
function initializeShuffleQueue() {
    const totalCount = currentPlaylistSongs.length;
    shuffleQueue = Array.from({ length: totalCount }, (_, i) => i);
    
    // Fisher-Yates Shuffling Algorithm
    for (let i = totalCount - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffleQueue[i], shuffleQueue[j]] = [shuffleQueue[j], shuffleQueue[i]];
    }

    // Avoid immediate self-repetition on starting if multiple options exist
    if (shuffleQueue.length > 1 && shuffleQueue[0] === currentIndex) {
        shuffleQueue.push(shuffleQueue.shift());
    }
}

function loadTrack(index, shouldPlay = true) {
    if (index < 0 || index >= currentPlaylistSongs.length) return;
    
    // Update track index registers
    if (currentIndex !== -1 && currentIndex !== index) {
        playbackHistory.push(currentIndex);
    }
    currentIndex = index;
    const track = currentPlaylistSongs[currentIndex];

    audio.src = track.url;
    audio.load();

    // Standard DOM layout updates
    document.querySelectorAll('.song-row').forEach((row, idx) => {
        row.classList.toggle('active', idx === currentIndex);
    });

    // Excel grid selection highlights
    document.querySelectorAll('#excel-grid-body tr').forEach((row, idx) => {
        row.classList.toggle('active', idx === currentIndex);
        const statusCell = row.querySelector('.excel-status-cell');
        if (statusCell) {
            if (idx === currentIndex) {
                statusCell.className = "excel-status-cell excel-status-playing";
                statusCell.textContent = shouldPlay ? "RUNNING" : "PAUSED";
            } else {
                statusCell.className = "excel-status-cell excel-status-idle";
                statusCell.textContent = "READY";
            }
        }
    });

    // Content Display update
    playerTrackName.textContent = track.title;
    jumboTitle.textContent = track.title;
    jumboSubtitle.textContent = `Node Source: ${activePlaylistName}/${track.fileName}`;

    progressBar.value = 0;
    updateSliderBackground(progressBar);
    timeCurrent.textContent = "0:00";
    timeDuration.textContent = "0:00";

    updateFormulaBarValue(track.title, shouldPlay ? "RUNNING" : "READY");

    if (shouldPlay) {
        playTrack();
    } else {
        pauseTrack();
    }
}

function playTrack() {
    audio.play()
        .then(() => {
            // Icon layout adjustments
            playIcon.style.display = 'none';
            pauseIcon.style.display = 'block';
            excelPlaySymbol.textContent = "⏸";
            excelPlayText.textContent = "Pause Log";
            excelRunningStat.textContent = `Executing Node: ${currentIndex + 1} (${currentPlaylistSongs[currentIndex]?.title})`;
            
            // Adjust status cells labels
            updateActiveExcelRowStatus("RUNNING");
        })
        .catch(err => {
            console.log("Playback interrupted.", err);
        });
}

function pauseTrack() {
    audio.pause();
    playIcon.style.display = 'block';
    pauseIcon.style.display = 'none';
    excelPlaySymbol.textContent = "▶";
    excelPlayText.textContent = "Run Log";
    excelRunningStat.textContent = `Process halted`;
    
    updateActiveExcelRowStatus("PAUSED");
}

function togglePlay() {
    if (audio.paused) {
        playTrack();
    } else {
        pauseTrack();
    }
}

function updateActiveExcelRowStatus(statusStr) {
    const activeRow = excelGridBody.querySelector(`tr[data-index="${currentIndex}"]`);
    if (activeRow) {
        const cell = activeRow.querySelector('.excel-status-cell');
        if (cell) {
            cell.textContent = statusStr;
            cell.className = `excel-status-cell ${statusStr === 'RUNNING' ? 'excel-status-playing' : 'excel-status-paused'}`;
        }
    }
    if (currentPlaylistSongs[currentIndex]) {
        updateFormulaBarValue(currentPlaylistSongs[currentIndex].title, statusStr);
    }
}

function updateFormulaBarValue(songName, statusStr) {
    excelFormulaInput.value = `=PROCESS_AUDIT(NAME="${songName.toUpperCase()}", STATUS="${statusStr}")`;
}

function nextTrack() {
    if (currentPlaylistSongs.length === 0) return;

    if (isShuffle) {
        if (shuffleQueue.length === 0) {
            initializeShuffleQueue();
        }
        // Pull unique random tracks from queue array
        const nextIdx = shuffleQueue.shift();
        loadTrack(nextIdx, true);
    } else {
        let nextIndex = currentIndex + 1;
        if (nextIndex >= currentPlaylistSongs.length) nextIndex = 0;
        loadTrack(nextIndex, true);
    }
}

function prevTrack() {
    if (currentPlaylistSongs.length === 0) return;

    if (playbackHistory.length > 0) {
        // Trace back step sequences properly
        const prevIdx = playbackHistory.pop();
        loadTrack(prevIdx, true);
    } else {
        // Fallback default index sequences
        let prevIndex = currentIndex - 1;
        if (prevIndex < 0) prevIndex = currentPlaylistSongs.length - 1;
        loadTrack(prevIndex, true);
    }
}

function updateSliderBackground(slider) {
    const val = (slider.value - slider.min) / (slider.max - slider.min) * 100;
    slider.style.background = `linear-gradient(to right, #1db954 ${val}%, #535353 ${val}%)`;
}

// Media event updating tracking
audio.addEventListener('timeupdate', () => {
    if (!isNaN(audio.duration)) {
        const progress = (audio.currentTime / audio.duration) * 100;
        progressBar.value = progress;
        updateSliderBackground(progressBar);
        timeCurrent.textContent = formatTime(audio.currentTime);
        timeDuration.textContent = formatTime(audio.duration);
    }
});

audio.addEventListener('loadedmetadata', () => {
    const formattedDuration = formatTime(audio.duration);
    timeDuration.textContent = formattedDuration;

    // Dynamically update Duration metric inside Spreadsheet Cells
    const activeRow = excelGridBody.querySelector(`tr[data-index="${currentIndex}"]`);
    if (activeRow) {
        const durationCell = activeRow.cells[4];
        if (durationCell) durationCell.textContent = Math.round(audio.duration) + "s";
    }
});

audio.addEventListener('ended', () => {
    if (isRepeat) {
        audio.currentTime = 0;
        playTrack();
    } else {
        nextTrack();
    }
});

progressBar.addEventListener('input', () => {
    if (!isNaN(audio.duration)) {
        const seekTime = (progressBar.value / 100) * audio.duration;
        audio.currentTime = seekTime;
        updateSliderBackground(progressBar);
    }
});

// Sound controller controls
function applyVolume(vol) {
    audio.volume = vol;
    volumeBar.value = vol * 100;
    excelZoomSlider.value = vol * 100;
    excelZoomLabel.textContent = `Zoom: ${Math.round(vol * 100)}%`;
    updateSliderBackground(volumeBar);

    if (vol === 0) {
        muteIcon.style.display = 'block';
        volumeIcon.style.display = 'none';
    } else {
        muteIcon.style.display = 'none';
        volumeIcon.style.display = 'block';
    }
}

volumeBar.addEventListener('input', () => {
    const vol = volumeBar.value / 100;
    applyVolume(vol);
});

excelZoomSlider.addEventListener('input', () => {
    const vol = excelZoomSlider.value / 100;
    applyVolume(vol);
});

btnMute.addEventListener('click', () => {
    if (audio.volume > 0) {
        previousVolume = audio.volume;
        applyVolume(0);
    } else {
        applyVolume(previousVolume);
    }
});

// Sequencing Switch Controls
btnShuffle.addEventListener('click', toggleShuffle);
excelBtnShuffle.addEventListener('click', toggleShuffle);

function toggleShuffle() {
    isShuffle = !isShuffle;
    shuffleQueue = []; // Clear current shuffled arrays queue

    btnShuffle.classList.toggle('active-state', isShuffle);
    excelBtnShuffle.classList.toggle('active-state', isShuffle);
}

btnRepeat.addEventListener('click', toggleRepeat);
excelBtnRepeat.addEventListener('click', toggleRepeat);

function toggleRepeat() {
    isRepeat = !isRepeat;
    btnRepeat.classList.toggle('active-state', isRepeat);
    excelBtnRepeat.classList.toggle('active-state', isRepeat);
}

btnPlayPause.addEventListener('click', togglePlay);
excelBtnPlay.addEventListener('click', togglePlay);

btnNext.addEventListener('click', nextTrack);
excelBtnNext.addEventListener('click', nextTrack);

btnPrev.addEventListener('click', prevTrack);
excelBtnPrev.addEventListener('click', prevTrack);

// =================================================================
// STEALTH COGNIZANT SYSTEM UI CLASSIFICATION CONTROLS
// =================================================================
btnCorporate.addEventListener('click', switchToExcelDisguise);
btnStandardView.addEventListener('click', switchToStandardModern);
excelCloseToStandard.addEventListener('click', switchToStandardModern);

function switchToExcelDisguise() {
    wrapperEl.className = 'excel-view';
    // Sync current spreadsheet active row highlights
    renderSongsTable();
}

function switchToStandardModern() {
    wrapperEl.className = 'standard-view';
    // Re-render standard list highlights
    loadPlaylist(activePlaylistName, !audio.paused);
}

function formatTime(secs) {
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

// Global Media Session API Support
if ('mediaSession' in navigator) {
    audio.addEventListener('play', () => {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: currentPlaylistSongs[currentIndex]?.title || 'Web Music Track',
            album: activePlaylistName,
            artist: 'Local Library'
        });
        navigator.mediaSession.playbackState = 'playing';
    });
    audio.addEventListener('pause', () => {
        navigator.mediaSession.playbackState = 'paused';
    });
    navigator.mediaSession.setActionHandler('play', playTrack);
    navigator.mediaSession.setActionHandler('pause', pauseTrack);
    navigator.mediaSession.setActionHandler('previoustrack', prevTrack);
    navigator.mediaSession.setActionHandler('nexttrack', nextTrack);
}

// Spacebar and Arrow shortcuts
window.addEventListener('keydown', (e) => {
    // Only capture events if the user isn't actively focusing on an input element
    if (document.activeElement.tagName === 'INPUT' && document.activeElement !== volumeBar && document.activeElement !== progressBar) {
        return;
    }
    if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
    } else if (e.code === 'ArrowRight') {
        audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
    } else if (e.code === 'ArrowLeft') {
        audio.currentTime = Math.max(0, audio.currentTime - 5);
    }
});

// Run Initializer
init();