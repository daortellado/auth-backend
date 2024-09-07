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
const Annotation = require("./db/annotationModel");  // New import for Annotation model
const auth = require("./auth");
const videoRoutes = require("./controllers/video.controller");
const ffmpeg = require('fluent-ffmpeg');

// Import necessary modules for aws and emailjs jobs
const MediaConvert = require("aws-sdk/clients/mediaconvert");
const AWS = require("aws-sdk");
const emailjs = require("emailjs-com");

// videomerge
const { execSync } = require('child_process');
const mergeVideos = require('./mergeVideos.js');

// execute database connection
dbConnect();

// cors
app.use(cors());

// Curb Cores Error by adding a header here
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
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

// videomerge endpoint
app.post('/merge-videos', async (req, res) => {
  const { videoLinks } = req.body;

  try {
    const mergedFilename = await mergeVideos(videoLinks);
    if (mergedFilename) {
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Accept-Ranges', 'bytes');

      const mergedStream = fs.createWriteStream('merged_video.mp4');

      ffmpeg()
        // ... (your existing ffmpeg command logic for merging videos)
        .on('end', () => {
          console.log('Videos merged successfully!');
          mergedStream.close();
        })
        .pipe(mergedStream);

      mergedStream.on('error', (err) => {
        console.error('Error streaming video:', err);
        res.status(500).send('Error streaming video');
      });

      mergedStream.pipe(res);
    } else {
      res.status(500).send('Error merging videos');
    }
  } catch (error) {
    console.error('Error merging videos:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.use("/api/video", videoRoutes);

// register endpoint
app.post("/register", (request, response) => {
  bcrypt
    .hash(request.body.password, 10)
    .then((hashedPassword) => {
      const user = new User({
        username: request.body.username,
        password: hashedPassword,
      });

      user
        .save()
        .then((result) => {
          response.status(201).send({
            message: "User Created Successfully",
            result,
          });
        })
        .catch((error) => {
          response.status(500).send({
            message: "Error creating user",
            error,
          });
        });
    })
    .catch((e) => {
      response.status(500).send({
        message: "Password was not hashed successfully",
        e,
      });
    });
});

// registervideo endpoint
app.post("/addvideo", (request, response) => {
  const video = new Video({
    videoname: request.body.videoname,
    game: request.body.game,
    link: request.body.link,
    tags: request.body.tags,
  });

  video
    .save()
    .then((result) => {
      response.status(201).send({
        message: "Video Created Successfully",
        result,
      });
    })
    .catch((error) => {
      response.status(500).send({
        message: "Error creating video",
        error,
      });
    });
});

// login endpoint
app.post("/login", (request, response) => {
  User.findOne({ username: request.body.username })
    .then((user) => {
      bcrypt
        .compare(request.body.password, user.password)
        .then((passwordCheck) => {
          if(!passwordCheck) {
            return response.status(400).send({
              message: "Passwords does not match",
              error,
            });
          }

          const token = jwt.sign(
            {
              userId: user._id,
              userUsername: user.username,
              admin: user.admin
            },
            "RANDOM-TOKEN",
            { expiresIn: "24h" }
          );

          response.status(200).send({
            message: "Login Successful",
            username: user.username,
            token,
          });
        })
        .catch((error) => {
          response.status(400).send({
            message: "Passwords does not match",
            error,
          });
        });
    })
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

// Set up AWS credentials
AWS.config.update({
  accessKeyId: process.env.REACT_APP_AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.REACT_APP_AWS_SECRET_ACCESS_KEY,
  region: "us-east-1",
});

const s3 = new AWS.S3();

// Set up SendGrid transporter
const transporter = nodemailer.createTransport(sgTransport({
  auth: {
    api_key: process.env.SENDGRID_API_KEY,
  },
}));

// Endpoint for MySquadReel creation
app.post("/create-mysquadreel", async (req, res) => {
  const { playlistContent, userEmail } = req.body;

  try {
    const downloadUrl = await createMySquadReel(playlistContent);
    const emailSent = await sendEmail(userEmail, downloadUrl);

    if (emailSent) {
      res.status(200).send({ message: "MySquadReel creation and email sending successful" });
    } else {
      res.status(500).send({ message: "Error sending email" });
    }
  } catch (error) {
    console.error("Error creating MySquadReel and sending email:", error);
    res.status(500).send({ message: "Error creating MySquadReel and sending email" });
  }
});

async function createMySquadReel(playlistContent) {
  const mediaconvert = new MediaConvert({ apiVersion: "2017-08-29" });

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

  const job = await mediaconvert.createJob(jobParams).promise();

  let jobStatus;
  do {
    const { Job } = await mediaconvert.getJob({ Id: job.Job.Id }).promise();
    jobStatus = Job.Status;
    await new Promise((resolve) => setTimeout(resolve, 5000));
  } while (jobStatus !== "COMPLETE");

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
    await transporter.sendMail({
      from: '"SquadReel Admin" <contact@squadreel.com>',
      to: userEmail,
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
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

// New endpoint for editing video
app.put("/api/video/:videoName", auth, async (req, res) => {
  const videoName = req.params.videoName;
  const updatedVideo = req.body;

  try {
    const existingVideo = await Video.findOne({ videoname: videoName });

    if (!existingVideo) {
      return res.status(404).send({ message: "Video not found" });
    }

    existingVideo.link = updatedVideo.link || existingVideo.link;
    existingVideo.tags = updatedVideo.tags || existingVideo.tags;

    await existingVideo.save();

    res.status(200).send({ message: "Video updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Error updating video" });
  }
});

// Modified endpoint to include annotations
app.get("/api/video/:videoName", async (req, res) => {
  const videoName = req.params.videoName;
  const game = req.query.game;

  try {
    const video = await Video.findOne({ videoname: videoName, game: game });

    if (!video) {
      return res.status(404).send({ message: "Video not found" });
    }

    const annotations = await Annotation.find({ videoId: video._id });

    res.json({ video, annotations });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Error fetching video and annotations" });
  }
});

// New annotation routes
app.get("/api/annotations/:videoId", auth, async (req, res) => {
  try {
    const annotations = await Annotation.find({ videoId: req.params.videoId });
    res.json(annotations);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching annotations', error });
  }
});

app.post("/api/annotations", auth, async (req, res) => {
  try {
    const newAnnotation = new Annotation(req.body);
    await newAnnotation.save();
    res.status(201).json(newAnnotation);
  } catch (error) {
    res.status(500).json({ message: 'Error creating annotation', error });
  }
});

app.put("/api/annotations/:id", auth, async (req, res) => {
  try {
    const updatedAnnotation = await Annotation.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updatedAnnotation) {
      return res.status(404).json({ message: 'Annotation not found' });
    }
    res.json(updatedAnnotation);
  } catch (error) {
    res.status(500).json({ message: 'Error updating annotation', error });
  }
});

app.delete("/api/annotations/:id", auth, async (req, res) => {
  try {
    const deletedAnnotation = await Annotation.findByIdAndDelete(req.params.id);
    if (!deletedAnnotation) {
      return res.status(404).json({ message: 'Annotation not found' });
    }
    res.json({ message: 'Annotation deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting annotation', error });
  }
});

module.exports = app;