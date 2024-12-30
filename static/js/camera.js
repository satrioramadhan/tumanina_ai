const videoElement = document.getElementById("video-stream");
const canvasElement = document.getElementById("video-overlay");
const canvasCtx = canvasElement.getContext("2d");
const feedbackElement = document.getElementById("feedback");
const cameraType = videoElement.dataset.camera || "front";
const movement = videoElement.dataset.movement || "";
const loadingIndicator = document.getElementById("loading-indicator");

// Threshold configurations
const feedbackDelay = 750;
const stabilityThreshold = 5 * 1000; // 5 detik
let lastAudioTime = 0;
let lastMovementTime = Date.now();
let referenceLandmarks = null;
let stableStartTime = null; // Waktu mulai stabil

// Landmark kritis untuk setiap gerakan
const movementThresholds = {
  takbir: 0.06,
  ruku: 0.09,
  itidal: 0.1,
  sujud: 0.09,
  duduk_dua_sujud: 0.07,
  tahiyat_awwal: 0.07,
  tahiyat_akhir: 0.08,
};

// Important landmarks for each movement
const movementLandmarks = {
  // Pantau kepala (0-4), bahu, siku, lutut, kaki, dan pinggul
  takbir: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31],

  // Pantau kepala dan tangan yang mengangkat sebelum ruku
  ruku: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31],

  // Pantau kepala, tangan yang terangkat saat kembali ke sikap siap
  itidal: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31],

  // Pantau kepala dan seluruh tubuh dari samping
  sujud: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31],

  // Pantau kepala dan bagian belakang tubuh
  duduk_dua_sujud: [0, 1, 2, 3, 4, 11, 12, 13, 14, 23, 24, 25, 26, 27, 28],

  // Sama seperti duduk dua sujud, pantau kepala dan bagian belakang tubuh
  tahiyat_awwal: [0, 1, 2, 3, 4, 11, 12, 13, 14, 23, 24, 25, 26, 27, 28],

  // Sama seperti tahiyat awal, dengan pantauan kepala dan bagian belakang tubuh
  tahiyat_akhir: [0, 1, 2, 3, 4, 11, 12, 13, 14, 23, 24, 25, 26, 27, 28],
};



async function loadReferenceLandmarks() {
  const loadingIndicator = document.getElementById("loading-indicator");
  
  try {
    const response = await fetch(`/static/extracted_landmarks/${movement}.json`);
    referenceLandmarks = await response.json();

    if (!referenceLandmarks || Object.keys(referenceLandmarks).length === 0) {
      throw new Error(`Invalid landmarks data for ${movement}.`);
    }

    // Pastikan spinner hilang setelah data berhasil dimuat
    if (loadingIndicator) {
      loadingIndicator.classList.add("hidden");
    }

    return referenceLandmarks;
  } catch (error) {
    console.error(`Gagal memuat landmarks untuk ${movement}:`, error);
    
    // Sembunyikan spinner jika terjadi error
    if (loadingIndicator) {
      loadingIndicator.classList.add("hidden");
    }
    
    // Bisa tambahkan feedback error ke pengguna
    const feedbackElement = document.getElementById("feedback");
    if (feedbackElement) {
      feedbackElement.textContent = "Gagal memuat data. Coba lagi.";
    }
    
    throw error; // Re-throw untuk handler di atas
  }
}




// Initialize Mediapipe Pose
const pose = new Pose({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
});

pose.setOptions({
  modelComplexity: 1,
  smoothLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
});

pose.onResults(onResults);

// Start the camera
async function startCamera(facingMode) {
  const loadingIndicator = document.getElementById("loading-indicator");
  try {
    const constraints = {
      video: {
        facingMode: facingMode === "back" ? "environment" : "user",
        width: { ideal: 1920 }, // Resolusi horizontal
        height: { ideal: 1080 }, // Resolusi vertikal
        frameRate: { ideal: 30 }, // Frame rate
      },
    };
    

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    videoElement.srcObject = stream;

    if (facingMode === "front") {
      videoElement.style.transform = "scaleX(-1)"; // Flip horizontal untuk kamera depan
    } else {
      videoElement.style.transform = "scaleX(1)";
    }

    videoElement.onloadedmetadata = () => {
      videoElement.play();
      requestAnimationFrame(sendFrameToPose);

      // Sembunyikan spinner setelah kamera siap
      if (loadingIndicator) {
        loadingIndicator.classList.add("hidden");
        console.log("Spinner disembunyikan setelah kamera siap.");
      }
    };

    feedbackElement.textContent = "Kamera siap digunakan.";
  } catch (error) {
    console.error("Error accessing camera:", error);
    feedbackElement.textContent = `Error: ${error.message}`;
    if (loadingIndicator) {
      loadingIndicator.classList.add("hidden"); // Sembunyikan spinner jika terjadi error
    }
  }
}


// Send video frame to Mediapipe Pose
async function sendFrameToPose() {
  await pose.send({ image: videoElement });
  requestAnimationFrame(sendFrameToPose);
}

// Pose detection and feedback function
function onResults(results) {
  // Sinkronisasi ukuran canvas dengan video
  canvasElement.width = videoElement.videoWidth;
  canvasElement.height = videoElement.videoHeight;

  // Bersihkan canvas
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  if (results.poseLandmarks) {
    // Gambar overlay dengan warna hijau lembut
    drawOverlay(results.poseLandmarks, "rgba(0, 255, 128, 0.8)");

    if (referenceLandmarks) {
      // Hitung rasio skala dan normalisasi
      console.log("Original Landmarks:", results.poseLandmarks);
      const scaleRatio = calculateScaleRatio(
        results.poseLandmarks,
        referenceLandmarks[Object.keys(referenceLandmarks)[0]][0].landmarks
      );
      console.log("Scale Ratio:", scaleRatio);

      const normalizedLandmarks = normalizeLandmarks(results.poseLandmarks, scaleRatio);
      console.log("Normalized Landmarks:", normalizedLandmarks);

      const isCorrect = compareLandmarks(normalizedLandmarks, movement);
      console.log(`Comparison Result: ${isCorrect ? "Correct" : "Incorrect"}`);

      if (isCorrect) {
        if (!stableStartTime) {
          stableStartTime = Date.now();
        } else if (Date.now() - stableStartTime >= stabilityThreshold) {
          console.log("Posisi benar selama 5 detik, mengalihkan ke halaman doa...");
          goToDoaPage();
          return;
        }
        feedbackElement.textContent = "Posisi sesuai, stabil...";
        feedbackElement.style.color = "green";
        drawOverlay(results.poseLandmarks, "rgba(0, 255, 128, 0.8)");
        playAudioFeedback("correct.mp3");
      } else {
        stableStartTime = null;
        feedbackElement.textContent = "Posisi belum tepat";
        feedbackElement.style.color = "red";
        drawOverlay(results.poseLandmarks, "rgba(255, 0, 0, 0.8)");
        playAudioFeedback("error.mp3");
      }
    }

    lastMovementTime = Date.now();
  }

  if (Date.now() - lastMovementTime > 2000) {
    feedbackElement.textContent = "Kamera siap digunakan";
    feedbackElement.style.color = "white";
    drawOverlay(null, "white");
  }
}



function goToDoaPage() {
  const stream = videoElement.srcObject;
  if (stream) {
    const tracks = stream.getTracks();
    tracks.forEach((track) => track.stop());
  }

  console.log(`Mengalihkan ke halaman doa untuk gerakan: ${movement}`);
  window.location.href = `/doa/${movement}`;
}

// Compare user landmarks with reference landmarks
function compareLandmarks(normalizedLandmarks, movement) {
  const movementData = referenceLandmarks;
  if (!movementData) {
    console.error(`Landmarks untuk gerakan ${movement} tidak ditemukan!`);
    return false;
  }

  const threshold = movementThresholds[movement] || 0.1; // Default threshold
  let minDistance = Infinity;

  for (const video in movementData) {
    movementData[video].forEach((frameData) => {
      const refLandmarks = frameData.landmarks;
      const distance = calculateDistance(normalizedLandmarks, refLandmarks, movement);
      if (distance < minDistance) {
        minDistance = distance;
      }
    });
  }

  console.log(`Minimum Distance for ${movement}:`, minDistance);
  return minDistance < threshold;
}



// Calculate Euclidean distance for important landmarks
function calculateDistance(userLandmarks, refLandmarks, movement) {
  const importantLandmarks = movementLandmarks[movement] || [];

  let totalDistance = 0;
  let count = 0;

  importantLandmarks.forEach((key) => {
    const userPoint = userLandmarks[key];
    const refPoint = refLandmarks[key];
    if (userPoint && refPoint) {
      const dx = userPoint.x - refPoint.x;
      const dy = userPoint.y - refPoint.y;
      const dz = userPoint.z - refPoint.z;
      totalDistance += Math.sqrt(dx * dx + dy * dy + dz * dz);
      count++;
    }
  });

  if (count === 0) {
    console.warn(`No valid landmarks found for movement: ${movement}`);
    return Infinity; // Avoid invalid distance calculation
  }

  return totalDistance / count;
}


// Draw overlay on video
function drawOverlay(landmarks, color) {
  if (!landmarks) return;

  canvasCtx.save();

  // Flip horizontal jika kamera depan
  if (cameraType === "front") {
    canvasCtx.translate(canvasElement.width, 0);
    canvasCtx.scale(-1, 1);
  }

  // Gambar koneksi antar titik (garis)
  drawConnectors(canvasCtx, landmarks, POSE_CONNECTIONS, {
    color: color,
    lineWidth: 10, // Tebalkan garis
  });

  // Gambar landmark (titik)
  drawLandmarks(canvasCtx, landmarks, {
    color: color,
    lineWidth: 7, // Tebalkan titik
  });

  canvasCtx.restore();
}


// Penyesuaian jarak kamera dan objek anak anak
function calculateScaleRatio(userLandmarks, referenceLandmarks) {
  if (!userLandmarks[11] || !userLandmarks[12] || !referenceLandmarks[11] || !referenceLandmarks[12]) {
    console.error("Missing landmarks for scale ratio calculation.");
    return 1; // Default scale ratio
  }

  const userShoulderWidth = calculateDistance(userLandmarks[11], userLandmarks[12]); // LEFT_SHOULDER & RIGHT_SHOULDER
  const referenceShoulderWidth = calculateDistance(referenceLandmarks[11], referenceLandmarks[12]);

  if (referenceShoulderWidth === 0) {
    console.error("Invalid reference shoulder width.");
    return 1; // Avoid division by zero
  }

  return userShoulderWidth / referenceShoulderWidth;
}


function normalizeLandmarks(userLandmarks, scaleRatio) {
  if (!scaleRatio || scaleRatio <= 0) {
    console.error("Invalid scale ratio for normalization.");
    return userLandmarks; // Return original if scale ratio is invalid
  }

  return userLandmarks.map((landmark) => ({
    x: landmark.x / scaleRatio,
    y: landmark.y / scaleRatio,
    z: landmark.z / scaleRatio,
    visibility: landmark.visibility,
  }));
}


// Play audio feedback
function playAudioFeedback(audioFile) {
  const currentTime = Date.now();
  if (currentTime - lastAudioTime > feedbackDelay) {
    lastAudioTime = currentTime;
    const audioPath = `/static/audio/${audioFile}`;
    new Audio(audioPath)
      .play()
      .catch((error) => console.error("Error playing audio:", error));
  } 
}

// Load landmarks and start the camera on page load
document.addEventListener("DOMContentLoaded", async () => {
  const loadingIndicator = document.getElementById("loading-indicator");
  if (loadingIndicator) {
    loadingIndicator.classList.remove("hidden"); // Tampilkan spinner
  }

  await loadReferenceLandmarks(); // Memuat data JSON
  await startCamera(cameraType);  // Inisialisasi kamera

  if (loadingIndicator) {
    loadingIndicator.classList.add("hidden"); // Sembunyikan spinner
    console.log("Spinner disembunyikan setelah semuanya siap.");
  }
});



