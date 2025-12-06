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
const {log} = require("./logger");

const app = express();
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.set("view engine", "ejs");
app.use(express.static("public"));

//Express session, stores user session IDs securely and prevents client-side tampering
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
//app.get("/debug/users", (req, res) => {
//    db.all("SELECT * FROM users", [], (err, rows) => {
//        if (err) return res.send("Error: " + err); 
//        res.json(rows); 
//    });
//});

//render register page
app.get("/register", (req, res) => {
    res.render("register", {csrfToken: req.csrfToken()});
});

//Secure registration 
//Creates a new account, the password is hashed using bcrypt
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
//validates user credentials and starts a new session if correct 
app.post("/login", (req, res) => {
    const{username, password} = req.body;

    log(`LOGIN ATTEMPT: username="${username}"`);

    if(!isValidUsername(username) || !isValidPassword(password)){
        log(`LOGIN FAILED (invalid input) for username="${username}"`);
        return res.send("Invalid credentials");
    }

    const sql = "SELECT * FROM users WHERE username = ?";

    db.get(sql, [username], async (err, user) => {
        if(err) {
            log(`DB ERROR during login for username="${username}": $(err)`);
            return res.send("DB error");
        }

        if(!user) {
            log(`LOGIN FAILED (user does not exist) for username="${username}": ${err}`);
            return res.send("Invalid Credentials");
        }
        const match = await bcrypt.compare(password, user.password);
        if(!match){
            log(`LOGIN FAILED (wrong password) for username="${username}"`);
            return res.send("Invalid Credentials");
        }

        //regenerate session to prevent session fixation
        req.session.regenerate((err) => {
            if(err) {
                log(`SESSION ERROR for username="${username}":${err}`);
                return res.send("Session error");
            }
            req.session.user = {
                id: user.id,
                username: user.username
            };
            log(`LOGIN SUCCESS: user_id=${user.id}, username="${username}"`);
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
    if(req.session.user){
        log(`LOGOUT: user_id=${req.session.user.id}, username="${req.session.user.username}"`);
    }
    
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
        log(`TODO CREATE FAILED by user_id=${user_id}: Invalid Input`);
        return res.send("Invalid TODO input (User ID must be Numeric if you used String)");
    }

    //Remove ALL scripts, events, inline JS 
    const description = sanitize(req.body.description, {
        allowedTags: [],
        allowedAttributes: {}
    });

    const sql = "INSERT INTO todos (user_id, title, description) VALUES (?, ?, ?)";

    db.run(sql, [user_id, title, description], (err) => {
        if(err) {
            log(`TODO CREATE DB ERROR for user_id=${user_id}: ${err}`);
            return res.send("Error inserting TODO: " + err);
        }
        log(`TODO CREATED: user_id=${user_id}, title="${title}"`);
        res.redirect("/todos");
    });
});

app.post("/todo/delete", requireLogin, (req, res) => {

    const {todo_id} = req.body;
    log(`DELETE REQUEST: user_id=${req.session.user.id}, todo_id=${todo_id}`);
    const sql = "DELETE FROM todos WHERE id = ? AND user_id = ?";

    db.run(sql, [todo_id, req.session.user.id], (err) => {
        if(err){
            log(`TODO DELETE ERROR: todo_id=${todo_id}, by user_id=${req.session.user.id}`);
            return res.send("Error deleting TODO");
        }
        log(`TODO DELETED: todo_id=${todo_id}, by user_id=${req.session.user.id}`);
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
//app.get("/debug/clear-todos", (req, res) => {
//    db.run("DELETE FROM todos", (err) => {
//        if(err) return res.send("Error clearing todos");
//        res.send("Todos table cleared");
//    });
//});

//DEBUG: view raw todos in JSON (temp)
//app.get("/debug/todos", (req, res) => {
//    db.all("SELECT * FROM todos", [], (err, rows) => {
//        if(err) return res.send("DB Error: " + err);
//        res.json(rows);
//    });
//});

app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});
