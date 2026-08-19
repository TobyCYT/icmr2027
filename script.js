// Variable declarations
let vid1, vid2;
let isVid1Active = true;
let currentFile = "";
let isFirstLoad = true;

// Pre-define your loop filenames
const loops = {
  night: "night.mp4",
  day: "day.mp4",
  golden: "golden-hour.mp4",
};

// ---------------------------------------------------------------------------
// attemptPlay — plays a video and, if autoplay is blocked, queues a retry
// on the first user gesture instead of logging an error.
// ---------------------------------------------------------------------------
function attemptPlay(videoElement) {
  if (!videoElement) return;

  // Ensure the video has started loading metadata
  if (videoElement.readyState === 0 && videoElement.src) {
    videoElement.load();
  }

  let played = false;
  const doPlay = () => {
    if (played) return;
    played = true;
    videoElement.play().catch(() => {
      // Autoplay blocked — retry once on the first user gesture
      const resume = () => {
        videoElement.play().catch(() => { });
      };
      document.addEventListener("click", resume, { once: true });
      document.addEventListener("touchstart", resume, { once: true });
      document.addEventListener("keydown", resume, { once: true });
    });
  };

  // If not enough data is buffered, wait for it; otherwise play now
  if (videoElement.readyState < 2) {
    videoElement.addEventListener("loadeddata", doPlay, { once: true });
    // Safety timeout: try playing anyway after 2s even without loadeddata
    setTimeout(doPlay, 2000);
  } else {
    doPlay();
  }
}

// ---------------------------------------------------------------------------
// getSingaporeNow — returns { now, sgDateString } using the device clock.
// new Date() is always correct UTC on any device; Intl handles SGT conversion.
// ---------------------------------------------------------------------------
function getSingaporeNow() {
  const now = new Date();
  const sgDateString = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return { now, sgDateString };
}

// ---------------------------------------------------------------------------
// syncBackground — determines the right video for the current Singapore time.
// Uses the sunrise-sunset API for precise twilight windows; falls back to
// a simple hour-based rule if the API is unavailable.
// ---------------------------------------------------------------------------
async function syncBackground() {
  const { now, sgDateString } = getSingaporeNow();

  try {
    const sunRes = await fetch(
      `https://api.sunrise-sunset.org/json?lat=1.2897&lng=103.8501&date=${sgDateString}&formatted=0`,
    );
    if (!sunRes.ok) throw new Error("Sunrise API non-OK");

    const sunData = await sunRes.json();
    const sunrise = new Date(sunData.results.sunrise);
    const sunset = new Date(sunData.results.sunset);

    const isGolden =
      (now >= new Date(sunrise.getTime() - 25 * 60000) &&
        now < new Date(sunrise.getTime() + 25 * 60000)) ||
      (now >= new Date(sunset.getTime() - 25 * 60000) &&
        now < new Date(sunset.getTime() + 25 * 60000));

    const isDay =
      now >= new Date(sunrise.getTime() + 25 * 60000) &&
      now < new Date(sunset.getTime() - 25 * 60000);

    const target = isGolden ? loops.golden : isDay ? loops.day : loops.night;
    if (target !== currentFile) crossfade(target);
  } catch {
    // Sunrise API unavailable — use approximate Singapore sunrise/sunset hours
    const sgHour = parseFloat(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Singapore",
        hour: "numeric",
        hour12: false,
      }).format(now),
    );

    const isGolden = (sgHour >= 6.0 && sgHour < 7.0) || (sgHour >= 18.5 && sgHour < 19.5);
    const isDay = sgHour >= 7.0 && sgHour < 18.5;
    const target = isGolden ? loops.golden : isDay ? loops.day : loops.night;
    if (target !== currentFile) crossfade(target);
  }
}

// ---------------------------------------------------------------------------
// crossfade — swaps the active background video with a smooth opacity blend.
// ---------------------------------------------------------------------------
function crossfade(targetFile) {
  if (!vid1 || !vid2) return;

  // If the target is already playing on the active element, do nothing
  const currentSrc = (isVid1Active ? vid1 : vid2).src;
  if (currentSrc.endsWith(targetFile) && currentFile === targetFile) return;

  currentFile = targetFile;
  const active = isVid1Active ? vid1 : vid2;
  const inactive = isVid1Active ? vid2 : vid1;

  // Skip the src assignment if this video already has the right file loaded
  if (!inactive.src.endsWith(targetFile)) {
    inactive.src = `media/${targetFile}`;
    inactive.muted = true;
  }
  // Always ensure the video loops (may have been unset)
  inactive.loop = true;

  // Wait for the hardware to actually paint pixels before fading in
  inactive.addEventListener(
    "playing",
    () => {
      if (isFirstLoad) {
        // First load: snap immediately with no transition flash
        inactive.style.transition = "none";
        active.style.transition = "none";

        inactive.style.opacity = 1;
        active.style.opacity = 0;

        void inactive.offsetHeight; // Force reflow

        inactive.style.transition = "opacity 2s ease-in-out";
        active.style.transition = "opacity 2s ease-in-out";

        isFirstLoad = false;
      } else {
        inactive.style.opacity = 1;
        active.style.opacity = 0;
      }

      isVid1Active = !isVid1Active;
    },
    { once: true },
  );

  attemptPlay(inactive);
}

// ---------------------------------------------------------------------------
// getTimeOfDayVideo — synchronously determines the correct video file
// based on Singapore time using a simple hour-based rule (no API needed).
// ---------------------------------------------------------------------------
function getTimeOfDayVideo() {
  const sgHour = parseFloat(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Singapore",
      hour: "numeric",
      hour12: false,
    }).format(new Date()),
  );

  const isGolden = (sgHour >= 6.0 && sgHour < 7.0) || (sgHour >= 18.5 && sgHour < 19.5);
  const isDay = sgHour >= 7.0 && sgHour < 18.5;
  return isGolden ? loops.golden : isDay ? loops.day : loops.night;
}

// ---------------------------------------------------------------------------
// DOMContentLoaded — wire everything up after the DOM is ready
// ---------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  // Initialize background video elements
  vid1 = document.getElementById("vid1");
  vid2 = document.getElementById("vid2");

  // --- Set the correct background video immediately (synchronous) ---
  if (vid1) {
    const initialVideo = getTimeOfDayVideo();
    currentFile = initialVideo;
    vid1.src = `media/${initialVideo}`;
    vid1.muted = true;
    vid1.loop = true;
    vid1.load();
    vid1.style.opacity = 1;
    isFirstLoad = false;

    // Play as soon as enough data is buffered
    const startPlayback = () => {
      vid1.play().catch(() => {
        // Autoplay blocked — retry on first user gesture
        const resume = () => { vid1.play().catch(() => {}); };
        document.addEventListener("click", resume, { once: true });
        document.addEventListener("touchstart", resume, { once: true });
        document.addEventListener("keydown", resume, { once: true });
      });
    };

    if (vid1.readyState >= 2) {
      startPlayback();
    } else {
      vid1.addEventListener("loadeddata", startPlayback, { once: true });
      // Safety: try playing after a short delay even if loadeddata hasn't fired
      setTimeout(startPlayback, 1500);
    }
  }

  // --- INTRO VIDEO FADE-LOOP ---
  const introVideo = document.getElementById("intro-loop-video");
  if (introVideo) {
    introVideo.playbackRate = 0.75; // slow the logo animation to half speed

    const FADE_DURATION = 800; // ms — must match CSS transition duration
    const FADE_BEFORE_END = 0.9; // seconds before video end to start fade-out
    let isFading = false;

    introVideo.addEventListener("timeupdate", () => {
      if (!isFading && introVideo.duration > 0) {
        const remaining = introVideo.duration - introVideo.currentTime;
        if (remaining <= FADE_BEFORE_END) {
          isFading = true;
          introVideo.style.opacity = "0";

          setTimeout(() => {
            introVideo.currentTime = 0;
            attemptPlay(introVideo);
            // Double rAF ensures the first frame is painted before fade-in
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                introVideo.style.opacity = "1";
                isFading = false;
              });
            });
          }, FADE_DURATION);
        }
      }
    });

    // Kick off playback (will queue a retry on first gesture if blocked)
    attemptPlay(introVideo);
  }

  // --- HAMBURGER MENU & BACKDROP OVERLAY LOGIC ---
  const hamburger = document.getElementById("hamburger");
  const navLinks = document.getElementById("nav-links");

  if (hamburger && navLinks) {
    // Ensure a backdrop overlay element exists for tap-outside-to-close behavior
    let navOverlay = document.getElementById("nav-overlay");
    if (!navOverlay) {
      navOverlay = document.createElement("div");
      navOverlay.id = "nav-overlay";
      navOverlay.className = "nav-overlay";
      document.body.appendChild(navOverlay);
    }

    const closeMenu = () => {
      navLinks.classList.remove("active");
      hamburger.classList.remove("active");
      navOverlay.classList.remove("active");
      document.body.classList.remove("menu-open");
    };

    const openMenu = () => {
      navLinks.classList.add("active");
      hamburger.classList.add("active");
      navOverlay.classList.add("active");
      document.body.classList.add("menu-open");
    };

    hamburger.addEventListener("click", (e) => {
      e.stopPropagation();
      if (navLinks.classList.contains("active")) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    // Close sidebar when tapping on the backdrop overlay
    navOverlay.addEventListener("click", closeMenu);
    navOverlay.addEventListener("touchmove", (e) => {
      e.preventDefault();
    }, { passive: false });

    // Close sidebar when tapping on any non-sidebar area in the document
    document.addEventListener("click", (e) => {
      if (
        navLinks.classList.contains("active") &&
        !navLinks.contains(e.target) &&
        !hamburger.contains(e.target)
      ) {
        closeMenu();
      }
    });

    // Close sidebar when clicking any page link (excluding dropdown toggle)
    navLinks.querySelectorAll("a:not(.dropdown-toggle)").forEach((link) => {
      link.addEventListener("click", closeMenu);
    });

    // Handle Dropdown Toggle Click (mobile & click toggle)
    const dropdownToggles = navLinks.querySelectorAll(".dropdown-toggle");
    dropdownToggles.forEach((toggle) => {
      toggle.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const parentLi = toggle.closest("li.dropdown");
        if (parentLi) {
          parentLi.classList.toggle("open");
        }
      });
    });

    // Automatically highlight active page link and parent dropdown
    const currentPath = window.location.pathname.toLowerCase();
    navLinks.querySelectorAll("a[href]").forEach((link) => {
      const href = link.getAttribute("href");
      if (!href || href.startsWith("javascript:")) return;
      const hrefLower = href.toLowerCase();
      if (
        (hrefLower === "/" && (currentPath === "/" || currentPath.endsWith("/index.html") || currentPath === "")) ||
        (hrefLower !== "/" && (currentPath.includes(hrefLower) || currentPath.endsWith(hrefLower + ".html")))
      ) {
        link.classList.add("active");
        const parentDropdown = link.closest("li.dropdown");
        if (parentDropdown) {
          const toggle = parentDropdown.querySelector(".dropdown-toggle");
          if (toggle) toggle.classList.add("active");
        }
      }
    });
  }

  // --- DYNAMIC NAVBAR OVERFLOW DETECTION ---
  const navContainer = document.querySelector(".nav-container");
  const navbarBrand = document.querySelector(".navbar-brand");
  const navLinksUl = document.getElementById("nav-links");

  if (navContainer && navbarBrand && navLinksUl) {
    const checkNavOverflow = () => {
      const wasOverflow = document.body.classList.contains("is-mobile-nav");
      document.body.classList.remove("is-mobile-nav");

      const brandWidth = navbarBrand.getBoundingClientRect().width;
      const linksWidth = navLinksUl.scrollWidth;
      const containerWidth = navContainer.getBoundingClientRect().width;

      // Calculate total required width with a 40px margin buffer
      const requiredWidth = brandWidth + linksWidth + 40;

      if (containerWidth < requiredWidth) {
        document.body.classList.add("is-mobile-nav");
      } else {
        document.body.classList.remove("is-mobile-nav");
      }
    };

    checkNavOverflow();
    window.addEventListener("resize", checkNavOverflow);
  }

  // --- LOADING SCREEN LOGIC ---
  const loadingScreen = document.getElementById("loading-screen");
  const progressText = document.getElementById("loading-percentage");
  const bgVideo = document.getElementById("bg-video");

  if (loadingScreen && progressText) {
    let isFullyLoaded = false;
    const zoomInStartTime = 8.0;

    // Loop the loading video before its zoom-in edit point
    if (bgVideo) {
      bgVideo.addEventListener("timeupdate", () => {
        if (!isFullyLoaded && bgVideo.currentTime >= zoomInStartTime) {
          bgVideo.currentTime = 0;
          bgVideo.play().catch(() => { });
        }
      });
    }

    // VIP assets to preload before dismissing the loading screen
    const vipAssets = [
      "media/golden-hour.mp4",
      "media/day.mp4",
      "media/night.mp4",
      "media/merlion-logo.svg",
      "media/sigmm.png",
      "media/smu.png",
      "media/6estates.png",
    ];

    let loadedCount = 0;
    const totalAssets = vipAssets.length;
    let isDismissing = false;

    const dismissLoadingScreen = () => {
      if (isDismissing) return;
      isDismissing = true;

      progressText.innerText = "100%";
      loadingScreen.style.opacity = "0";

      setTimeout(() => {
        loadingScreen.style.display = "none";
        isFullyLoaded = true;
      }, 1000);
    };

    // Hard failsafe: drop the curtain after 8 seconds regardless
    setTimeout(dismissLoadingScreen, 8000);

    const updateProgress = () => {
      if (isDismissing) return;

      loadedCount++;
      const percentage = Math.min(99, Math.floor((loadedCount / totalAssets) * 100));
      progressText.innerText = percentage + "%";

      if (loadedCount >= totalAssets) {
        if ((vid1 && vid1.readyState >= 3) || (vid2 && vid2.readyState >= 3)) {
          dismissLoadingScreen();
        } else {
          if (vid1) vid1.addEventListener("playing", dismissLoadingScreen, { once: true });
          if (vid2) vid2.addEventListener("playing", dismissLoadingScreen, { once: true });
          setTimeout(dismissLoadingScreen, 1200);
        }
      }
    };

    if (totalAssets === 0) updateProgress();

    vipAssets.forEach((src) => {
      if (src.endsWith(".mp4") || src.endsWith(".webm")) {
        const video = document.createElement("video");
        video.muted = true;
        video.playsInline = true;
        video.preload = "auto";
        video.addEventListener("canplaythrough", updateProgress, { once: true });
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

  // Sync video background (API-based refinement), then refresh every minute
  syncBackground();
  setInterval(syncBackground, 60000);

  // Initialize Calendar Dropdowns
  initCalendarDropdowns();
});

function initCalendarDropdowns() {
  document.querySelectorAll(".cal-dropdown").forEach((dropdown) => {
    const btn = dropdown.querySelector(".cal-btn");
    const menu = dropdown.querySelector(".cal-menu");
    if (!btn || !menu) return;

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      document.querySelectorAll(".cal-menu.show").forEach((m) => {
        if (m !== menu) {
          m.classList.remove("show");
          m.previousElementSibling?.classList.remove("active");
        }
      });
      menu.classList.toggle("show");
      btn.classList.toggle("active");
    });

    const title = btn.dataset.title || "ICMR 2027 Event";
    const startDate = btn.dataset.start;
    const endDate = btn.dataset.end;
    const type = btn.dataset.type || "aoe";

    let isoStart, isoEnd, desc, dStartObj, dEndObj;

    if (type === "aoe") {
      dEndObj = new Date(startDate + "T23:59:59-12:00");
      dStartObj = new Date(dEndObj.getTime() - 3600 * 1000);
      isoStart = dStartObj.toISOString().replace(/-|:|\.\d\d\d/g, "");
      isoEnd = dEndObj.toISOString().replace(/-|:|\.\d\d\d/g, "");
      desc = `Deadline for ${title} (11:59:59 PM Anywhere on Earth). https://www.icmr2027.org`;
    } else {
      dStartObj = new Date(startDate + "T09:00:00+08:00");
      dEndObj = new Date((endDate || startDate) + "T18:00:00+08:00");
      isoStart = dStartObj.toISOString().replace(/-|:|\.\d\d\d/g, "");
      isoEnd = dEndObj.toISOString().replace(/-|:|\.\d\d\d/g, "");
      desc = `ICMR 2027 Conference in Singapore. https://www.icmr2027.org`;
    }

    const gcalLink = menu.querySelector(".cal-gcal");
    if (gcalLink) {
      gcalLink.href = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${isoStart}/${isoEnd}&details=${encodeURIComponent(desc)}&location=${encodeURIComponent("Singapore / AoE")}`;
    }

    const outlookLink = menu.querySelector(".cal-outlook");
    if (outlookLink) {
      outlookLink.href = `https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${encodeURIComponent(title)}&startdt=${dStartObj.toISOString()}&enddt=${dEndObj.toISOString()}&body=${encodeURIComponent(desc)}&location=${encodeURIComponent("Singapore / AoE")}`;
    }

    const icsLink = menu.querySelector(".cal-ics");
    if (icsLink) {
      icsLink.addEventListener("click", (e) => {
        e.preventDefault();
        const icsContent = [
          "BEGIN:VCALENDAR",
          "VERSION:2.0",
          "PRODID:-//ICMR 2027//EN",
          "BEGIN:VEVENT",
          `SUMMARY:${title}`,
          `DESCRIPTION:${desc}`,
          `DTSTART:${isoStart}`,
          `DTEND:${isoEnd}`,
          "LOCATION:Singapore / AoE",
          "END:VEVENT",
          "END:VCALENDAR"
        ].join("\r\n");

        const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
        const a = document.createElement("a");
        a.href = window.URL.createObjectURL(blob);
        a.download = `${title.toLowerCase().replace(/[^a-z0-9]/g, "-")}.ics`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      });
    }
  });

  document.addEventListener("click", () => {
    document.querySelectorAll(".cal-menu.show").forEach((m) => {
      m.classList.remove("show");
      m.previousElementSibling?.classList.remove("active");
    });
  });
}
