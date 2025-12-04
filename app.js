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
    res.render("home");
});

//show all users (insecure test endpoint)
app.get("/debug/users", (req, res) => {
    db.all("SELECT * FROM users", [], (err, rows) => {
        if (err) return res.send("Error: " + err); 
        res.json(rows); //sensitive data exposure
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

//insecure TODO creation page
app.get("/todo", (req, res) => {
    res.render("todo");
});

//insecure TODO submission (SQL Injection and Stored XSS)
app.post("/todo", (req, res) => {
    const {title, description, user_id} = req.body;

    const query = `
    INSERT INTO todos (user_id, title, description)
    VALUES ('${user_id}', '${title}', '${description}')`;

    db.run(query, (err) => {
        if(err){
            return res.send("Error inserting TODO: " + err);
        }
        res.redirect("/todos");
    });
});

//display all TODOs (stored XSS executes here)
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
