const express = require("express");
const router = express.Router()
const Tactic = require("../db/tacticsModel");

router.get('/', (req, res) => {
    const { season } = req.query;
    const query = season ? { season } : {};
    
    Tactic.find(query)
    .then(data => res.send(data))
    .catch(err => {
        console.log(err);
        res.status(500).send(err);
    })
});

module.exports = router;