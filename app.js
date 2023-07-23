require('dotenv').config();

const watcher = require('./watcher');

// start alert watcher
watcher.init();