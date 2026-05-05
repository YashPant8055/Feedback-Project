const mongoose = require('mongoose');
require('dotenv').config();

const RoomSchema = new mongoose.Schema({
  roomCode: String,
  status: String
}, { collection: 'rooms' });

const Room = mongoose.model('Room', RoomSchema);

async function check() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const count = await Room.countDocuments();
    const rooms = await Room.find().limit(5);
    console.log(`Total Rooms in 'rooms' collection: ${count}`);
    console.log(`Sample Rooms:`, JSON.stringify(rooms, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
