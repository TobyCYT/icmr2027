// Variable declarations
let vid1, vid2;
let isVid1Active = true;
let currentFile = "";
let isFirstLoad = true; // <-- NEW: The flag to track our first load

// Pre-define your loop filenames
const loops = {
  night: "night.mp4",
  day: "day.mp4",
  golden: "golden-hour.mp4",
};

// Helper function to fetch sun data and crossfade
async function fetchSunDataAndPlay(sgDateString, timeNow) {
  const sunRes = await fetch(
    `https://api.sunrise-sunset.org/json?lat=1.2897&lng=103.8501&date=${sgDateString}&formatted=0`,
  );
  const sunData = await sunRes.json();

  const sunrise = new Date(sunData.results.sunrise);
  const sunset = new Date(sunData.results.sunset);

  // Define windows (25 min twilight)
  const isGolden =
    (timeNow >= new Date(sunrise.getTime() - 25 * 60000) &&
      timeNow < new Date(sunrise.getTime() + 25 * 60000)) ||
    (timeNow >= new Date(sunset.getTime() - 25 * 60000) &&
      timeNow < new Date(sunset.getTime() + 25 * 60000));

  const isDay =
    timeNow >= new Date(sunrise.getTime() + 25 * 60000) &&
    timeNow < new Date(sunset.getTime() - 25 * 60000);

  let target = isGolden ? loops.golden : isDay ? loops.day : loops.night;

  if (target !== currentFile) crossfade(target);
}

async function syncBackground() {
  try {
    // 1. The Nuclear Option: Fetch the absolute network time
    const timeRes = await fetch(
      "https://worldtimeapi.org/api/timezone/Asia/Singapore",
    );

    // Force an error if the API is down or blocks the request
    if (!timeRes.ok)
      throw new Error("WorldTimeAPI network response was not ok");

    const timeData = await timeRes.json();
    const sgDateString = timeData.datetime.split("T")[0];
    const now = new Date(timeData.utc_datetime);

    await fetchSunDataAndPlay(sgDateString, now);
  } catch (error) {
    console.error(
      "Time Sync Error: API blocked or down. Falling back to local device time.",
      error,
    );

    // 2. The Actual Fallback Code: Uses local device time if API fails
    const localNow = new Date();
    const sgDateStringFallback = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Singapore",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(localNow);

    await fetchSunDataAndPlay(sgDateStringFallback, localNow);
  }
}

function crossfade(targetFile) {
  // Safety check to ensure HTML elements actually exist
  if (!vid1 || !vid2) return;

  currentFile = targetFile;
  const active = isVid1Active ? vid1 : vid2;
  const inactive = isVid1Active ? vid2 : vid1;

  inactive.src = `media/${targetFile}`;

  // CRITICAL: Browsers block autoplay unless explicitly muted
  inactive.muted = true;

  // --- THE ASYNCHRONOUS 'PLAYING' EVENT FIX ---
  // Wait for the hardware to physically paint the pixels before showing the video
  inactive.addEventListener(
    "playing",
    () => {
      // --- THE FIRST LOAD SNAP FIX ---
      if (isFirstLoad) {
        inactive.style.transition = "none";
        active.style.transition = "none";

        inactive.style.opacity = 1;
        active.style.opacity = 0;

        void inactive.offsetHeight;

        inactive.style.transition = "opacity 2s ease-in-out";
        active.style.transition = "opacity 2s ease-in-out";

        isFirstLoad = false;
      } else {
        // --- THE STANDARD CROSSFADE ---
        inactive.style.opacity = 1;
        active.style.opacity = 0;
      }

      // Toggle the active video state ONLY after the transition begins
      isVid1Active = !isVid1Active;
    },
    { once: true },
  ); // <-- CRITICAL: Self-destructs the listener

  // Initiate the play request
  inactive.play().catch((e) => console.error("Browser blocked autoplay:", e));
}

// Wait for the HTML document to fully load before running ANY scripts
document.addEventListener("DOMContentLoaded", () => {
  // Initialize video variables safely
  vid1 = document.getElementById("vid1");
  vid2 = document.getElementById("vid2");

  // Initial call and refresh every minute
  syncBackground();
  setInterval(syncBackground, 60000);

  // --- HAMBURGER MENU LOGIC ---
  const hamburger = document.getElementById("hamburger");
  const navLinks = document.getElementById("nav-links");

  if (hamburger && navLinks) {
    hamburger.addEventListener("click", () => {
      navLinks.classList.toggle("active");
      hamburger.classList.toggle("active");
    });

    const links = navLinks.querySelectorAll("a");
    links.forEach((link) => {
      link.addEventListener("click", () => {
        navLinks.classList.remove("active");
        hamburger.classList.remove("active");
      });
    });
  }

  // --- TRUE LOADING SCREEN LOGIC ---
  const loadingScreen = document.getElementById("loading-screen");
  const progressText = document.getElementById("loading-percentage");
  const bgVideo = document.getElementById("bg-video");

  if (loadingScreen && progressText) {
    let isFullyLoaded = false;
    const zoomInStartTime = 8.0;

    // Force video to loop BEFORE the zoom-in edit happens
    if (bgVideo) {
      bgVideo.addEventListener("timeupdate", () => {
        if (!isFullyLoaded && bgVideo.currentTime >= zoomInStartTime) {
          bgVideo.currentTime = 0;
          bgVideo.play().catch((e) => console.error(e));
        }
      });
    }

    // --- THE VIP ASSET PRELOADER ---
    const vipAssets = [
      "media/golden-hour.mp4",
      "media/day.mp4",
      "media/night.mp4",
      "media/merlion-logo.svg",
      "media/sigmm.png",
      "media/smu.png",
    ];

    let loadedCount = 0;
    const totalAssets = vipAssets.length;

    let isDismissing = false;

    const dismissLoadingScreen = () => {
      if (isDismissing) return;
      isDismissing = true;

      // BAM! Hit 100% exactly as the fade-out begins
      progressText.innerText = "100%";
      loadingScreen.style.opacity = "0";

      setTimeout(() => {
        loadingScreen.style.display = "none";
        isFullyLoaded = true;
        console.log("Hardware synced. Welcome to ICMR 2027!");
      }, 1000); // 1000ms matches the CSS transition time
    };

    // ULTIMATE MASTER FAILSAFE: Drops the curtain after 8 seconds no matter what
    setTimeout(dismissLoadingScreen, 8000);

    const updateProgress = () => {
      if (isDismissing) return;

      loadedCount++;

      // UX FIX: Cap the visual loading at 99%.
      // It stays at 99% while waiting for the background video frame to decode.
      const percentage = Math.min(
        99,
        Math.floor((loadedCount / totalAssets) * 100),
      );
      progressText.innerText = percentage + "%";

      // When the network finishes caching all assets
      if (loadedCount >= totalAssets) {
        // Wait for the background video DOM element to actually be ready to paint pixels
        if ((vid1 && vid1.readyState >= 3) || (vid2 && vid2.readyState >= 3)) {
          dismissLoadingScreen();
        } else {
          if (vid1)
            vid1.addEventListener("playing", dismissLoadingScreen, {
              once: true,
            });
          if (vid2)
            vid2.addEventListener("playing", dismissLoadingScreen, {
              once: true,
            });

          // Reduced this fallback from 2500ms to 1200ms to keep the UI snappy
          // just in case the browser refuses to fire the "playing" event.
          setTimeout(dismissLoadingScreen, 1200);
        }
      }
    };

    if (totalAssets === 0) {
      updateProgress();
    }

    vipAssets.forEach((src) => {
      if (src.endsWith(".mp4") || src.endsWith(".webm")) {
        const video = document.createElement("video");
        video.muted = true;
        video.playsInline = true;
        video.preload = "auto";

        video.addEventListener("canplaythrough", updateProgress, {
          once: true,
        });
        video.addEventListener("error", updateProgress, { once: true });

        video.src = src;
        video.load();
      } else {
        const img = new Image();
        img.onload = updateProgress;
        img.onerror = updateProgress;
        img.src = src;
      }
    });
  }
});
