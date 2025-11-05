const express = require("express");
const { Server } = require("socket.io");
const bodyParser = require("body-parser");
const connectDB = require("./config/database");
const liveSessionRoutes = require("./routes/liveSessionRoutes");
const errorHandler = require("./middleware/errorHandler");
const notFound = require("./middleware/notFound");

// Connect to MongoDB
connectDB();

// Socket server
const io = new Server(
    {
        cors: true
    }
);

// Web server
const app = express();

// CORS middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.use("/api/live-sessions", liveSessionRoutes);

// Root route
app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "TutorArc WebRTC Backend API",
        version: "1.0.0"
    });
});

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

const emailToSocketMapping = new Map();

io.on('connection', (socket) => {
    // to join the room we required the email and roomId from the frontend
    socket.on("join-room", (data) => {
        const { email, roomId } = data;

        console.log("User is joined in the room with email ", email, " and room id ", roomId);

        emailToSocketMapping.set(email, socket.id);

        socket.join(roomId);

        socket.emit("joined-room", { roomId });

        // Hey user is joined with this email
        socket.broadcast.to(roomId).emit("User-joined", { email });
    });

    // Handle create-room event
    socket.on("create-room", async (data) => {
        const { roomId, userType } = data;
        console.log(`${userType} created room: ${roomId}`);

        socket.join(roomId);
        socket.emit("room-created", { roomId });
    });
});

// Start Express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running at port ${PORT}`);
});

// Socket server is running at port 8000
io.listen(8000);
console.log("Socket server is running at port 8000");