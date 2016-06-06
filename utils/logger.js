var winston = require('winston');
var req = require(process.cwd() + '/require-from-app-root').req;
var fs = require('fs');
var string = require('string');
var jive = require('jive-sdk');
var env = req('config').config;

console_logger = string(process.env.CONSOLE_LOGGER).toBoolean() || false;
logger_level = process.env.LOGGER_LEVEL || "info";
jive_logger_level = process.env.JIVE_LOGGER_LEVEL || "error";
var log_file = env.logFile || "jive_admin_add_ons.log";

jive.logger.setLevel(jive_logger_level);
 
var logger = new (winston.Logger)({
    transports: [
        new (winston.transports.Console)({level: logger_level, debugStdout:true}),
        new (winston.transports.File)({ filename: log_file, json: true, maxsize: 1024*1024*5, level: logger_level})
    ]
});

if (!console_logger) {
    logger.remove(winston.transports.Console);
}

module.exports = {
    info: function() {
        logger.info.apply(this,arguments);
    },
    debug: function() {
        logger.debug.apply(this,arguments);
    },
    error: function() {
        logger.error.apply(this,arguments);
    }
};
