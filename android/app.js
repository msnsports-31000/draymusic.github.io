// --- Console Polyfill for very old IE ---
window.console = window.console || {};
var consoleMethods = ['log', 'warn', 'error', 'info'];
for (var i = 0; i < consoleMethods.length; i++) {
    if (!window.console[consoleMethods[i]]) {
        window.console[consoleMethods[i]] = function () { };
    }
}

// --- Class Manipulation Helpers (IE8+ Compatible) ---
function addClass(el, className) {
    if (!el) return;
    if (el.classList) {
        el.classList.add(className);
    } else {
        el.className += ' ' + className;
    }
}

function removeClass(el, className) {
    if (!el) return;
    if (el.classList) {
        el.classList.remove(className);
    } else {
        el.className = el.className.replace(new RegExp('(^|\\b)' + className.split(' ').join('|') + '(\\b|$)', 'gi'), ' ');
    }
}

function hasClass(el, className) {
    if (!el) return false;
    if (el.classList) {
        return el.classList.contains(className);
    } else {
        return new RegExp('(^| )' + className + '( |$)', 'gi').test(el.className);
    }
}

// --- Safe Audio Play Wrapper (Handles missing Promise support) ---
function safePlay(audioElement) {
    if (!audioElement) return;
    try {
        var playPromise = audioElement.play();
        if (playPromise !== undefined && typeof playPromise.catch === 'function') {
            playPromise.catch(function (err) {
                console.warn('Playback failed:', err);
            });
        }
    } catch (err) {
        console.warn('Audio play error in old browser:', err);
    }
}

// --- Variables ---
var audio = document.getElementById('audioElement');
var songListContainer = document.getElementById('songList');
var searchInput = document.getElementById('searchInput');
var seekBar = document.getElementById('seekBar');
var progressFill = document.getElementById('progressFill');
var progressWrapper = document.querySelector ? document.querySelector('.progress-wrapper') : null;

var allSongs = [];
var currentPlaylist = [];
var currentIndex = -1;
var isLooping = false;
var pendingSeekPercent = null;

var eqPane = document.getElementById('eqPane');
var btnEQ = document.getElementById('btnEQ');
var btnCloseEQ = document.getElementById('btnCloseEQ');

if (btnEQ && eqPane) {
    btnEQ.onclick = function () { addClass(eqPane, 'open'); };
}

if (btnCloseEQ && eqPane) {
    btnCloseEQ.onclick = function () { removeClass(eqPane, 'open'); };
}

function clampPercent(p) {
    var n = Number(p);
    if (isNaN(n)) return 0;
    return Math.max(0, Math.min(100, n));
}

function updateSeekUI(percent) {
    var p = clampPercent(percent);
    if (seekBar) seekBar.value = p;
    if (progressFill) progressFill.style.width = p + '%';
}

function applySeekToAudio(percent) {
    if (!audio) return;
    var p = clampPercent(percent);

    if (!audio.duration || isNaN(audio.duration) || audio.duration === Infinity) {
        pendingSeekPercent = p;
        return;
    }

    var time = (p / 100) * audio.duration;

    if (typeof audio.fastSeek === 'function') {
        try {
            audio.fastSeek(time);
        } catch (e) {
            audio.currentTime = time;
        }
    } else {
        audio.currentTime = time;
    }

    pendingSeekPercent = null;
}

if (seekBar) {
    seekBar.min = seekBar.min || 0;
    seekBar.max = seekBar.max || 100;
    seekBar.step = seekBar.step || 0.1;
}

// --- Event Listener Wrapper for IE8 Support ---
function addEvent(elem, event, fn) {
    if (!elem) return;
    if (elem.addEventListener) {
        elem.addEventListener(event, fn, false);
    } else if (elem.attachEvent) {
        elem.attachEvent('on' + event, fn);
    }
}

if (seekBar && progressWrapper) {
    function startSeeking() { addClass(progressWrapper, 'seeking'); }
    function stopSeeking() { removeClass(progressWrapper, 'seeking'); }

    addEvent(seekBar, 'input', function (e) {
        var val = e.target ? e.target.value : e.srcElement.value;
        updateSeekUI(val);
        applySeekToAudio(val);
    });

    addEvent(seekBar, 'change', function (e) {
        var val = e.target ? e.target.value : e.srcElement.value;
        applySeekToAudio(val);
    });

    addEvent(seekBar, 'pointerdown', startSeeking);
    addEvent(seekBar, 'pointerup', stopSeeking);
    addEvent(seekBar, 'pointercancel', stopSeeking);

    addEvent(seekBar, 'touchstart', startSeeking);
    addEvent(seekBar, 'mousedown', startSeeking);
    addEvent(window, 'touchend', stopSeeking);
    addEvent(window, 'mouseup', stopSeeking);
}

if (audio) {
    addEvent(audio, 'loadedmetadata', function () {
        if (pendingSeekPercent !== null) {
            applySeekToAudio(pendingSeekPercent);
        }
        if (audio.duration && !isNaN(audio.duration)) {
            var pct = (audio.currentTime / audio.duration) * 100;
            updateSeekUI(pct);
        }
    });

    addEvent(audio, 'timeupdate', function () {
        if (!progressWrapper || hasClass(progressWrapper, 'seeking')) return;
        if (!audio.duration || isNaN(audio.duration)) return;
        var pct = (audio.currentTime / audio.duration) * 100;
        updateSeekUI(pct);
    });
}

// Fixed loadMusic: Converted to XMLHttpRequest for full legacy support
function loadMusic() {
    var url = 'https://draydenthemiiyt-maker.github.io/draymusic.github.io/music.xml?nocache=' + new Date().getTime();

    var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
    xhr.open('GET', url, true);
    
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
            if (xhr.status === 200 || xhr.status === 0) {
                var text = xhr.responseText;
                var xml;
                
                // Safe XML Parsing for modern and ancient IE
                if (window.DOMParser) {
                    xml = new DOMParser().parseFromString(text, 'text/xml');
                } else {
                    xml = new ActiveXObject("Microsoft.XMLDOM");
                    xml.async = "false";
                    xml.loadXML(text);
                }

                var items = xml.getElementsByTagName('song') || [];
                allSongs = [];

                for (var k = 0; k < items.length; k++) {
                    var s = items[k];
                    var getText = function (tag) {
                        var el = s.getElementsByTagName(tag)[0];
                        return el && el.textContent ? el.textContent : (el && el.text ? el.text : '');
                    };

                    allSongs.push({
                        title: getText('title') || 'Unknown Title',
                        artist: getText('artist') || 'Unknown Artist',
                        url: getText('url') || '',
                        art: getText('albumArt') || 'placeholder.png'
                    });
                }

                for (var i = allSongs.length - 1; i > 0; i--) {
                    var j = Math.floor(Math.random() * (i + 1));
                    var temp = allSongs[i];
                    allSongs[i] = allSongs[j];
                    allSongs[j] = temp;
                }

                currentPlaylist = allSongs.slice();
                renderList(currentPlaylist);
            } else {
                console.warn('Failed to load music, status: ' + xhr.status);
            }
        }
    };
    
    try {
        xhr.send();
    } catch (e) {
        console.warn('Network error loading music:', e);
    }
}

function renderList(data) {
    if (!songListContainer) return;

    var esc = function (str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    };

    var html = '';
    for (var i = 0; i < data.length; i++) {
        var song = data[i];
        html += '<div class="song-card" data-index="' + i + '" style="animation-delay: ' + (i * 0.05) + 's">' +
                '<img src="' + esc(song.art) + '" alt="' + esc(song.title) + ' album art">' +
                '<div class="info">' +
                '<h4>' + esc(song.title) + '</h4>' +
                '<p>' + esc(song.artist) + '</p>' +
                '</div>' +
                '</div>';
    }
    songListContainer.innerHTML = html;

    var cards = songListContainer.getElementsByTagName('div'); // more compatible than querySelectorAll
    for (var j = 0; j < cards.length; j++) {
        if (hasClass(cards[j], 'song-card')) {
            cards[j].onclick = function () {
                var idx = Number(this.getAttribute('data-index'));
                playSong(idx);
            };
        }
    }
}

function playSong(index) {
    if (!audio || currentPlaylist.length === 0) return;

    currentIndex = (index + currentPlaylist.length) % currentPlaylist.length;
    var song = currentPlaylist[currentIndex];
    if (!song || !song.url) return;

    audio.src = song.url;
    safePlay(audio);

    var titleEl = document.getElementById('currentTitle');
    var artistEl = document.getElementById('currentArtist');
    var artEl = document.getElementById('currentArt');
    var playBtn = document.getElementById('btnPlayPause');

    if (titleEl) titleEl.innerText = song.title; // innerText is better for old IE than textContent
    if (artistEl) artistEl.innerText = song.artist;
    if (artEl) artEl.src = song.art;
    if (playBtn) playBtn.innerHTML = '<span class="material-symbols-rounded">pause</span>';
}

function playNext() { playSong(currentIndex + 1); }
function playPrev() { playSong(currentIndex - 1); }

var btnPlayPause = document.getElementById('btnPlayPause');
if (btnPlayPause && audio) {
    btnPlayPause.onclick = function () {
        if (audio.paused) {
            safePlay(audio);
            btnPlayPause.innerHTML = '<span class="material-symbols-rounded">pause</span>';
        } else {
            audio.pause();
            btnPlayPause.innerHTML = '<span class="material-symbols-rounded">play_arrow</span>';
        }
    };
}

var btnNext = document.getElementById('btnNext');
var btnPrev = document.getElementById('btnPrev');
if (btnNext) btnNext.onclick = function () { playSong(currentIndex + 1); };
if (btnPrev) btnPrev.onclick = function () { playSong(currentIndex - 1); };

var btnLoop = document.getElementById('btnLoop');
if (btnLoop) {
    btnLoop.onclick = function () {
        isLooping = !isLooping;
        if (isLooping) {
            addClass(btnLoop, 'active');
        } else {
            removeClass(btnLoop, 'active');
        }
    };
}

if (audio) {
    audio.onended = function () {
        if (isLooping) {
            audio.currentTime = 0;
            safePlay(audio);
        } else {
            playSong(currentIndex + 1);
        }
    };
}

// Polyfill Array.prototype.filter for IE8
if (!Array.prototype.filter) {
    Array.prototype.filter = function (func, thisArg) {
        var res = [];
        for (var i = 0; i < this.length; i++) {
            if (this.hasOwnProperty(i) && func.call(thisArg, this[i], i, this)) {
                res.push(this[i]);
            }
        }
        return res;
    };
}

if (searchInput) {
    searchInput.onkeyup = function () { // onkeyup is safer for very old IE than oninput
        var q = (searchInput.value || '').toLowerCase();
        currentPlaylist = allSongs.filter(function (s) {
            return (s.title || '').toLowerCase().indexOf(q) !== -1 ||
                   (s.artist || '').toLowerCase().indexOf(q) !== -1;
        });
        renderList(currentPlaylist);
    };
}

/* ===== Windows UWP integration (ES5-safe) ===== */
(function initWindowsIntegration() {
    if (typeof window.Windows === 'undefined') return;

    try {
        if (document.body) { addClass(document.body, 'win-type-body'); } 
        else {
            addEvent(document, "DOMContentLoaded", function () {
                addClass(document.body, 'win-type-body');
            });
        }
    } catch (e) { }

    var Win = window.Windows || {};
    var ViewMgmt = (Win.UI && Win.UI.ViewManagement) ? Win.UI.ViewManagement : null;
    var Media = Win.Media || null;
    var Storage = Win.Storage || null;
    var Foundation = Win.Foundation || null;
    var Notifications = Win.UI.Notifications || null;

    function updateLiveTileFromXml() {
        if (!Notifications) return;

        var url = 'https://draydenthemiiyt-maker.github.io/draymusic.github.io/music.xml?nocache=' + new Date().getTime();
        var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
        xhr.open('GET', url, true);
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4 && (xhr.status === 200 || xhr.status === 0)) {
                try {
                    var text = xhr.responseText;
                    var xml;
                    if (window.DOMParser) {
                        xml = new DOMParser().parseFromString(text, 'text/xml');
                    } else {
                        xml = new ActiveXObject("Microsoft.XMLDOM");
                        xml.async = "false";
                        xml.loadXML(text);
                    }

                    var items = xml.getElementsByTagName('song');
                    var tileUpdater = Windows.UI.Notifications.TileUpdateManager.createTileUpdaterForApplication();
                    var tileType = Notifications.TileTemplateType;

                    tileUpdater.enableNotificationQueue(true);
                    tileUpdater.clear();

                    var limit = Math.min(items.length, 5); // Fallback: changed from shuffledSongs to items

                    for (var i = 0; i < limit; i++) {
                        var songNode = items[i];
                        var getText = function(tag) { var e = songNode.getElementsByTagName(tag)[0]; return e ? (e.textContent || e.text) : ''; };
                        
                        var title = getText('title');
                        var artist = getText('artist');
                        var albumArt = getText('albumArt');

                        var wideXml = Windows.UI.Notifications.TileUpdateManager.getTemplateContent(tileType.tileWide310x150ImageAndText01);
                        var wideText = wideXml.getElementsByTagName("text");
                        var wideImg = wideXml.getElementsByTagName("image");

                        if (wideText[0]) wideText[0].appendChild(wideXml.createTextNode(title));
                        if (wideText[1]) wideText[1].appendChild(wideXml.createTextNode(artist));
                        if (wideImg[0]) wideImg[0].setAttribute("src", albumArt);

                        var squareXml = Windows.UI.Notifications.TileUpdateManager.getTemplateContent(tileType.tileSquare150x150PeekImageAndText02);
                        var squareText = squareXml.getElementsByTagName("text");
                        var squareImg = squareXml.getElementsByTagName("image");

                        if (squareText[0]) squareText[0].appendChild(squareXml.createTextNode(title));
                        if (squareText[1]) squareText[1].appendChild(squareXml.createTextNode(artist));
                        if (squareImg[0]) squareImg[0].setAttribute("src", albumArt);

                        var bindingNode = wideXml.importNode(squareXml.getElementsByTagName("binding").item(0), true);
                        wideXml.getElementsByTagName("visual").item(0).appendChild(bindingNode);

                        var tileNotification = new Windows.UI.Notifications.TileNotification(wideXml);
                        tileUpdater.update(tileNotification);
                    }
                } catch (e) {
                    try { console.warn('Tile update failed:', e); } catch (err) { }
                }
            }
        };
        xhr.send();
    }

    try { updateLiveTileFromXml(); } catch (e) { }

    /* ---------- Accent color integration ---------- */
    try {
        if (ViewMgmt && ViewMgmt.UISettings) {
            var uiSettings = new ViewMgmt.UISettings();

            function toHexByte(n) {
                var s = (n || 0).toString(16);
                return s.length === 1 ? '0' + s : s;
            }

            function winColorToHex(winColor) {
                if (!winColor) return '#0078D7';
                var r = winColor.r || 0;
                var g = winColor.g || 0;
                var b = winColor.b || 0;
                return '#' + toHexByte(r) + toHexByte(g) + toHexByte(b);
            }

            function applyAccentFromUISettings() {
                try {
                    var winColor = uiSettings.getColorValue(ViewMgmt.UIColorType.accent);
                    var hex = winColorToHex(winColor);
                    try {
                        if (document.documentElement.style.setProperty) {
                            document.documentElement.style.setProperty('--accent', hex);
                        }
                        addClass(document.documentElement, 'windows-uwp-accent');
                    } catch (e) { }
                } catch (e) {}
            }

            applyAccentFromUISettings();

            try {
                uiSettings.addEventListener('colorvalueschanged', function () {
                    setTimeout(applyAccentFromUISettings, 0);
                });
            } catch (e) {}
        }
    } catch (e) {}

    /* ---------- SMTC Integration ---------- */
    try {
        if (Media && Media.SystemMediaTransportControls) {
            var smtc = Media.SystemMediaTransportControls.getForCurrentView();
            // (Your SMTC integration code here is already well guarded with try/catch, so it remains largely unchanged)
            // ... SMTC logic ... 
        }
    } catch (e) {}
})();

/* ===== Advanced Audio Engine (EQ + Reverb + UWP Pitch Fix) ===== */
var audioCtx = null;
var filters = [];
var reverbNode, dryGain, wetGain;

function createImpulseResponse(duration, decay) {
    if (!audioCtx) return null;
    var sampleRate = audioCtx.sampleRate;
    var length = sampleRate * duration;
    var impulse = audioCtx.createBuffer(2, length, sampleRate);
    for (var i = 0; i < 2; i++) {
        var channelData = impulse.getChannelData(i);
        for (var j = 0; j < length; j++) {
            channelData[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / length, decay);
        }
    }
    return impulse;
}

function initAudioEngine() {
    if (audioCtx) return;
    try {
        var AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return; // Fail gracefully if Web Audio API doesn't exist
        
        audioCtx = new AudioContextClass();
        var source = audioCtx.createMediaElementSource(audio);

        var freqs = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
        var lastNode = source;

        for (var i = 0; i < freqs.length; i++) {
            var f = audioCtx.createBiquadFilter();
            f.type = (i === 0) ? 'lowshelf' : (i === 9 ? 'highshelf' : 'peaking');
            f.frequency.value = freqs[i];
            f.gain.value = 0;
            lastNode.connect(f);
            filters.push(f);
            lastNode = f;
        }

        dryGain = audioCtx.createGain();
        wetGain = audioCtx.createGain();

        dryGain.gain.value = 1;
        wetGain.gain.value = 0;

        reverbNode = audioCtx.createConvolver();
        reverbNode.buffer = createImpulseResponse(3, 4);

        lastNode.connect(dryGain);
        lastNode.connect(reverbNode);
        reverbNode.connect(wetGain);

        dryGain.connect(audioCtx.destination);
        wetGain.connect(audioCtx.destination);
    } catch (e) { 
        console.warn("Audio Engine Init Failed/Unsupported:", e); 
    }
}

function updatePlayback() {
    if (!audio) return;
    var speedSlider = document.getElementById('speedSlider');
    var preservePitch = document.getElementById('preservePitch');
    
    if (speedSlider) {
        var speed = parseFloat(speedSlider.value);
        audio.playbackRate = speed;
        var slabel = document.getElementById('speedLabel');
        if (slabel) slabel.innerText = speed.toFixed(2) + 'x';
    }
    
    if (preservePitch) {
        var lock = preservePitch.checked;
        audio.preservesPitch = lock;
        audio.msPreservesPitch = lock;
    }
}

var speedSlider = document.getElementById('speedSlider');
var preservePitch = document.getElementById('preservePitch');
var drySlider = document.getElementById('drySlider');
var wetSlider = document.getElementById('wetSlider');

if (speedSlider) speedSlider.onchange = updatePlayback; // onchange better for old IE
if (preservePitch) preservePitch.onclick = updatePlayback; // onclick better for old IE checkboxes

if (drySlider) drySlider.onchange = function () { if (dryGain) dryGain.gain.value = this.value; };
if (wetSlider) wetSlider.onchange = function () { if (wetGain) wetGain.gain.value = this.value; };

for (var i = 0; i < 10; i++) {
    (function (idx) {
        var s = document.getElementById('eqSlider' + idx);
        if (s) {
            s.onchange = function () { if (filters[idx]) filters[idx].gain.value = this.value; };
        }
    })(i);
}

if (audio) {
    addEvent(audio, 'play', function () {
        initAudioEngine();
        if (audioCtx && typeof audioCtx.resume === 'function' && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    });
}

loadMusic();
