require("dotenv").config();
const mongoose = require("mongoose");

const uri = process.env.MONGODB_URI;

console.log("--- DB DEBUG START ---");
console.log("URI Length:", uri ? uri.length : 0);
console.log("URI Start:", uri ? uri.substring(0, 20) + "..." : "NOT FOUND");

if (!uri) {
  console.error("ERROR: MONGODB_URI is missing from process.env");
  process.exit(1);
}

async function testConnection() {
  try {
    console.log("Attempting connection to Atlas...");
    await mongoose.connect(uri, {
      connectTimeoutMS: 5000,
      serverSelectionTimeoutMS: 5000
    });
    console.log("SUCCESS: Connected to MongoDB Atlas!");
    process.exit(0);
  } catch (err) {
    console.error("FAILURE: Could not connect.");
    console.error("Error Name:", err.name);
    console.error("Error Message:", err.message);
    if (err.message.includes("ECONNREFUSED") || err.message.includes("querySrv")) {
      console.log("\nTIP: This specific error means the code is trying to connect, but your computer's DNS is refusing to look up the 'mongodb+srv' address.");
    }
    process.exit(1);
  }
}

testConnection();
