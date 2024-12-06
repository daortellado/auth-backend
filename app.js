const express = require("express");
const cors = require('cors');
const app = express();
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const sgTransport = require("nodemailer-sendgrid-transport");

// require database connection
const dbConnect = require("./db/dbConnect");
const User = require("./db/userModel");
const Video = require("./db/videoModel");
const auth = require("./auth");
const videoRoutes = require("./controllers/video.controller"); // Assuming video controller
const ffmpeg = require('fluent-ffmpeg');

// Import necessary modules for aws and emailjs jobs
const MediaConvert = require("aws-sdk/clients/mediaconvert");
const AWS = require("aws-sdk");
const emailjs = require("emailjs-com");

// //videomerge
const { execSync } = require('child_process'); // For ffmpeg execution
const mergeVideos = require('./mergeVideos.js'); // Adjust the path

// execute database connection
dbConnect();

// cors
app.use(cors());

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

//videomerge endpoint
app.post('/merge-videos', async (req, res) => {
  const { videoLinks } = req.body;

  try {
    const mergedFilename = await mergeVideos(videoLinks);
    if (mergedFilename) {
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Accept-Ranges', 'bytes'); // Allow byte-range requests

      const mergedStream = fs.createWriteStream('merged_video.mp4'); // Adjust filename if needed

      ffmpeg()
        // ... (your existing ffmpeg command logic for merging videos)
        .on('end', () => {
          console.log('Videos merged successfully!');
          mergedStream.close(); // Close the stream after ffmpeg finishes
        })
        .pipe(mergedStream);

      mergedStream.on('error', (err) => {
        console.error('Error streaming video:', err);
        res.status(500).send('Error streaming video');
      });

      mergedStream.pipe(res); // Pipe the stream to the response
    } else {
      res.status(500).send('Error merging videos');
    }
  } catch (error) {
    console.error('Error merging videos:', error);
    res.status(500).send('Internal Server Error');
  }
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

//archive season
app.post("/api/archive-season", auth, async (req, res) => {
  const { seasonName } = req.body;
  try {
    await Video.updateMany(
      { season: "current" },
      { $set: { season: seasonName } }
    );
    res.status(200).send({ message: "Season archived successfully" });
  } catch (error) {
    res.status(500).send({ message: "Error archiving season", error });
  }
});

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

// Moving CreateSquadReel logic to backend
// Set up AWS credentials
AWS.config.update({
  accessKeyId: process.env.REACT_APP_AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.REACT_APP_AWS_SECRET_ACCESS_KEY,
  region: "us-east-1", // Adjust the region as needed
});

const s3 = new AWS.S3();

// Set up SendGrid transporter
const transporter = nodemailer.createTransport(sgTransport({
  auth: {
    api_key: process.env.SENDGRID_API_KEY, // Your SendGrid API key
  },
}));

// Endpoint for MySquadReel creation
app.post("/create-mysquadreel", async (req, res) => {
  const { playlistContent, userEmail } = req.body;

  try {
    // Create MediaConvert job
    const downloadUrl = await createMySquadReel(playlistContent);

    // Send email with the download URL
    const emailSent = await sendEmail(userEmail, downloadUrl);

    if (emailSent) {
      // Respond to client indicating success
      res.status(200).send({ message: "MySquadReel creation and email sending successful" });
    } else {
      // Handle if email sending fails
      res.status(500).send({ message: "Error sending email" });
    }
  } catch (error) {
    console.error("Error creating MySquadReel and sending email:", error);
    // Handle errors and respond accordingly
    res.status(500).send({ message: "Error creating MySquadReel and sending email" });
  }
});

async function createMySquadReel(playlistContent) {
  // Initialize MediaConvert instance
  const mediaconvert = new MediaConvert({ apiVersion: "2017-08-29" });

  // Set up job parameters
  const jobParams = {
    Role: "arn:aws:iam::816121288668:role/AWSMediaConvertReact",
    Settings: {
      Inputs: playlistContent.map((url) => ({
        FileInput: url,
        AudioSelectors: {
          "Audio Selector 1": {
            Offset: 0,
            DefaultSelection: "DEFAULT",
            ProgramSelection: 1,
          },
        },
      })),
      OutputGroups: [
        {
          Name: "SingleOutputGroup",
          OutputGroupSettings: {
            Type: "FILE_GROUP_SETTINGS",
            FileGroupSettings: {
              Destination: "s3://mysquadreeldownload/MySquadReel",
            },
          },
          Outputs: [
            {
              Preset: "System-Generic_Sd_Mp4_Avc_Aac_16x9_Sdr_640x360p_30Hz_0.8Mbps_Qvbr_Vq7",
              NameModifier: `_${Date.now()}`,
              VideoDescription: {
                Width: 1280,
                Height: 720,
                VideoPreprocessors: {
                  ImageInserter: {
                    InsertableImages: [
                      {
                        ImageX: 100,
                        ImageY: 25,
                        Height: 75,
                        Width: 75,
                        Layer: 1,
                        ImageInserterInput: "s3://squadreelogo/squadreel.png",
                        Opacity: 50,
                      },
                    ],
                  },
                },
              },
            },
          ],
        },
      ],
    }
  };

  // Create MediaConvert job
  const job = await mediaconvert.createJob(jobParams).promise();

  // Wait for job completion
  let jobStatus;
  do {
    const { Job } = await mediaconvert.getJob({ Id: job.Job.Id }).promise();
    jobStatus = Job.Status;
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait for 5 seconds before checking job status again
  } while (jobStatus !== "COMPLETE");

  // Generate download URL for the output file
  const bucket = "mysquadreeldownload";
  const key = "MySquadReel" + jobParams.Settings.OutputGroups[0].Outputs[0].NameModifier + ".mp4";
  const params = {
    Bucket: bucket,
    Key: key,
    Expires: 3600,
  };
  const downloadUrl = s3.getSignedUrl("getObject", params);

  return downloadUrl;
}

async function sendEmail(userEmail, downloadUrl) {
  try {
    // Send email using nodemailer
    await transporter.sendMail({
      from: '"SquadReel Admin" <contact@squadreel.com>', // Sender name and email address
      to: userEmail, // Recipient email address
      subject: 'Your highlights are here 🎞️',
      html: `
      <div style="font-family: Arial, sans-serif;">
      <h2 style="color: #333;">Good news - they're ready!</h2>
      <p style="color: #666;">The clips you selected are now available below:</p>
      <a href="${downloadUrl}" style="background-color: #007bff; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Download MySquadReel</a>
      <p><em>This link will only be active for 24 hours.</em></p>
      <p>&nbsp;</p>
      <p><img src="https://squadreel.com/squadreellogo.png" style="width:20%" alt="img"></p>
      </div>
      `,
    });
    return true; // Email sent successfully
  } catch (error) {
    console.error('Error sending email:', error);
    return false; // Email sending failed
  }
}

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

app.get("/api/video/:videoName", async (req, res) => {
  const videoName = req.params.videoName;
  const game = req.query.game; // Access game from query parameter

  try {
    const video = await Video.findOne({ videoname: videoName, game: game });

    if (!video) {
      return res.status(404).send({ message: "Video not found" });
    }

    // Handle retrieving and sending the video data...
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Error fetching video" });
  }
});

module.exports = app;
