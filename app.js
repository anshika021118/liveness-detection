const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 3001;

// Middleware
app.use(cors()); // Allow frontend to call API
app.use(express.json()); // Parse JSON request body

// Liveness Check API
app.post("/api/liveness-check", (req, res) => {
    const { movedLeft, movedRight } = req.body;

    if (movedLeft && movedRight) {
        return res.json({ success: true, message: "Liveness Verified!" });
    } else {
        return res.json({ success: false, message: "Liveness check failed. Move your head left and right." });
    }
});

// Start Server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
