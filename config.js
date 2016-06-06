var lodash = require('lodash');
var req = require(process.cwd() + '/require-from-app-root').req;
var env = req('./env.json');
exports.config = function () {
    if (process.env.auth) {
        env = lodash.merge(env, JSON.parse(process.env.auth));
    }
    console.log("***env***", env)
    return env;
}();
