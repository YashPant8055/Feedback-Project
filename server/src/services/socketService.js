let io;

const init = (server) => {
  const { env } = require("../config/env");
  const { Server } = require("socket.io");
  io = new Server(server, {
    cors: {
      origin: env.corsOrigin === "*" ? "*" : env.corsOrigin.split(",").map(s => s.trim()),
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log(`[SOCKET] User connected: ${socket.id}`);

    socket.on("join-room", (roomCode) => {
      socket.join(roomCode);
      console.log(`[SOCKET] User ${socket.id} joined room ${roomCode}`);
    });

    socket.on("leave-room", (roomCode) => {
      socket.leave(roomCode);
      console.log(`[SOCKET] User ${socket.id} left room ${roomCode}`);
    });

    socket.on("disconnect", () => {
      console.log(`[SOCKET] User disconnected: ${socket.id}`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};

const emitToRoom = (roomCode, event, data) => {
  if (io) {
    io.to(roomCode).emit(event, data);
  }
};

module.exports = { init, getIO, emitToRoom };
