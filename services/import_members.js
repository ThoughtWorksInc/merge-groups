var jive = require('jive-sdk');
var req = require(process.cwd() + '/require-from-app-root').req;
var env = req('config').config;
var logger = req('logger')();
var groupDetails = req('services/group');
var urlCreator = req('services/JiveServicesUrlCreator');
var api = require('jive-api-client')(env.jive.url);
var R = require('ramda');
var Q= require('q');

module.exports = {
    importMembers: function (sourceGroupIDs, targetGroupID, selectedStreams) {
        var importMembersPromise = Q.defer();
        var groupsResult = [];

        var addPromises = function (targetGroupID, selectedStreams, arr, iterator) {
            var promises = arr.map(function (el) {
                return iterator(targetGroupID, el.value.followers, selectedStreams, el.value.members, el.value.sourceGroupID);
            });
            return Q.allSettled(promises);
        }
        groupDetails.getPromises(sourceGroupIDs, groupDetails.getFollowersAndMembers)
            .then(function (responses) {
                logger.info("got followers and members successfully.", {app: "importMembers", fn: "getFollowersAndMembersForAllGroups", stage: "success_callback"})
                addPromises(targetGroupID, selectedStreams, responses, groupDetails.addMembersAndFollowers)
                    .then(function (addResponse) {
                        R.map(function (res) {
                            var result = {};
                            if (res.state == "rejected") {
                                result.success = false;
                                result.url = urlCreator.getPlaceServiceUrlFor(res.reason);
                                groupsResult.push(result)
                            }
                            else {
                                result.success = true;
                                result.url = urlCreator.getPlaceServiceUrlFor(res.value);
                                groupsResult.push(result)
                            }
                        }, addResponse);
                        logger.info("added followers and members successfully.", {app: "importMembers", fn: "addMembersAndFollowers", stage: "success_callback"})
                        importMembersPromise.resolve(groupsResult);
                    }, function () {
                        logger.error("error while adding followers and members.", {app: "importMembers", fn: "addMembersAndFollowers", stage: "failure_callback"})
                        importMembersPromise.reject();
                    })
            }, function (err) {
                logger.error("error while getting followers and members.", {app: "importMembers", fn: "getFollowersAndMembersForAllGroups", stage: "failure_callback"})
                importMembersPromise.reject();
            })
        return importMembersPromise.promise;
    }
}
