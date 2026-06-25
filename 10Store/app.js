(function () {
    "use strict";

    // --- PLATFORM DETECTION ---
    var urlParams = new URLSearchParams(window.location.search);
    var appId = urlParams.get('id');
    var isPhone = urlParams.get('WindowsPhone') === "1"; 
    // No fallbacks to screen size: it is either "1" (true) or it isn't.

    function loadAppData() {
        console.log("Fetching App Data via XMLHttpRequest...");

        var getApps = new Promise(function (resolve, reject) {
            var xhr = new XMLHttpRequest();
            xhr.open("GET", server, true);

            xhr.onload = function () {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve({ responseText: xhr.responseText });
                } else {
                    reject(new Error("HTTP Error: " + xhr.status));
                }
            };

            xhr.onerror = function () {
                reject(new Error("Network request failed"));
            };

            xhr.send();
        });

        getApps.then(function (res) {
            try {
                var parser = new DOMParser();
                var xml = parser.parseFromString(res.responseText, "text/xml");

                if (!xml) return;

                var apps = xml.getElementsByTagName("app");
                var targetApp = null;

                for (var i = 0; i < apps.length; i++) {
                    if (apps[i].getAttribute("id") === appId) {
                        targetApp = apps[i];
                        break;
                    }
                }

                if (targetApp) {
                    renderApp(targetApp);
                }

            } catch (err) {
                console.error("Error parsing app data:", err);
            }
        }).catch(function (err) {
            console.error("Request failed:", err);
        });
    }

    function renderApp(app) {
        var name = getVal(app, "name");
        var version = getVal(app, "version");
        var icon = getVal(app, "icon");
        var pub = getVal(app, "publisher");
        var desc = getVal(app, "description");
        var packageUrl = getVal(app, "package");

        // --- PLATFORM SPECIFIC UI CHANGES (Optional) ---
        // If you want to change styles based on the platform variable:
        if (isPhone) {
            document.body.classList.add("mobile-view");
        }

        function isValidImageUrl(url) {
            if (!url) return false;
            url = url.trim();
            if (url.indexOf("data:image/") === 0) return true;
            if (url.indexOf("http://") === 0 || url.indexOf("https://") === 0) {
                var lower = url.toLowerCase();
                return (/\.(png|jpe?g|gif|webp|svg)(?:[\?#].*)?$/.test(lower));
            }
            return false;
        }

        function isVideoUrl(url) {
            if (!url) return false;
            url = url.trim().toLowerCase();
            return url.endsWith(".mp4") || url.indexOf(".mp4?") !== -1;
        }

        var screenshots = [];
        for (var s = 1; s <= 5 && screenshots.length < 5; s++) {
            var tagName = "screenshot" + s;
            var el = app.getElementsByTagName(tagName)[0];
            if (el) {
                var url = (el.textContent || el.getAttribute("src") || "").trim();
                if (isValidImageUrl(url) || isVideoUrl(url)) {
                    screenshots.push(url);
                }
            }
        }

        if (screenshots.length < 5) {
            var generic = app.getElementsByTagName("screenshot");
            for (var i = 0; i < generic.length && screenshots.length < 5; i++) {
                var url2 = (generic[i].textContent || generic[i].getAttribute("src") || "").trim();
                if (isValidImageUrl(url2) || isVideoUrl(url2)) {
                    if (screenshots.indexOf(url2) === -1) {
                        screenshots.push(url2);
                    }
                }
            }
        }

        // Maintaining the platform state in the publisher search link
        var platformSuffix = isPhone ? "&WindowsPhone=1" : "&WindowsPhone=0";

        var html =
            '<div class="app-hero">' +
            '<img src="' + icon + '" class="app-logo-big" alt="App icon">' +
            '<div class="app-info-right">' +
            '<div class="app-title">' + name + '</div>' +
            '<a class="app-publisher" href="' + pagehosturi + '/apps.html?search=' + encodeURIComponent(pub) + platformSuffix + '">' + pub + '</a>' +
            '<div class="app-version">Version ' + version + '</div>' +
            '<div id="dl-container">' +
            '<button class="win-button btn-download" id="dl-btn">Download</button>' +
            '<div id="progress-wrapper" style="display:none; width:100%;">' +
            '<progress id="dl-progress" value="0" max="100"></progress>' +
            '<div id="progress-text">Connecting...</div>' +
            '</div>' +
            '</div>' +
            '<div class="app-description">' + desc + '</div>' +
            '</div>' +
            '</div>' +
            '<section class="app-screenshots" aria-label="Screenshots">' +
            '<div class="screenshots-inner">' +
            '<h2 class="screenshots-title">Screenshots</h2>' +
            '<div id="nativeCarousel" class="carousel-viewer">' +
            '<div class="carousel-inner">' +
            '<button id="prevBtn" class="win-button carousel-nav left" aria-label="Previous screenshot">' +
            '<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"></path></svg>' +
            '</button>' +
            '<img id="carouselImage" class="carousel-image" src="" alt="Screenshot" />' +
            '<div id="carouselPlaceholder" class="carousel-placeholder" style="display:none;">No screenshot available</div>' +
            '<button id="nextBtn" class="win-button carousel-nav right" aria-label="Next screenshot">' +
            '<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"></path></svg>' +
            '</button>' +
            '</div>' +
            '</div>' +
            '<div class="carousel-changer-space" aria-hidden="true"></div>' +
            '<div id="carouselThumbs" class="carousel-thumbs" role="list" aria-label="Screenshot thumbnails"></div>' +
            '</div>' +
            '</section>';

        document.title = name;
        var contentEl = document.getElementById("app-content");
        if (contentEl) contentEl.innerHTML = html;

        var dlBtn = document.getElementById("dl-btn");
        if (dlBtn) {
            dlBtn.onclick = function () {
                var btn = this;
                var progressWrapper = document.getElementById("progress-wrapper");

                btn.disabled = true;
                progressWrapper.style.display = "block";

                var messagePayload = {
                    action: "downloadApp",
                    appName: name,
                    packageUrl: packageUrl,
                    platform: isPhone ? "mobile" : "desktop" // Informing the host of the platform
                };

                try {
                    window.external.notify(JSON.stringify(messagePayload));
                } catch (e) {
                    window.open(packageUrl, '_blank');
                    setTimeout(function () {
                        progressWrapper.style.display = "none";
                        btn.disabled = false;
                    }, 5000);
                }
            };
        }

        // ... [Rest of the carousel logic remains the same] ...
        try {
            var ssSection = document.querySelector(".app-screenshots");
            var anyValid = screenshots && screenshots.length > 0;
            if (!anyValid) {
                if (ssSection && ssSection.parentNode) ssSection.parentNode.removeChild(ssSection);
                return;
            }

            var items = [];
            for (var k = 0; k < screenshots.length; k++) {
                var raw = screenshots[k];
                if (isVideoUrl(raw)) {
                    items.push({ type: "video", url: raw });
                } else {
                    items.push({ type: "image", url: raw });
                }
            }

            if (!items || items.length === 0) {
                if (ssSection && ssSection.parentNode) ssSection.parentNode.removeChild(ssSection);
                return;
            }

            var viewerImg = document.getElementById("carouselImage");
            var placeholder = document.getElementById("carouselPlaceholder");
            var prevBtn = document.getElementById("prevBtn");
            var nextBtn = document.getElementById("nextBtn");
            var thumbsContainer = document.getElementById("carouselThumbs");
            var videoEl = document.createElement("video");

            videoEl.id = "carouselVideo";
            videoEl.className = "carousel-frame";
            videoEl.style.cssText = "display:none; width:100%; height:100%; background:#000;";
            videoEl.controls = true;
            viewerImg.parentNode.insertBefore(videoEl, viewerImg.nextSibling);

            var currentIndex = 0;

            function setImageWithFade(imgEl, src, onShown) {
                try { imgEl.style.transition = "opacity 320ms ease-in-out"; } catch (e) { }
                imgEl.style.opacity = 0;

                var tmp = new Image();
                tmp.onload = function () {
                    placeholder.style.display = "none";
                    imgEl.src = src;
                    setTimeout(function () {
                        imgEl.style.opacity = 1;
                        if (typeof onShown === "function") onShown();
                    }, 20);
                };
                tmp.onerror = function () {
                    imgEl.style.opacity = 0;
                    imgEl.src = "";
                    placeholder.style.display = "block";
                    if (typeof onShown === "function") onShown();
                };
                tmp.src = src;
            }

            function showItem(item) {
                viewerImg.style.display = "none";
                videoEl.style.display = "none";
                placeholder.style.display = "none";
                videoEl.src = "";

                if (item.type === "image") {
                    setImageWithFade(viewerImg, item.url);
                    viewerImg.style.display = "block";
                } else if (item.type === "video") {
                    videoEl.src = item.url;
                    videoEl.style.display = "block";
                    videoEl.play();
                }
            }

            function showIndex(i) {
                if (i < 0) i = items.length - 1;
                if (i >= items.length) i = 0;
                if (items[currentIndex] && items[currentIndex].type === "video") {
                    videoEl.pause();
                    videoEl.src = "";
                }

                currentIndex = i;
                showItem(items[currentIndex]);

                var thumbs = thumbsContainer.children;
                for (var t = 0; t < thumbs.length; t++) {
                    if (parseInt(thumbs[t].getAttribute("data-index"), 10) === currentIndex) {
                        thumbs[t].className = "carousel-thumb selected";
                    } else {
                        thumbs[t].className = "carousel-thumb";
                    }
                }
            }

            prevBtn.addEventListener("click", function () { showIndex(currentIndex - 1); });
            nextBtn.addEventListener("click", function () { showIndex(currentIndex + 1); });

            for (var m = 0; m < items.length; m++) {
                (function (idx) {
                    var thumbWrap = document.createElement("div");
                    thumbWrap.className = idx === 0 ? "carousel-thumb selected" : "carousel-thumb";
                    thumbWrap.setAttribute("data-index", idx);
                    thumbWrap.setAttribute("role", "listitem");
                    thumbWrap.setAttribute("tabindex", "0");

                    var img = document.createElement("img");
                    if (items[idx].type === "image") {
                        img.src = items[idx].url;
                    } else {
                        img.src = "https://www.freepnglogos.com/uploads/youtube-logo-hd-8.png";
                        img.style.objectFit = "contain";
                    }
                    img.alt = "Screenshot " + (idx + 1);

                    thumbWrap.appendChild(img);
                    thumbsContainer.appendChild(thumbWrap);

                    thumbWrap.addEventListener("click", function () {
                        var i = parseInt(this.getAttribute("data-index"), 10);
                        showIndex(i);
                    });
                })(m);
            }
            showIndex(0);
        } catch (ex) {
            console.error("Screenshots initialization failed:", ex);
        }
    }

    function getVal(parent, tag) {
        var el = parent.getElementsByTagName(tag)[0];
        return el ? el.textContent : "";
    }

    if (appId) { loadAppData(); }
})();