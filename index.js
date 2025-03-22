const express = require("express");
const multer = require("multer");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");
const faceapi = require("face-api.js");
const canvas = require("canvas");
const cors = require("cors");

// Register the canvas library with face-api.js
const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

const app = express();
const PORT = 3001;
app.use(cors())

// Configure Multer for video upload
const upload = multer({ dest: "uploads/" });

// Load Face API models
async function loadModels() {
    const modelPath = path.join(__dirname, "models/weights");

    await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath);  // Face detection
    await faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath);  // Landmark detection

    console.log("All FaceAPI models loaded successfully!");
}


loadModels();

// Video Upload API
app.post("/upload-video", upload.single("video"), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No video uploaded" });
    }

    const videoPath = req.file.path;
    const framesDir = path.join(__dirname, "frames");

    if (!fs.existsSync(framesDir)) {
        fs.mkdirSync(framesDir);
    }

    try {
        // Extract frames from video
        await extractFrames(videoPath, framesDir);

        // Process frames to detect movement
        const { isRealPerson, movedLeft, movedRight } = await detectFaceMovement(framesDir);

        // Cleanup
        fs.unlinkSync(videoPath); // Remove video after processing
        fs.rmSync(framesDir, { recursive: true, force: true }); // Remove frames
        console.log(`isRealPerson: ${isRealPerson}, movedLeft: ${movedLeft}, movedRight${movedRight}  `)
        return res.json({
            message: isRealPerson && movedLeft && movedRight ? "Liveness confirmed" : "No sufficient movement detected",
            isRealPerson,
            movedLeft,
            movedRight,
        });

    } catch (error) {
        console.error("Error processing video:", error);
        return res.status(500).json({ error: "Face analysis failed", details: error.message });
    }
});

// Extract frames from video using FFMPEG
function extractFrames(videoPath, framesDir) {
    return new Promise((resolve, reject) => {
        ffmpeg(videoPath)
            .output(path.join(framesDir, "frame-%02d.jpg")) 
            .fps(2) 
            .on("end", resolve)
            .on("error", reject)
            .run();
    });
}

// Detect face movement for liveness check
async function detectFaceMovement(framesDir) {
    const frameFiles = fs.readdirSync(framesDir);
    let lastX = null;
    let movedLeft = false;
    let movedRight = false;
    let isRealPerson = false;

    for (const file of frameFiles) {
        const filePath = path.join(framesDir, file);
        const img = await canvas.loadImage(filePath);
        
        // Detect face with landmarks
        const detection = await faceapi.detectSingleFace(img, new faceapi.SsdMobilenetv1Options())
                                       .withFaceLandmarks();

        if (detection) {
            isRealPerson = true;
            const x = detection.detection.box.x; // Get x-coordinate of face box

            if (lastX !== null) {
                if (x < lastX - 8) movedLeft = true;  
                if (x > lastX + 8) movedRight = true;
            }
            lastX = x;
            console.warn(`face detected in frame: ${file}`);

        } else {
            console.warn(`No face detected in frame: ${file}`);
        }
    }
    return { isRealPerson, movedLeft, movedRight };
}

app.get("/api/data",async(req,res)=>{
    return res.status(200).json({ msg: "Face analysis failed", code: 200 });
})




app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
