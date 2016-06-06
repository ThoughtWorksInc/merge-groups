var request = require('request');
var req = require(process.cwd() + '/require-from-app-root').req;

var env = req('env.json');
var xoauth2 = require("xoauth2");
var xoauth2gen;



function getFreshToken(done) {

    xoauth2gen = xoauth2.createXOAuth2Generator({
        user: env.google.user,
        clientId: env.google.clientId,
        clientSecret: env.google.clientSecret,
        refreshToken: env.google.refreshToken
    });

   xoauth2gen.getToken(function(err, token, accessToken){
        if(err){
            return done(err,null);
        }
        done(null,accessToken)
   });
}

module.exports = getFreshToken;
