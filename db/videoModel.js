const mongoose = require("mongoose");

// video schema
const VideoSchema = new mongoose.Schema({
  // name field
  videoname : {
    type: String,
    required: [true, "Please provide an video name"],
    unique: [false],
  },
    // game field
    game: {
        type: String,
        required: [true, "Please select a game"],
        unique: [false],
      },
  //   video link field
  link: {
    type: String,
    required: [true, "Please provide a video link"],
    unique: false,
  },
  tags: [String],
});

// export VideoSchema
module.exports = mongoose.model.Videos || mongoose.model("Videos", VideoSchema);
