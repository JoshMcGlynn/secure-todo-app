//Insecure TODO App - Initial Setup
const express = require('express');
const bodyParser = require('body-parser');
const db = require('./db/database');

const app = express();
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

//Test route
app.get('/', (req, res) => {
    res.send("Insecure TODO App Running");
});

//show all users (insecure test endpoint)
app.get('/debug/users', (req, res) => {
    db.all("SELECT * FROM users", [], (err, rows) => {
        if (err) return res.send("Error: " + err);
    });
});

app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});
