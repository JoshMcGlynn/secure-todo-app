//Insecure TODO App - Initial Setup
const express = require('express');
const bodyParser = require('body-parser');
const db = require('./db/database');
const sqlite3 = require("sqlite3").verbose();

const app = express();
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.set("view engine", "ejs");
app.use(express.static("public"));

//Insecure in-memory session store (no expiration, no protection)
let sessions = {};

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

//render register page
app.get("/register", (req, res) => {
    res.render("register");
});

//Insecure registration (stores plaintext passwords)
app.post("/register", (req, res) => {
    const {username, password} = req.body;

    const query = `INSERT INTO users (username, password) VALUES ('${username}', '${password}')`;

    db.run(query, (err) => {
        if(err){
            return res.send("Registration error: " + err);
        }
        res.redirect("/login");
    });
});

//render login page
app.get("/login", (req, res) => {
    res.render("login");
});

//insecure login: SQL Injection vulnerable 
app.post("/login", (req, res) => {
    const{username, password} = req.body;

    const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;

    db.get(query, (err, row) => {
        if(row){
            const token = Math.random().toString(36).substring(2);
            sessions[token] = {username: row.username};

            //insecure cookie: no httpOnly, secure, sameSite
            res.setHeader("Set-Cookie", `session=${token}`);
            res.redirect("/");
        }else{
            //reflected XSS vulnerability
            res.send(`<h1>Login failed for ${username}</h1>`);
        }
    });
});

app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});
