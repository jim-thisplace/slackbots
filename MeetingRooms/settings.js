var fs = require('fs');
var SETTINGS = JSON.parse(fs.readFileSync('settings.json'));
module.exports = SETTINGS;