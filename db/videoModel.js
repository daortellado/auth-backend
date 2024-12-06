const mongoose = require("mongoose");

const VideoSchema = new mongoose.Schema({
  videoname: {
    type: String,
    required: [true, "Please provide an video name"],
    unique: false,
  },
  game: {
    type: String,
    required: [true, "Please select a game"],
    unique: false,
  },
  link: {
    type: String,
    required: [true, "Please provide a video link"],
    unique: false,
  },
  tags: [String],
  season: {
    type: String,
    required: true,
    default: "current"
  }
});

module.exports = mongoose.model.Videos || mongoose.model("Videos", VideoSchema);