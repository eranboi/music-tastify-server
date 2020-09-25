const jwt = require("jsonwebtoken");
const User = require("../models/UserModel");

const auth = async (req, res, next) => {
  try {
    //Get the token from the header
    //delete the Bearer string from header
    const token = req.header("Authorization").replace("Bearer ", "");

    //Decode the token to get the info
    const decoded = jwt.verify(token, "process.env.JWT_SECRET");

    //Find a user with that id and that token!
    const user = await User.findOne({
      _id: decoded.id,
    });

    console.log(decoded);

    if (!user) {
      throw new Error("Not authorized");
    }

    req.user = user;
    next();
  } catch (err) {
    console.log(err.message);
    res.status(401).send({ error: err.message });
  }
};

module.exports = auth;
