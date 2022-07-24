const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  descriptors: {
    type: Array,
    default: [],
  },
});

const User = mongoose.model("User", UserSchema);

module.exports = User;