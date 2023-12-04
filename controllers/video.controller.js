const express = require("express");
const router = express.Router()
const Video = require("../db/videoModel");

router.get('/', (req, res) => {
    Video.find()
    .then(data => res.send(data))
    .catch(err => console.log(err))
  })

  module.exports = router