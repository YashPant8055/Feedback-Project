const os = require("os");
const dns = require("dns");
const http = require("http");
const { app, env, initialize } = require("./app");
const socketService = require("./services/socketService");

if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}

const server = http.createServer(app);

const startServer = async () => {
  await initialize();

  socketService.init(server);

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
