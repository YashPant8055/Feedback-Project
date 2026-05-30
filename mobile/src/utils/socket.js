import { io } from "socket.io-client";
import { API_BASE_URL } from "../constants/config";

let socket = null;

const getSocketUrl = () => {
  try {
    const parsed = new URL(API_BASE_URL);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return API_BASE_URL;
  }
};

export const initSocket = () => {
  if (!socket) {
    socket = io(getSocketUrl(), {
      transports: ["websocket", "polling"],
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
