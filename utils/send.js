var req = require(process.cwd() + '/require-from-app-root').req;
var request = require('request');
var getFreshToken = req('utils/getFreshToken');
var logger = req('logger')();
var env = req('env.json');


function sendGMail(message, done) {
    getFreshToken(function (err, accessToken) {
        if (err) {
            logger.error("Error while getting google access token: ", err);
            return done(err);
        }
        var smtpMessage = [
            "From:" + env.google.userName,
            "To: " + message.to.join(','),
            "Content-type: " + (message.contentType || 'text/plain;charset=utf8'),
            "MIME-Version: 1.0"
        ].join("\r\n") + "\r\n";
        if (message.headers) for (var key in message.headers) if (message.headers.hasOwnProperty(key)) {
            smtpMessage += key + ': ' + message.headers[key] + "\r\n";
        }
        smtpMessage += "\r\n" + (message.body || "");

        request.post({
            url: "https://www.googleapis.com/upload/gmail/v1/users/me/messages/send",
            headers: {
                Authorization: 'Bearer ' + accessToken,
                'Content-Type': 'message/rfc822'
            },
            body: smtpMessage
        }, function (err, res, body) {
            if (err) {
                logger.error("Error while sending Email ", err);
                return done(err);
            }
            try {
                var ret = JSON.parse(body);
                if (ret.error) {
                    logger.error("message error", ret.error);
                    return done(err);
                }
                return done(null, ret);
            } catch (e) {
                logger.error(e);
                return done(e);
            }
        });
    });
}

module.exports = sendGMail;