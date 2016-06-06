var req = require(process.cwd() + '/require-from-app-root').req;
var env = req('config').config;
var jive = require('jive-sdk');
var structuredLogger = req('utils/logger');
var Q = require('q');
var urlCreator = req('services/JiveServicesUrlCreator');
var content = req('services/content');
var R = require('ramda');


var getCommunity = function(){
    var deferred = Q.defer();
    structuredLogger.debug("Retrieving community object");
    jive.context.persistence.findByID("community", env.jive.url)
        .then(function(community){
            structuredLogger.debug("Successfully retrieved community");
            deferred.resolve(community);
        }, function(error){
            structuredLogger.debug("Error in retrieving community", error);
            deferred.reject(error);
        });
    return deferred.promise;
};

var mergeContent = function(sourceGroupIds, targetGroupId){
    var deferred = Q.defer();
    var sourceGroupUrls = R.map(function(groupId){
        return urlCreator.getPlaceServiceUrlFor(groupId);
    }, sourceGroupIds);

    structuredLogger.debug("Source group urls", sourceGroupUrls);
    var groupUrl = sourceGroupUrls.join(",");
    var groupsUrl = env.jive.apiBaseUrl + "/contents?includeBlogs=true&filter=place(" + groupUrl + ")";

    var targetGroupUrl = urlCreator.getPlaceServiceUrlFor(targetGroupId);
    getCommunity().then(function(community){
        Q.all([content.getGroupsContent(groupsUrl),
            content.getSourceContentTypes(sourceGroupUrls),
            content.getBlogPlace(targetGroupUrl)])
            .then(function(resp){
                var contentIDs = resp[0];
                var contentTypes = resp[1];
                var targetBlogPlaceUrl = resp[2];
                content.updateGroupContentTypes(targetGroupUrl, contentTypes)
                    .then(function(){
                        structuredLogger.debug("# of Content IDs Retrieved : ", contentIDs.length);

                        if (contentIDs.length > 0){
                            content.processContent(community,contentIDs,targetGroupUrl,targetBlogPlaceUrl)
                                .then(function(){
                                content.compileResults(sourceGroupUrls).then(function(results){
                                    var fulfilledResults = R.map(function(result){
                                        return result.value;
                                    }, results);
                                    deferred.resolve(fulfilledResults);
                                });
                            }, function(){
                                content.compileResults(sourceGroupUrls).then(function(results){
                                    var fulfilledResults = R.map(function(result){
                                        return result.value;
                                    }, results);
                                    deferred.resolve(fulfilledResults);
                                });
                            });
                        }else{
                            content.compileResults(sourceGroupUrls).then(function(results){
                                var fulfilledResults = R.map(function(result){
                                    return result.value;
                                }, results);
                                deferred.resolve(fulfilledResults);
                            });
                        }
                    })
            }, function(error){deferred.reject(error);})
        }, function(error){deferred.reject(error);});
    return deferred.promise;
};

module.exports = {
    mergeContent:function(sourceGroupIds, targetGroupId){
        var deferred = Q.defer();

        var trials = 2;
        var tried = 0;

        var recursivefn = function(){
            tried = tried + 1;
            mergeContent(sourceGroupIds, targetGroupId).then(function(results){
                var failures = R.filter(function(result){
                    return !result.success;
                }, results);

                if (failures.length > 0 && tried <= trials){
                    structuredLogger.debug("Retrying the mergeContent operation : " + tried + " time.");
                    recursivefn();
                }else {
                    deferred.resolve(results);
                }
            }, function(error){
                if(tried <= trials){
                    structuredLogger.debug("Retrying the mergeContent operation : " + tried + " time.");
                    recursivefn();
                }else{
                    deferred.reject(error);
                }
            });
        };

        recursivefn();

        return deferred.promise;
    }
};
