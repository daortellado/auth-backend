const mongoose = require("mongoose");

const TacticsSchema = new mongoose.Schema({
  videoname: {
    type: String,
    required: [true, "Please provide a video name"],
    unique: false,
  },
  session: {
    type: String,
    required: [true, "Please select a session"],
    unique: false,
  },
  link: {
    type: String,
    required: [true, "Please provide a video link"],
    unique: false,
  },
  season: {
    type: String,
    required: true,
    default: "current"
  }
});

module.exports = mongoose.model.Tactics || mongoose.model("Tactics", TacticsSchema);