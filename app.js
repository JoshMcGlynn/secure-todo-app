const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

app.get('/', (req, res) => {
    res.send("Insecure TODO App Running");
});

app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});
