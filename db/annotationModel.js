const mongoose = require("mongoose");

// annotation schema
const AnnotationSchema = new mongoose.Schema({
  // video reference field
  videoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Videos',
    required: [true, "Please provide a video ID"],
  },
  // time field
  time: {
    type: Number,
    required: [true, "Please provide a timestamp"],
  },
  // x coordinate field
  x: {
    type: Number,
    required: [true, "Please provide an x coordinate"],
  },
  // y coordinate field
  y: {
    type: Number,
    required: [true, "Please provide a y coordinate"],
  },
  // text field
  text: {
    type: String,
    required: [false],
  },
});

// export AnnotationSchema
module.exports = mongoose.model.Annotations || mongoose.model("Annotations", AnnotationSchema);