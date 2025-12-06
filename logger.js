//logger.js is a simple logging module used to record important security events
//such as failed logins, actions, and database errors
const fs = require("fs");
const path = require("path");

const logPath = path.join(__dirname, "logs", "app.log");

//ensure that the log file exists
if(!fs.existsSync(path.dirname(logPath))){
    fs.mkdirSync(path.dirname(logPath));
}

function log(message){
    const entry = `[${new Date().toISOString()}] ${message}\n`;
    fs.appendFileSync(logPath, entry);
    console.log(entry.trim());
}

module.exports = {log};