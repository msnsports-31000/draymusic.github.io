var allStations = [];
var currentPool = [];
var musicPlaylist = [];
var currentMode = '';
var currentRound = 1;
var score = 0;
var currentStation = null;
var maxRounds = 10;
var helpUsesLeft = 5;
var isMusicEnabled = true;
var isVideoBackgroundEnabled = true;
var isClickSoundEnabled = true;
var isDataReady = false;
var isSplashFinished = false;
var currentTrackIndex = -1;

window.onload = function () {
    initGame();
    runSplashSequence();
};

function loadXML(url, callback, errorCallback) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);

    if (xhr.overrideMimeType) {
        xhr.overrideMimeType("text/xml");
    }

    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
            if (xhr.status === 200 || xhr.status === 0) {
                callback(xhr.responseXML);
            } else {
                errorCallback();
            }
        }
    };
    xhr.onerror = function () {
        errorCallback();
    };
    xhr.send();
}

function runSplashSequence() {
    var s1 = document.getElementById("splash1");
    var s2 = document.getElementById("splash2");
    var video = document.getElementById("splashVideo");
    var container = document.getElementById("splashContainer");
    if (container) container.style.display = "block";

    function skipSplash() {
        video.onended = null;
        video.onclick = null;

        try {
            video.pause();
        } catch (e) { }

        video.style.display = "none";
        container.style.display = "none";

        if (typeof playRandomBGM === "function") {
            playRandomBGM();
        }

        isSplashFinished = true;
        if (isDataReady) {
            showMenu();
        }
    }

    video.onended = skipSplash;
    video.onclick = skipSplash;

    function proceedWithAnimation() {
        s1.style.display = "flex";
        setTimeout(function () {
            if (container.style.display !== "none") {
                s1.style.display = "none";
                s2.style.display = "flex";
            }
        }, 2000);

        setTimeout(function () {
            if (container.style.display !== "none") {
                s2.style.display = "none";
                video.style.display = "flex";
                var skipText = document.querySelector('.non-intractable-flashingText');
                if (skipText) {
                    skipText.style.display = "block";
                }

                try {
                    var playPromise = video.play();
                    if (playPromise !== undefined && playPromise !== null && typeof playPromise.catch === 'function') {
                        playPromise.catch(function (error) {
                            console.error("Playback failed executing sequence:", error.name, error.message);
                            if (error.name === "NotSupportedError") {
                                console.error("VIDEO CODEC ERROR");
                            }
                            skipSplash();
                        });
                    }
                } catch (error) {
                    console.warn("Native runtime video failure context:", error);
                    skipSplash();
                }
            }
        }, 4000);
    }

    function setupSequenceLayout(requiresClick) {
        if (requiresClick) {
            s1.innerHTML = "Click Anywhere to Start!";
            s1.style.display = "flex";

            container.onclick = function () {
                container.onclick = null;
                s1.innerText = "DraydenYT Studios";

                try {
                    var clickPromise = video.play();
                    if (clickPromise !== undefined && clickPromise !== null && typeof clickPromise.then === 'function') {
                        clickPromise.then(function () {
                            video.pause();
                            video.currentTime = 0;
                        }).catch(function (e) { console.warn(e.message); });
                    } else {
                        video.pause();
                        video.currentTime = 0;
                    }
                } catch (e) {
                    console.warn("Direct trigger handling skipped:", e);
                }

                proceedWithAnimation();
            };
        } else {
            s1.innerText = "DraydenYT Studios";
            proceedWithAnimation();
        }
    }

    try {
        var testPromise = video.play();

        if (testPromise !== undefined && testPromise !== null && typeof testPromise.then === 'function') {
            testPromise.then(function () {
                video.pause();
                video.currentTime = 0;
                setupSequenceLayout(false);
            }).catch(function (error) {
                setupSequenceLayout(true);
            });
        } else {
            video.pause();
            video.currentTime = 0;
            setupSequenceLayout(false);
        }
    } catch (error) {
        setupSequenceLayout(true);
    }
}

function initGame() {
    initSettingsStore();
    initHelpSystem();
    setupGlobalClickEvents();

    var bgmPlayer = document.getElementById('bgm-player');
    if (bgmPlayer) {
        bgmPlayer.onended = function () {
            playRandomBGM();
        };
    }

    loadXML('https://raw.githubusercontent.com/draydenthemiiyt-maker/draymusic.github.io/refs/heads/main/guesstherailwaystationserver/stations.xml', function (stationXML) {
        if (!stationXML) return showError();
        parseStations(stationXML);

        loadXML('https://raw.githubusercontent.com/draydenthemiiyt-maker/draymusic.github.io/refs/heads/main/guesstherailwaystationserver/music.xml', function (musicXML) {
            if (!musicXML) return showError();
            parseMusic(musicXML);
            isDataReady = true;
            if (isSplashFinished) {
                showMenu();
            }
        }, showError);
    }, showError);
}

function initSettingsStore() {
    if (typeof (Storage) !== "undefined") {
        if (localStorage.getItem("isMusicEnabled") !== null) {
            isMusicEnabled = localStorage.getItem("isMusicEnabled") === "true";
        }
        if (localStorage.getItem("isVideoBackgroundEnabled") !== null) {
            isVideoBackgroundEnabled = localStorage.getItem("isVideoBackgroundEnabled") === "true";
        }
        if (localStorage.getItem("isClickSoundEnabled") !== null) {
            isClickSoundEnabled = localStorage.getItem("isClickSoundEnabled") === "true";
        }
    }

    var mToggle = document.getElementById('setting-music');
    var vToggle = document.getElementById('setting-bg');
    var cToggle = document.getElementById('setting-click-sounds');

    if (mToggle) mToggle.checked = isMusicEnabled;
    if (vToggle) vToggle.checked = isVideoBackgroundEnabled;
    if (cToggle) cToggle.checked = isClickSoundEnabled;

    var bgVideo = document.getElementById('video-background');
    var bgOverlay = document.getElementById('video-overlay');
    if (bgVideo && bgOverlay) {
        if (!isVideoBackgroundEnabled) {
            bgVideo.pause();
            bgVideo.style.display = "none";
            bgOverlay.style.opacity = "1";
        } else {
            bgVideo.style.display = "block";
            bgOverlay.style.opacity = "0.75";
        }
    }
}

function parseStations(xml) {
    allStations = [];
    var stationNodes = xml.getElementsByTagName("station");
    for (var i = 0; i < stationNodes.length; i++) {
        var node = stationNodes[i];
        allStations.push({
            difficulty: node.getAttribute("difficulty"),
            name: node.getElementsByTagName("name")[0].textContent,
            image: node.getElementsByTagName("image")[0].textContent,
            hint: node.getElementsByTagName("hint")[0].textContent
        });
    }
}

function parseMusic(xml) {
    musicPlaylist = [];
    var trackNodes = xml.getElementsByTagName("track");
    for (var i = 0; i < trackNodes.length; i++) {
        musicPlaylist.push(trackNodes[i].getAttribute("src"));
    }
}

function safePlayMedia(audioElement) {
    if (!audioElement) return;
    try {
        var playPromise = audioElement.play();
        if (playPromise !== undefined && playPromise !== null && typeof playPromise.catch === 'function') {
            playPromise.catch(function (e) {
                console.log("Media framework runtime playback notice: " + e.message);
            });
        }
    } catch (err) {
        console.log("Audio execution prevented: " + err.message);
    }
}

function playRandomBGM() {
    if (musicPlaylist.length === 0 || !isMusicEnabled) return;

    var randomIndex = currentTrackIndex;

    if (musicPlaylist.length > 1) {
        while (randomIndex === currentTrackIndex) {
            randomIndex = Math.floor(Math.random() * musicPlaylist.length);
        }
    } else {
        randomIndex = 0;
    }

    currentTrackIndex = randomIndex;

    var bgmPlayer = document.getElementById('bgm-player');
    if (bgmPlayer) {
        bgmPlayer.src = musicPlaylist[currentTrackIndex];
        safePlayMedia(bgmPlayer);
    }
}

function playYaySound() {
    if (!isClickSoundEnabled) return;
    var yay = document.getElementById('sfx-yay');
    if (yay) {
        yay.currentTime = 0;
        safePlayMedia(yay);
    }
}

function playOhNoSound() {
    if (!isClickSoundEnabled) return;
    var ohno = document.getElementById('sfx-ohno');
    if (ohno) {
        ohno.currentTime = 0;
        safePlayMedia(ohno);
    }
}

function playClickSound() {
    if (!isClickSoundEnabled) return;
    var clickSfx = document.getElementById('sfx-click');
    if (clickSfx) {
        clickSfx.currentTime = 0;
        safePlayMedia(clickSfx);
    }
}

function playKeySound() {
    if (!isClickSoundEnabled) return;
    var keySfx = document.getElementById('sfx-key');
    if (keySfx) {
        keySfx.currentTime = 0;
        safePlayMedia(keySfx);
    }
}

function playErrorSound() {
    if (!isClickSoundEnabled) return;
    var errorSfx = document.getElementById('sfx-error');
    if (errorSfx) {
        errorSfx.currentTime = 0;
        safePlayMedia(errorSfx);
    }
}

function setupGlobalClickEvents() {
    document.addEventListener('click', function (e) {
        if (e.target && (e.target.classList.contains('btn') || e.target.tagName === 'BUTTON')) {
            playClickSound();
        }
    });
}

function showScreen(screenId) {
    var screens = ['error-screen', 'menu-screen', 'game-screen', 'game-over-screen', 'settings-screen'];

    for (var i = 0; i < screens.length; i++) {
        var el = document.getElementById(screens[i]);
        if (el) {
            if (screens[i] === screenId) {
                el.style.opacity = '1';
                el.style.visibility = 'visible';
                el.style.pointerEvents = 'auto';
                el.style.position = 'relative';
                el.style.left = 'auto';
                el.style.top = 'auto';
                el.style.width = 'auto';
            } else {
                el.style.opacity = '0';
                el.style.visibility = 'hidden';
                el.style.pointerEvents = 'none';
                el.style.position = 'absolute';
                el.style.left = '30px';
                el.style.top = '30px';
                el.style.width = 'calc(100% - 60px)';
            }
        }
    }
}

function showError() { showScreen('error-screen'); }
function showMenu() { showScreen('menu-screen'); }
function showSettings() { showScreen('settings-screen'); }
function startGame(mode) {
    currentMode = mode;
    currentRound = 1;
    score = 0;

    if (isMusicEnabled) {
        var bgmPlayer = document.getElementById('bgm-player');
        safePlayMedia(bgmPlayer);
    }

    currentPool = [];
    for (var i = 0; i < allStations.length; i++) {
        var difficultyAttr = allStations[i].difficulty || "";
        var difficultyLevels = difficultyAttr.split(" ");

        var matchFound = false;
        for (var j = 0; j < difficultyLevels.length; j++) {
            if (difficultyLevels[j] === mode) {
                matchFound = true;
                break;
            }
        }

        if (matchFound) {
            currentPool.push(allStations[i]);
        }
    }

    if (currentPool.length === 0) {
        console.error("No stations found for this difficulty in the XML!");
        return showError();
    }

    showScreen('game-screen');
    loadRound();
}

function loadRound() {
    if (currentRound > maxRounds || currentPool.length === 0) {
        return endGame(true);
    }

    document.getElementById('round-counter').innerText = "Round " + currentRound + " / " + maxRounds;
    var inputEl = document.getElementById('answer-input');
    inputEl.value = "";
    document.getElementById('feedback').innerText = "";

    var hintEl = document.getElementById('hint-display');
    hintEl.innerText = "";
    hintEl.style.display = "none";

    document.getElementById('checkmark').className = "hidden";
    inputEl.disabled = false;

    var randomIndex = Math.floor(Math.random() * currentPool.length);
    currentStation = currentPool.splice(randomIndex, 1)[0];

    document.getElementById('image-container').style.backgroundImage = "url('" + currentStation.image + "')";

    updateHelpUI();
}

function checkAnswer() {
    var userInput = document.getElementById('answer-input').value;
    var correctAnswer = currentStation.name;
    var feedbackEl = document.getElementById('feedback');
    var hintEl = document.getElementById('hint-display');

    var u = userInput.toLowerCase().replace(/[^a-z0-9]/g, "");
    var c = correctAnswer.toLowerCase().replace(/[^a-z0-9]/g, "");

    var prefixes = ["london", "manchester", "liverpool", "birmingham", "edinburgh", "glasgow", "leeds", "sheffield"];

    for (var i = 0; i < prefixes.length; i++) {
        var prefix = prefixes[i];
        if (c.indexOf(prefix) === 0 && u.indexOf(prefix) !== 0) {
            c = c.substring(prefix.length);
        }
    }

    if (u === c) {
        score++;
        feedbackEl.innerText = "Correct!";
        feedbackEl.style.color = "green";

        playYaySound();
        var checkmark = document.getElementById('checkmark');
        checkmark.className = "bounce";

        document.getElementById('answer-input').disabled = true;

        setTimeout(function () {
            currentRound++;
            loadRound();
        }, 1500);

    } else {
        playOhNoSound();
        if (currentMode === 'hard') {
            endGame(false);
        } else {
            feedbackEl.innerText = "Oops, Try again lol.";
            feedbackEl.style.color = "red";

            hintEl.innerText = "Hint: " + currentStation.hint;
            hintEl.style.display = "block";
        }
    }
}

function returnToMenu() {
    if (currentRound > 1 && currentRound <= maxRounds && currentPool.length > 0) {}
    currentRound = 1;
    score = 0;
    currentStation = null;

    var inputEl = document.getElementById('answer-input');
    if (inputEl) {
        inputEl.value = "";
        inputEl.disabled = false;
    }

    var checkmark = document.getElementById('checkmark');
    if (checkmark) checkmark.className = "hidden";
    showMenu();
}
function initHelpSystem() {
    if (typeof (Storage) !== "undefined") {
        var today = new Date().toDateString();
        var savedDate = localStorage.getItem("help_date");
        var savedCount = localStorage.getItem("help_count");

        if (savedDate !== today) {
            localStorage.setItem("help_date", today);
            localStorage.setItem("help_count", "5");
            helpUsesLeft = 5;
        } else {
            helpUsesLeft = savedCount !== null ? parseInt(savedCount, 10) : 5;
        }
    } else {
        helpUsesLeft = 5;
    }
}

function useHelp() {
    var hintEl = document.getElementById('hint-display');

    if (helpUsesLeft <= 0) {
        playErrorSound();
        hintEl.innerText = "You have run out of hints for today!";
        hintEl.style.display = "block";
        hintEl.style.color = "#ef4444";
        return;
    }

    if (!currentStation) return;

    helpUsesLeft--;
    if (typeof (Storage) !== "undefined") {
        localStorage.setItem("help_count", helpUsesLeft.toString());
    }
    updateHelpUI();

    var name = currentStation.name;
    var len = name.length;
    var maskedName = "";

    if (len <= 5) {
        maskedName = name.substring(0, 1) + "..." + name.substring(len - 1);
    } else {
        var firstTwo = name.substring(0, 2);
        var lastThree = name.substring(len - 3);
        var dots = "";

        for (var i = 2; i < len - 3; i++) {
            if (name.charAt(i) === " ") {
                dots += " ";
            } else {
                dots += ".";
            }
        }
        maskedName = firstTwo + dots + lastThree;
    }

    hintEl.style.color = "";
    hintEl.innerText = "Letters: " + maskedName;
    hintEl.style.display = "block";
}

function updateHelpUI() {
    var helpBtn = document.getElementById('help-btn');
    var helpCountEl = document.getElementById('help-count');

    if (helpCountEl) {
        helpCountEl.innerText = "Uses left today: " + helpUsesLeft;
    }

    if (helpBtn) {
        if (helpUsesLeft <= 0) {
            helpBtn.dataset.disabled = "true";
            helpBtn.style.backgroundColor = "#4b5563";
            helpBtn.style.cursor = "not-allowed";
        } else {
            helpBtn.dataset.disabled = "false";
            helpBtn.style.backgroundColor = "#f59e0b";
            helpBtn.style.cursor = "default";
        }
    }
}

function endGame(completed) {
    showScreen('game-over-screen');
    var titleEl = document.getElementById('final-title');
    var scoreEl = document.getElementById('final-score');

    if (completed) {
        titleEl.innerText = "Well done mate!";
        scoreEl.innerText = "Your Score " + score + " out of " + maxRounds + "!";
    } else {
        titleEl.innerText = "Aww mann.";
        scoreEl.innerText = "Better luck next time! if you keep failing, try easy mode. Your Score: 0";
    }
}

function toggleMusicSetting(enabled) {
    isMusicEnabled = enabled;
    if (typeof (Storage) !== "undefined") {
        localStorage.setItem("isMusicEnabled", enabled.toString());
    }

    var bgmPlayer = document.getElementById('bgm-player');
    if (!enabled) {
        bgmPlayer.pause();
    } else {
        if (!bgmPlayer.src && musicPlaylist.length > 0) {
            playRandomBGM();
        } else {
            safePlayMedia(bgmPlayer);
        }
    }
}

function toggleVideoSetting(enabled) {
    isVideoBackgroundEnabled = enabled;
    if (typeof (Storage) !== "undefined") {
        localStorage.setItem("isVideoBackgroundEnabled", enabled.toString());
    }

    var bgVideo = document.getElementById('video-background');
    var bgOverlay = document.getElementById('video-overlay');

    if (!enabled) {
        bgVideo.pause();
        bgVideo.style.display = "none";
        bgOverlay.style.opacity = "1";
    } else {
        bgVideo.style.display = "block";
        safePlayMedia(bgVideo);
        bgOverlay.style.opacity = "0.75";
    }
}

function toggleClickSoundSetting(enabled) {
    isClickSoundEnabled = enabled;
    if (typeof (Storage) !== "undefined") {
        localStorage.setItem("isClickSoundEnabled", enabled.toString());
    }
}

var answerInput = document.getElementById('answer-input');

if (answerInput) {
    answerInput.addEventListener('input', function () {
        playKeySound();
    });

    answerInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            checkAnswer();
        }
    });
}
