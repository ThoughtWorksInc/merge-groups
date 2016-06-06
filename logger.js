var winston = require('winston');
var req = require(process.cwd() + '/require-from-app-root').req;
var env = req('config').config;

var log_file = env.logFile || "jive_admin_add_ons.log";

var logFileName = new Date().getFullYear()+'-'+(new Date().getMonth()+1)+'-'+new Date().getDate();

winston.add(winston.transports.File, { filename: log_file, json: true });

if (process.env.NODE_ENV === 'test') {
    winston.remove(winston.transports.Console)
}

var log = function(level, title, message) {
    message = (message instanceof Array || typeof(message) === 'string') ? message : JSON.stringify(message)
    if (title) {
        message = title+' : ' +message;
    }
    winston.log(level, message)
}

module.exports = function() {
    return {
        info: function(title, message) {
            log('info', title, message)
        },
        debug: function(title, message) {
            log('debug', title, message)
        },
        error: function(title, message) {
            log('error', title, message)
        }
    }
}
