const mongoose = require("mongoose");

const userSchema = mongoose.Schema({
  username: { type: String, required: true },
  imageURL: {
    type: String,
    required: true,
    default: "https://via.placeholder.com/150",
  },
  profileURL: { type: String, required: true },
  artists: {
    long_term: [{}],
    medium_term: [{}],
  },
  tracks: {
    long_term: [{}],
    medium_term: [{}],
  },
  comments: [
    {
      user: { type: mongoose.Schema.Types.ObjectId },
      comment: { type: String, required: true },
      anonym: { type: Boolean, required: true, default: false },
    },
  ],
  matches: [{}],
  genres: [{}],
});

module.exports = mongoose.model("User", userSchema);
