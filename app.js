const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// require database connection
const dbConnect = require("./db/dbConnect");
const User = require("./db/userModel");
const Video = require("./db/videoModel");
const auth = require("./auth");
const videoRoutes = require("./controllers/video.controller"); // Assuming video controller

// execute database connection
dbConnect();

// Curb Cores Error by adding a header here
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*"); // Allow requests from any origin (adjust for production)
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content, Accept, Content-Type, Authorization"
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, PATCH, OPTIONS"
  );
  next();
});

// body parser configuration
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// test

app.get("/", (request, response, next) => {
  response.json({ message: "Hey! This is your server response!" });
  next();
});

app.use("/api/video", videoRoutes); // Use video routes for video endpoints

// register endpoint
app.post("/register", (request, response) => {
  // hash the password
  bcrypt
    .hash(request.body.password, 10)
    .then((hashedPassword) => {
      // create a new user instance and collect the data
      const user = new User({
        username: request.body.username,
        password: hashedPassword,
      });

      // save the new user
      user
        .save()
        // return success if the new user is added to the database successfully
        .then((result) => {
          response.status(201).send({
            message: "User Created Successfully",
            result,
          });
        })
        // catch erroe if the new user wasn't added successfully to the database
        .catch((error) => {
          response.status(500).send({
            message: "Error creating user",
            error,
          });
        });
    })
    // catch error if the password hash isn't successful
    .catch((e) => {
      response.status(500).send({
        message: "Password was not hashed successfully",
        e,
      });
    });
});

// registervideo endpoint
app.post("/addvideo", (request, response) => {
      // create a new video instance and collect the data
      const video = new Video({
        videoname: request.body.videoname,
        game: request.body.game,
        link: request.body.link,
        tags: request.body.tags,
      });

      // save the new video
      video
        .save()
        // return success if the new video is added to the database successfully
        .then((result) => {
          response.status(201).send({
            message: "Video Created Successfully",
            result,
          });
        })
        // catch erroe if the new video wasn't added successfully to the database
        .catch((error) => {
          response.status(500).send({
            message: "Error creating video",
            error,
          });
        });
    })
;

// login endpoint
app.post("/login", (request, response) => {
  // check if username exists
  User.findOne({ username: request.body.username })

    // if username exists
    .then((user) => {
      // compare the password entered and the hashed password found
      bcrypt
        .compare(request.body.password, user.password)

        // if the passwords match
        .then((passwordCheck) => {

          // check if password matches
          if(!passwordCheck) {
            return response.status(400).send({
              message: "Passwords does not match",
              error,
            });
          }

          //   create JWT token
          const token = jwt.sign(
            {
              userId: user._id,
              userUsername: user.username,
              admin: user.admin
            },
            "RANDOM-TOKEN",
            { expiresIn: "24h" }
          );

          //   return success response
          response.status(200).send({
            message: "Login Successful",
            username: user.username,
            token,
          });
        })
        // catch error if password do not match
        .catch((error) => {
          response.status(400).send({
            message: "Passwords does not match",
            error,
          });
        });
    })
    // catch error if username does not exist
    .catch((e) => {
      response.status(404).send({
        message: "Username not found",
        e,
      });
    });
});

// free endpoint
app.get("/free-endpoint", (request, response) => {
  response.json({ message: "Admin Logged In" });
});

// authentication endpoint
app.get("/auth-endpoint", auth, (request, response) => {
  response.send({ message: "Select a game below" });
});

// New endpoint for editing video
app.put("/api/video/:videoName", auth, async (req, res) => {
  // Get video name from URL parameter
  const videoName = req.params.videoName;

  // Extract updated video data from request body
  const updatedVideo = req.body;

  try {
    // Find the video by name (assuming videoName is unique)
    const existingVideo = await Video.findOne({ videoname: videoName });

    if (!existingVideo) {
      return res.status(404).send({ message: "Video not found" });
    }

    // Update existing video properties with the provided data
    existingVideo.link = updatedVideo.link || existingVideo.link; // Update link if provided
    existingVideo.tags = updatedVideo.tags || existingVideo.tags; // Update tags if provided

    // Save the updated video
    await existingVideo.save();

    res.status(200).send({ message: "Video updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Error updating video" });
  }
});

module.exports = app;
