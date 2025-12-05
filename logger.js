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