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
const socketToRoomMapping = new Map();

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // to join the room we required the email and roomId from the frontend
    socket.on("join-room", (data) => {
        const { email, roomId, userType } = data;

        console.log("User is joined in the room with email ", email, " and room id ", roomId);

        emailToSocketMapping.set(email, socket.id);
        socketToRoomMapping.set(socket.id, roomId);

        // Store user type in socket data
        socket.data = { email, roomId, userType };

        socket.join(roomId);

        // Get all existing users in the room
        const room = io.sockets.adapter.rooms.get(roomId);
        const existingUsers = [];

        if (room) {
            room.forEach((socketId) => {
                if (socketId !== socket.id) {
                    const existingSocket = io.sockets.sockets.get(socketId);
                    if (existingSocket && existingSocket.data) {
                        existingUsers.push({
                            email: existingSocket.data.email,
                            socketId: socketId
                        });
                    }
                }
            });
        }

        // Send existing users to the new joiner
        socket.emit("joined-room", {
            roomId,
            existingUsers
        });

        // Notify others in the room that a user joined (with socketId for WebRTC)
        socket.broadcast.to(roomId).emit("user-joined", {
            email,
            socketId: socket.id
        });
    });

    // Handle create-room event
    socket.on("create-room", async (data) => {
        const { roomId, userType } = data;
        console.log(`${userType} created room: ${roomId}`);

        socket.join(roomId);
        socket.emit("room-created", { roomId });
    });

    // Handle WebRTC signaling
    socket.on("send-signal", (data) => {
        const { signal, to, from, roomId } = data;
        console.log(`Signal from ${from} to ${to} in room ${roomId}`);

        // Send signal to specific user
        io.to(to).emit("receive-signal", {
            signal,
            from: socket.id
        });
    });

    // Handle peer connection confirmation
    socket.on("peer-connected", (data) => {
        const { socketId } = data;
        io.to(socketId).emit("peer-connected", { socketId: socket.id });
    });

    // Handle leave-room event (user clicks leave button)
    socket.on("leave-room", (data) => {
        const { roomId } = data;
        const userData = socket.data;

        console.log('User leaving room:', socket.id, userData?.email);

        if (roomId) {
            // Notify others in the room that user left
            socket.broadcast.to(roomId).emit("user-left", {
                socketId: socket.id,
                email: userData?.email
            });

            socket.leave(roomId);
            socketToRoomMapping.delete(socket.id);
        }

        // Clean up email mapping
        if (userData?.email) {
            emailToSocketMapping.delete(userData.email);
        }
    });

    // Handle disconnection
    socket.on("disconnect", () => {
        console.log('User disconnected:', socket.id);

        const roomId = socketToRoomMapping.get(socket.id);
        const userData = socket.data;

        if (roomId) {
            // Notify others in the room that user left
            socket.broadcast.to(roomId).emit("user-left", {
                socketId: socket.id,
                email: userData?.email
            });

            socketToRoomMapping.delete(socket.id);
        }

        // Clean up email mapping
        if (userData?.email) {
            emailToSocketMapping.delete(userData.email);
        }
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