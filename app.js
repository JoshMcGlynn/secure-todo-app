//Secure TODO App - Initial Setup
const express = require('express');
const bodyParser = require('body-parser');
const db = require('./db/database');
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const sanitize = require("sanitize-html");

const app = express();
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.set("view engine", "ejs");
app.use(express.static("public"));

//converts dangerous characters to harmless text
function escapeHTML(str){
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
}

//TEMP: simple in-memory session store (to be replaced with secure version)
let sessions = {};

//Test route
app.get('/', (req, res) => {
    res.render("home");
});

//show all users (insecure test endpoint)
app.get("/debug/users", (req, res) => {
    db.all("SELECT * FROM users", [], (err, rows) => {
        if (err) return res.send("Error: " + err); 
        res.json(rows); 
    });
});

//render register page
app.get("/register", (req, res) => {
    res.render("register");
});

//Secure registration 

    app.post("/register", async (req, res) => {
        const { username, password } = req.body;

        try{
        //secure hashing
            const hashedPassword = await bcrypt.hash(password, 10);

            const sql = "INSERT INTO users (username, password) VALUES (?, ?)";

            db.run(sql, [username, hashedPassword], (err) => {
                if(err) return res.send("Registration error: " + err);
                res.redirect("/login");
            });
        }catch (error){
            res.send("Error hashing password");
        }
    });

//render login page
app.get("/login", (req, res) => {
    res.render("login");
});

//secure login - fixes SQL Injection, password exposure, weak auth
app.post("/login", (req, res) => {
    const{username, password} = req.body;

    const sql = "SELECT * FROM users WHERE username = ?";

    db.get(sql, [username], async (err, user) => {
        if(err) return res.send("DB error");

        if(!user) return res.send(`<h1>Login failed for ${escapeHTML(username)}</h1>`);

        const match = await bcrypt.compare(password, user.password);

        if(!match) return res.send(`<h1>Login failed for ${escapeHTML(username)}</h1>`);

        //secure session cookie will be added later
        const token = Math.random().toString(36).substring(2);
        sessions[token] = {username: user.username};

        res.setHeader(
            "Set-Cookie",
            `session=${token}; HttpOnly; SameSite=Strict`
        );

        res.redirect("/");
    });
});

//Secure TODO Creation Page
app.get("/todo", (req, res) => {
    res.render("todo");
});

//Secure TODO submission
app.post("/todo", (req, res) => {
    const {title, user_id} = req.body;

    //Remove ALL scripts, events, inline JS 
    const description = sanitize(req.body.description, {
        allowedTags: [],
        allowedAttributes: {}
    });

    const sql = "INSERT INTO todos (user_id, title, description) VALUES (?, ?, ?)";

    db.run(sql, [user_id, title, description], (err) => {
        if(err) return res.send("Error inserting TODO: " + err);
        res.redirect("/todos");
    });
});


app.get("/todos", (req, res) => {
    db.all("SELECT * FROM todos", [], (err, rows) => {
        if(err) return res.send("Error loading TODOs");

        res.render("todos", {todos: rows});
    });
});

//TEMP: clear all todos (for XSS Testing)
app.get("/debug/clear-todos", (req, res) => {
    db.run("DELETE FROM todos", (err) => {
        if(err) return res.send("Error clearing todos");
        res.send("Todos table cleared");
    });
});

//DEBUG: view raw todos in JSON (temp)
app.get("/debug/todos", (req, res) => {
    db.all("SELECT * FROM todos", [], (err, rows) => {
        if(err) return res.send("DB Error: " + err);
        res.json(rows);
    });
});

app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});
