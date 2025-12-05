//Secure TODO App - Initial Setup
const express = require('express');
const bodyParser = require('body-parser');
const db = require('./db/database');
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const sanitize = require("sanitize-html");
const cookieParser = require("cookie-parser");
const csurf = require("csurf");
const helmet = require("helmet");
const session = require("express-session");

const app = express();
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.set("view engine", "ejs");
app.use(express.static("public"));

//Express session
app.use(session({
    secret: "SUPER_SECRET_KEY_CHANGE_THIS", //required
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,     //JavaScript cannot steal the cookie
        secure: false,      //must be true in HTTPS, false in localhost
        sameSite: "strict",     //stops CSRF cookie sending
        maxAge: 1000 * 60 * 15  //15-minute session expiry
    }
}));

//parse cookies, required for csurf
app.use(cookieParser());

//Enable CSRF protection
const csrfProtection = csurf({cookie: true});

//Add CSRF protection globally for all POST routes
app.use(csrfProtection);

//helmet
app.use(helmet());

//override frameguard default (so that X-FRAME-OPTIONS sets to DENY)
app.use(helmet.frameguard({action: "deny"}));

//additional security headers
app.use(
    helmet.contentSecurityPolicy({
        useDefaults: true,
        directives: {
            "default-src": ["'self'"],
            "script-src": ["'self'"],
            "object-src": ["'none'"],
            "frame-ancestors": ["'none'"]
        }
    })
);

app.use(helmet.referrerPolicy({policy: "no-referrer"}));

function isValidUsername(u){
    return typeof u === "string" && u.length >= 3 && u.length <= 20;
}

function isValidPassword(p){
    return typeof p === "string" && p.length >= 6 && p.length <= 50;
}

function isValidTodoTitle(t) {
    return typeof t === "string" && t.length >= 1 && t.length <= 100;
}

function isNumeric(n) {
    return /^[0-9]+$/.test(n);
}

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
    res.render("register", {csrfToken: req.csrfToken()});
});

//Secure registration 

    app.post("/register", async (req, res) => {
        const { username, password } = req.body;

        if (!isValidUsername(username) || !isValidPassword(password)){
            return res.send("Invalid input");
        }

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
    res.render("login", {csrfToken: req.csrfToken()});
});

//secure login - fixes SQL Injection, password exposure, weak auth
app.post("/login", (req, res) => {
    const{username, password} = req.body;

    if(!isValidUsername(username) || !isValidPassword(password)){
        return res.send("Invalid credentials");
    }

    const sql = "SELECT * FROM users WHERE username = ?";

    db.get(sql, [username], async (err, user) => {
        if(err) return res.send("DB error");
        if(!user) return res.send("Invalid Credentials");

        const match = await bcrypt.compare(password, user.password);
        if(!match) return res.send("Invalid Credentials");

        //regenerate session to prevent session fixation
        req.session.regenerate((err) => {
            if(err) return res.send("Session error");
            req.session.user = {
                id: user.id,
                username: user.username
            };

            res.redirect("/");
        });
    });
});

function requireLogin(req, res, next){
    if(!req.session.user){
        return res.redirect("/login");
    }
    next();
}

app.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.clearCookie("connect.sid");
        res.redirect("/");
    });
});

//Secure TODO Creation Page
app.get("/todo", requireLogin, (req, res) => {
    res.render("todo", {
        csrfToken: req.csrfToken(),
        user: req.session.user
    });
});

//Secure TODO submission
app.post("/todo", requireLogin, (req, res) => {
    const {title} = req.body;
    
    const user_id = req.session.user.id;

    if(!isValidTodoTitle(title) || !isNumeric(user_id)){
        return res.send("Invalid TODO input (User ID must be Numeric if you used String)");
    }

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

app.post("/todo/delete", requireLogin, (req, res) => {
    console.log("DELETE REQUEST RECEIVED: ", req.body);

    const {todo_id} = req.body;

    const sql = "DELETE FROM todos WHERE id = ? AND user_id = ?";

    db.run(sql, [todo_id, req.session.user.id], (err) => {
        if(err) return res.send("Error deleting TODO");
        res.redirect("/todos");
    });
});

app.get("/todos", requireLogin, (req, res) => {
    db.all("SELECT * FROM todos", [], (err, rows) => {
        if(err) return res.send("Error loading TODOs");

        res.render("todos", {
            todos: rows,
            csrfToken: req.csrfToken()
        });
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
