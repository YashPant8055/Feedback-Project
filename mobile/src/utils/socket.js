import { io } from "socket.io-client";
import { API_BASE_URL } from "../constants/config";

let socket = null;

export const initSocket = () => {
  if (!socket) {
    socket = io(API_BASE_URL, {
      transports: ["websocket"],
      reconnectionAttempts: 10,
    });

    socket.on("connect", () => {
      console.log("[SOCKET] Connected to server");
    });

    socket.on("connect_error", (err) => {
      console.error("[SOCKET] Connection error:", err.message);
    });
  }
  return socket;
};

export const getSocket = () => {
  if (!socket) return initSocket();
  return socket;
};

export const joinRoom = (roomCode) => {
  const s = getSocket();
  s.emit("join-room", roomCode);
};

export const leaveRoom = (roomCode) => {
  const s = getSocket();
  s.emit("leave-room", roomCode);
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
