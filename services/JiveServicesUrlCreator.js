var req = require(process.cwd() + '/require-from-app-root').req;
var env = req('env.json');

module.exports.getPeopleServiceUrlFor = function (userid) {
    return env.jive.apiBaseUrl + "/people/" + userid;
};

module.exports.getGroupMembersServiceUrlFor = function (groupid) {
    return  env.jive.apiBaseUrl + "/members/places/" + groupid;
};

module.exports.getPlaceServiceUrlFor = function (groupid) {
    return env.jive.apiBaseUrl + '/places/' + groupid;
};

module.exports.getContentUrl = function(contentID) {
    return env.jive.apiBaseUrl+'/contents/' + contentID;
};

