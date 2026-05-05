require("dotenv").config();
const os = require("os");
const dns = require("dns");
const http = require("http");
const app = require("./app");
const connectDB = require("./config/db");
const { configureCloudinary } = require("./config/cloudinary");
const { env, validateServerEnv } = require("./config/env");
const socketService = require("./services/socketService");
const { normalizeRoomCode } = require("./utils/helpers");
const Room = require("./models/Room");
const Student = require("./models/Student");

if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}

const server = http.createServer(app);

const migrateLegacyRoomCodes = async () => {
  try {
    const rooms = await Room.find({ roomCode: { $regex: /-/ } });
    if (rooms.length > 0) {
      console.log(
        `[SYNC] Found ${rooms.length} rooms with legacy dashed codes. Migrating...`
      );
      for (const room of rooms) {
        const oldCode = room.roomCode;
        const newCode = normalizeRoomCode(oldCode);

        room.roomCode = newCode;
        await room.save();

        await Student.updateMany(
          { "joinedRooms.roomCode": oldCode },
          { $set: { "joinedRooms.$.roomCode": newCode } }
        );

        await Student.updateMany(
          { "feedback.roomCode": oldCode },
          { $set: { "feedback.$[elem].roomCode": newCode } },
          { arrayFilters: [{ "elem.roomCode": oldCode }] }
        );

        console.log(`[SYNC] Migrated ${oldCode} -> ${newCode}`);
      }
    }
  } catch (err) {
    console.error(`[SYNC] Migration error: ${err.message}`);
  }
};

const startServer = async () => {
  validateServerEnv();

  await connectDB();
  configureCloudinary();
  socketService.init(server);
  await migrateLegacyRoomCodes();

  server.listen(env.port, "0.0.0.0", () => {
    const interfaces = os.networkInterfaces();
    let networkIp = "localhost";

    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === "IPv4" && !iface.internal) {
          networkIp = iface.address;
          break;
        }
      }
    }

    console.log(`
SERVER RUNNING (Modular v2.0)
Local Network: http://${networkIp}:${env.port}
Localhost:     http://localhost:${env.port}
    `);
  });

  server.timeout = 900000;
};

startServer();

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err.message);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
  if (reason && (reason.name === "Error" || reason.name === "TypeError")) {
    process.exit(1);
  }
});
