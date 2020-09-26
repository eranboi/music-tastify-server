const express = require("express");
const router = express.Router();
const User = require("../models/UserModel");
const _ = require("lodash");

const auth = require("../middlewares/auth");
const { findOneAndUpdate } = require("../models/UserModel");

//Get own info with a token
router.get("/me", auth, (req, res) => {
  let data = req.user;
  _.omit(data, "matches");

  res.send(data);
});

//Get another users profile
router.get("/:name", async (req, res) => {
  try {
    const name = req.params.name;

    const user = await User.findOne({ username: name });

    if (user) {
      res.send(user);
    }
  } catch (error) {
    res.status(404).send();
  }
});

//get the match
router.get("/match/:id", auth, async (req, res) => {
  try {
    const id = req.params.id;
    console.log("Searching for", id);
    req.user.matches.map((match, i) => {
      if (match.id == id) {
        console.log("Found the match", id);
        res.send(match);
      }
    });
  } catch (error) {
    console.log(error.message);
  }
});

router.get("/me/matches", auth, async (req, res) => {
  try {
    req.user.matches.map((match) => {
      delete match.artists_long_term;
      delete match.artists_medium_term;
      delete match.tracks_long_term;
      delete match.tracks_medium_term;
    });
    res.send(req.user.matches);
  } catch (error) {
    console.log(error.message);
  }
});

//Leave a comment
router.post("/comment/:id", auth, async (req, res) => {
  try {
    const id = req.params.id;

    const user = await User.findById(id);
    const commenter = req.user;
    const comment = {
      user: commenter._id,
      comment: req.body.comment,
      anonym: req.body.anonym,
    };

    user.comments.concat(comment);

    await user.save();

    res.send();
  } catch (error) {
    res.status(400).send();
  }
});

//Save the match
router.post("/match/:id", auth, async (req, res) => {
  try {
    const id = req.params.id;

    const userToMatch = await User.findById(id);
    const currentUser = req.user;

    let currentMatchId = currentUser.username + " x " + userToMatch.username;
    let userToMatchId = userToMatch.username + " x " + currentUser.username;

    let matchExists = false;
    let matchExistsOnOtherUser = false;
    let match = {};

    currentUser.matches.map((match) => {
      if (match.id === currentMatchId) {
        console.log("Matched before");
        matchExists = true;
      }
    });

    userToMatch.matches.map((match) => {
      if (match.id === userToMatchId) {
        matchExistsOnOtherUser = true;
      }
    });

    if (!matchExistsOnOtherUser) {
      match = {
        ...req.body.match,
        user: currentUser._id,
        id: userToMatchId,
        userInfo: {
          username: currentUser.username,
          imageURL: currentUser.imageURL,
        },
      };

      userToMatch.matches.push(match);
      const otherUser = await userToMatch.save();
    }

    if (!matchExists) {
      match = {
        ...req.body.match,
        user: userToMatch._id,
        id: currentMatchId,
        userInfo: {
          username: userToMatch.username,
          imageURL: userToMatch.imageURL,
        },
      };

      currentUser.matches.push(match);
      const meUser = await currentUser.save();

      res.status(200).send(currentMatchId);
    }

    if (matchExists) {
      res.send(currentMatchId);
    }
  } catch (error) {
    console.log(error.message);
    res.status(400).send(error.message);
  }
});

//Fix the matches
/* router.patch("/fix", async (req, res) => {
  req.setTimeout(30 * 60 * 1000);
  console.log("fix started");

  try {
    const userArray = await User.find();

    console.log(userArray);

    userArray.map(async (user, i) => {
      console.log(user.username, "handling.");
      let newMatches = [];

      user.matches.map(async (match, i) => {
        const matchUserID = match.user;

        const matchUser = await User.findById(matchUserID);

        const userInfo = {
          username: matchUser.username,
          imageURL: matchUser.imageURL,
        };

        const newMatch = { ...match, userInfo: userInfo };

        newMatches.push(newMatch);

        if (i + 1 === user.matches.length) {
          user.matches = newMatches;
          console.log(newMatches.length);
          console.log(user.matches.length);
          const updatedUser = await user.save();
          console.log("New user saved");
        }
      });
    });
  } catch (error) {
    console.log(
      "--------ERROR--------ERROR--------ERROR--------ERROR--------ERROR--------ERROR--------ERROR--------ERROR--------ERROR--------ERROR",
      error.message
    );
  }
}); */

module.exports = router;
