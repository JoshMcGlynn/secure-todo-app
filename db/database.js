const sqlite3 = require('sqlite3').verbose();
const path = require('path');

//database file location
const dbPath = path.join(__dirname, 'db.sqlite');

//connect to SQLite (insecure - no encryption, no WAL, no PRAGMA hardening)
const db = new sqlite3.Database(dbPath, (err) => {
    if(err){
        console.error("Error creating database:", err);
    }else{
        console.log("Connected to SQLite database (INSECURE)");
    }
});

//create tables (very insecure schema)
db.serialize(() => {
    //users table - passwords stored in plaintext
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT DEFAULT 'user'
        )
    `);

    //TODOs table, description is raw text which allows stored XSS
    db.run(`
        CREATE TABLE IF NOT EXISTS todos (
        id INTEGER PRIMARY KEY AUTOINCREMENT
        user_id INTEGER,
        title TEXT,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

});

module.exports = db;