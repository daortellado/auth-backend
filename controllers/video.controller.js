const express = require("express");
const router = express.Router()
const Video = require("../db/videoModel");

router.get('/', (req, res) => {
    const { season } = req.query;
    const query = season ? { season } : {};
    
    Video.find(query)
    .then(data => res.send(data))
    .catch(err => {
        console.log(err);
        res.status(500).send(err);
    })
});

module.exports = router;