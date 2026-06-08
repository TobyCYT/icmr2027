const vid1 = document.getElementById("vid1");
const vid2 = document.getElementById("vid2");
let isVid1Active = true;
let currentFile = "";

// Pre-define your loop filenames
const loops = {
  night: "night.mp4",
  day: "day.mp4",
  golden: "golden-hour.mp4", // Used for both sunrise/sunset
};

async function syncBackground() {
  // Marina Bay Coordinates
  const res = await fetch(
    "https://api.sunrise-sunset.org/json?lat=1.2897&lng=103.8501&formatted=0",
  );
  const data = await res.json();

  const now = new Date();
  const sunrise = new Date(data.results.sunrise);
  const sunset = new Date(data.results.sunset);

  // Define windows (25 min twilight)
  const isGolden =
    (now >= new Date(sunrise.getTime() - 25 * 60000) &&
      now < new Date(sunrise.getTime() + 25 * 60000)) ||
    (now >= new Date(sunset.getTime() - 25 * 60000) &&
      now < new Date(sunset.getTime() + 25 * 60000));
  const isDay =
    now >= new Date(sunrise.getTime() + 25 * 60000) &&
    now < new Date(sunset.getTime() - 25 * 60000);

  let target = isGolden ? loops.golden : isDay ? loops.day : loops.night;

  if (target !== currentFile) crossfade(target);
}

function crossfade(targetFile) {
  currentFile = targetFile;
  const active = isVid1Active ? vid1 : vid2;
  const inactive = isVid1Active ? vid2 : vid1;

  inactive.src = `media/${targetFile}`;
  inactive.play();

  inactive.style.opacity = 1;
  active.style.opacity = 0;

  isVid1Active = !isVid1Active;
}

// Initial call and refresh every minute
syncBackground();
setInterval(syncBackground, 60000);

// Wait for the HTML document to fully load before running scripts
document.addEventListener("DOMContentLoaded", () => {
  const loadingScreen = document.getElementById("loading-screen");
  const progressText = document.getElementById("loading-percentage");
  const bgVideo = document.getElementById("bg-video"); // Your video element

  // Set this to the exact second your zoom-in edit begins!
  const zoomInStartTime = 8.0;

  let loadProgress = 0;
  let isFullyLoaded = false;

  // 1. Force the video to loop BEFORE the zoom-in edit happens
  bgVideo.addEventListener("timeupdate", () => {
    if (!isFullyLoaded && bgVideo.currentTime >= zoomInStartTime) {
      bgVideo.currentTime = 0; // Jump back to the start of the loop
      bgVideo.play();
    }
  });

  // 2. Simulate network loading progress
  const loadingInterval = setInterval(() => {
    loadProgress += Math.floor(Math.random() * 15) + 5;

    if (loadProgress >= 100) {
      loadProgress = 100;
      clearInterval(loadingInterval); // Stop the numbers from counting

      // IMMEDIATELY trigger the CSS fade out
      loadingScreen.style.opacity = "0";

      // Wait 1 second for the CSS fade animation to finish, then hide the element
      setTimeout(() => {
        loadingScreen.style.display = "none";
        console.log("Loading complete, welcome to ICMR 2027!");
      }, 1000);
    }

    progressText.innerText = loadProgress + "%";
  }, 250);
});
