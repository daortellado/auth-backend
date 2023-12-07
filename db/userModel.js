const mongoose = require("mongoose");

// user schema
const UserSchema = new mongoose.Schema({
  // username field
  username: {
    type: String,
    required: [true, "Please provide a Username!"],
    unique: [true, "Username Exists"],
  },

  //   password field
  password: {
    type: String,
    required: [true, "Please provide a password!"],
    unique: false,
  },
  //   admin
  admin: {
    type: Boolean,
    default: false,
  },
});

// export UserSchema
module.exports = mongoose.model.Users || mongoose.model("Users", UserSchema);
