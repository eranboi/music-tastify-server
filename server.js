const express = require("express");
const cors = require("cors");
const axios = require("axios");
const querystring = require("querystring");
const mongoose = require("mongoose");
const session = require("express-session");
const jwt = require("jsonwebtoken");
const usersRoute = require("./routes/routes");
const _ = require("lodash");
var bodyParser = require("body-parser");
require("dotenv").config();

const User = require("./models/UserModel");

mongoose
  .connect(process.env.MONGODB_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
  })
  .then((response) => {
    console.log("MongoDB Connected");
  });

const app = express();

app.use(cors());
app.options("*", cors());

app.use(bodyParser.json());

app.use(
  session({
    name: "music-tastify:sess",
    secret: "keyboard cat",
    secure: false,
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 },
  })
);

app.use("/users", usersRoute);

const client_id = process.env.SPOTIFY_CLIENT_ID;
const client_secret = process.env.SPOTIFY_CLIENT_SECRET;
const redirect_uri =
  process.env.NODE_ENV === "development"
    ? "http://localhost:8000/callback"
    : "https://music-tastify-backend.herokuapp.com/callback";
const frontend_URL =
  process.env.NODE_ENV === "development"
    ? process.env.DEVELOPMENT_FRONTEND
    : process.env.PROD_FRONTEND;
const topUrl = "https://api.spotify.com/v1/me/top";

//Spotify AUTH Route
app.get("/login", async (req, res) => {
  let origin = req.headers.referer;
  const redirect_to = req.query.redirect_to;

  console.log("Spotify auth begins");
  var scopes = "user-read-email user-top-read";

  req.session.redirect_to = redirect_to;
  req.session.frontend_URL = origin;
  console.log("session redirect_to", req.session.redirect_to);
  console.log("session frontend_URL", req.session.frontend_URL);

  if (redirect_to) {
    if (req.session.redirect_to && req.session.frontend_URL) {
      res.redirect(
        "https://accounts.spotify.com/authorize" +
          "?response_type=code" +
          "&client_id=" +
          client_id +
          (scopes ? "&scope=" + encodeURIComponent(scopes) : "") +
          "&redirect_uri=" +
          encodeURIComponent(redirect_uri)
      );
    }
  } else {
    if (req.session.frontend_URL) {
      res.redirect(
        "https://accounts.spotify.com/authorize" +
          "?response_type=code" +
          "&client_id=" +
          client_id +
          (scopes ? "&scope=" + encodeURIComponent(scopes) : "") +
          "&redirect_uri=" +
          encodeURIComponent(redirect_uri)
      );
    }
  }
});

app.get("/callback", async (req, res) => {
  const data = {
    grant_type: "authorization_code",
    code: req.query.code,
    redirect_uri,
    client_id,
    client_secret,
  };
  /* let origin = req.headers.referer;
  const redirect_to = req.query.redirect_to;
  console.log(origin, " - ", redirect_to); */
  try {
    const responseAccess = await axios.post(
      `https://accounts.spotify.com/api/token`,
      querystring.stringify(data),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
      }
    );

    const userInfo = await axios.get("https://api.spotify.com/v1/me", {
      headers: {
        Authorization: `Bearer ${responseAccess.data.access_token}`,
      },
    });

    let id;

    const userExists = await User.findOne({
      username: userInfo.data.display_name,
    });

    if (userExists) {
      id = jwt.sign({ id: userExists._id }, "process.env.JWT_SECRET");
    } else {
      const responseLongTermArtists = await axios.get(
        topUrl + "/artists?time_range=long_term&limit=30",
        {
          headers: {
            Authorization: `Bearer ${responseAccess.data.access_token}`,
          },
        }
      );

      const responseMediumTermArtists = await axios.get(
        topUrl + "/artists?time_range=medium_term&limit=30",
        {
          headers: {
            Authorization: `Bearer ${responseAccess.data.access_token}`,
          },
        }
      );

      const responseLongTermTracks = await axios.get(
        topUrl + "/tracks?time_range=long_term&limit=30",
        {
          headers: {
            Authorization: `Bearer ${responseAccess.data.access_token}`,
          },
        }
      );

      const responseMediumTermTracks = await axios.get(
        topUrl + "/tracks?time_range=medium_term&limit=30",
        {
          headers: {
            Authorization: `Bearer ${responseAccess.data.access_token}`,
          },
        }
      );

      let genres = [];

      responseMediumTermArtists.data.items.map((artist) => {
        artist.genres.map((genre) => {
          genres.push(genre);
        });
        delete artist.followers;
        delete artist.href;
        delete artist.type;
      });

      responseLongTermArtists.data.items.map((artist) => {
        artist.genres.map((genre) => {
          genres.push(genre);
        });
        delete artist.followers;
        delete artist.href;
        delete artist.type;
      });

      responseMediumTermTracks.data.items.map((track) => {
        delete track.available_markets;
        delete track.disc_number;
        delete track.duration_ms;
        delete track.external_ids;
        delete track.href;
        delete track.is_local;
        delete track.track_number;
        delete track.type;
      });

      responseLongTermTracks.data.items.map((track) => {
        delete track.available_markets;
        delete track.disc_number;
        delete track.duration_ms;
        delete track.external_ids;
        delete track.href;
        delete track.is_local;
        delete track.track_number;
        delete track.type;
      });

      const genresArray = _.values(_.groupBy(genres)).map((d) => ({
        genre: d[0],
        count: d.length,
      }));

      const genresArray_sorted = _.orderBy(genresArray, ["count"], ["desc"]);

      const user = new User();

      user.username = userInfo.data.display_name;
      user.imageURL =
        (userInfo.data.images[0] && userInfo.data.images[0].url) ||
        (!userInfo.data.images[0] && "https://via.placeholder.com/150");
      user.profileURL = userInfo.data.external_urls.spotify;
      user.artists.long_term = responseLongTermArtists.data.items;
      user.artists.medium_term = responseMediumTermArtists.data.items;
      user.tracks.long_term = responseLongTermTracks.data.items;
      user.tracks.medium_term = responseMediumTermTracks.data.items;
      user.genres = genresArray_sorted;

      const response = await user.save();
      console.log("User created");

      if (response) {
        id = jwt.sign({ id: response._id }, "process.env.JWT_SECRET");
      }
    }

    res.cookie(
      "SESSION_MUSIC_TASTIFY1",
      JSON.stringify({
        token: id,
      }),
      {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        signed: false,
        httpOnly: false,
      }
    );

    console.log("Frontend URL is:", req.session.frontend_URL);
    console.log("Redirect path is:", req.session.redirect_to);

    if (req.session.redirect_to) {
      console.log("Req Session redirect =", req.session.redirect_to);
      let url = `${req.session.frontend_URL}#/login?login_state=success&token=${id}&redirect_to=${req.session.redirect_to}`;
      console.log(`redirect url is: ${url}`);
      res.redirect(url);
    } else
      res.redirect(
        `${req.session.frontend_URL}#/login?login_state=success&token=${id}`
      );
    req.session = null;
  } catch (error) {
    console.log(error.message);
    res.send(400);
  }
});

const PORT = process.env.PORT || 8000;
var server = app.listen(PORT, () => {
  console.log("server is up and running on port", PORT);
});
