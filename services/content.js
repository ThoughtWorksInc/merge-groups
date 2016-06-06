var jive = require('jive-sdk');
var req = require(process.cwd() + '/require-from-app-root').req;
var env = req('config').config;
var structuredLogger = req('utils/logger');
var urlCreator = req('services/JiveServicesUrlCreator');
var api = require('jive-api-client')(env.jive.url);
var R = require('ramda');
var Q= require('q')

var getBlogPlace = function(url){
    var deferred = Q.defer();
    structuredLogger.debug("Retrieving blog place for : " , url);
    api.group.get(url).then(function(place){
        var blogPlace;

        try{
            blogPlace = place.entity.resources.blog.ref;
        }catch(err){};


        structuredLogger.debug("Sucessfull retrieved blog place: ", blogPlace);
        deferred.resolve(blogPlace);
    }, function(error){
        structuredLogger.error("Error while retrieving place", error);
        deferred.reject(error);
    });
    return deferred.promise;
};

var getNextLink = function(json){
    var nextLink = "";
    try{
        nextLink = json.entity.links.next;
    }catch(err){};

    return nextLink;
};

var addfilter = function(filter, link){
    var pos = link.indexOf("?") + 1;

    return link.substring(0,pos) + filter + link.substring(pos);
};

var getGroupsContent = function(initialUrl){
    var deferred = Q.defer();
    structuredLogger.debug("Retrieve all contents for groups url:", initialUrl);
    var contentIDs = [];
    var recursiveFn = function (nextUrl){
        api.group.get(nextUrl)
            .then(function(json){
                structuredLogger.debug("Successfully retrieved contents for url", nextUrl);
                structuredLogger.debug("# of contents retrived for url : ", json.entity.list.length);
                R.map(function(content){
                    contentIDs.push(content.contentID);
                }, json.entity.list);

                var nextLink = getNextLink(json);

                if(nextLink){
                    nextLink = addfilter("includeBlogs=true&", nextLink);
                    structuredLogger.debug("Retrieve all contents for groups url:", nextLink);
                    recursiveFn(nextLink);
                }
                else
                    deferred.resolve(contentIDs);
            }, function(error){
                structuredLogger.error("Error while retrieving contents for groups", error);
                deferred.reject(error);
            });
    };

    recursiveFn(initialUrl);

    return deferred.promise;
};

var getSourceContentTypes = function(sourceGroupUrls){
    var deferred = Q.defer();

    structuredLogger.debug("Retrieving content types for source groups");
    var getContentType = function(groupUrl){
        return api.group.get(groupUrl);
    };

    var promises = R.map(function(groupUrl){
        return getContentType(groupUrl);
    }, sourceGroupUrls);

    Q.allSettled(promises).then(function(results){
        var contentTypes = [];
        results.forEach(function (result) {
            if (result.state === "fulfilled") {
                R.map(function(contentType){
                    contentTypes.push(contentType);
                }, result.value.entity.contentTypes);
            }
        });

        var uniqueContentTypes = R.uniq(contentTypes);

        structuredLogger.debug("Successfully retrieved unique content types: ", uniqueContentTypes);
        deferred.resolve(uniqueContentTypes);
    }, function(error){deferred.reject(error);});
    return deferred.promise;
};


var updateGroupContentTypes = function(groupUrl, contentTypes){
    var deferred = Q.defer();
    structuredLogger.debug("Updating content types for group: ", groupUrl);

    api.group.get(groupUrl).then(function(response){
        var group = response.entity;
        group.contentTypes = contentTypes;
        api.group.update(groupUrl,group)
            .then(function(){
                structuredLogger.debug("Successfully updated the content types for target group.");
                deferred.resolve();
            }, function(error){
                structuredLogger.error("Error in updating content types for target group.", error);
                deferred.reject(error);
            }, function(error){deferred.reject(error);});
    });
    return deferred.promise;
};

var updateParent = function(community, content, parentUrl){

    // change parent of the content
    content.parent = parentUrl;
    // clear categories of the content
    content.categories = [];

    var deferred = Q.defer();
    var url = env.jive.url+"/api/core/v3/contents/" + content.contentID;
    structuredLogger.debug("Updating parent for : ", url);

    jive.community.doRequest(community,
        {url: url,
            "method": "PUT",
            "postBody": content,
            "minor": "true"})
        .then(function(){
            structuredLogger.debug("Successfully updated parent place for url : ", url);
            deferred.resolve();
        }, function(error){
            structuredLogger.error("Error while updating the parent for url: " + url, error);
            deferred.reject(error);
        });

    return deferred.promise;
};

var processContent = function(community,contentIDs,targetGroupUrl,targetBlogPlaceUrl){
    var deferred = Q.defer();
    api.group.get(urlCreator.getContentUrl(contentIDs[0])).then(function(content){
        var targetUrl = targetGroupUrl;
        try{
            if(content.entity.parentPlace.type === "blog" && targetBlogPlaceUrl)
                targetUrl = targetBlogPlaceUrl;
        }catch (err){};
        updateParent(community, content.entity, targetUrl)
            .then(function(){
                if(contentIDs.length > 1){
                    contentIDs = contentIDs.splice(1);
                    processContent(community,contentIDs,targetGroupUrl,targetBlogPlaceUrl)
                        .then(function(){deferred.resolve();},function(){deferred.resolve();});
                }else{
                    deferred.resolve();
                }
            }, function(){
                if(contentIDs.length > 1){
                    contentIDs = contentIDs.splice(1);
                    processContent().then(function(){deferred.resolve();},function(){deferred.resolve();});
                }else{
                    deferred.resolve();
                }
            });
    }, function(error){
        deferred.reject(error);
    });
    return deferred.promise;
};


var compileResults = function(groupURLs){
    var getResult = function(url){
        var deferred = Q.defer();
        var allContentURL = env.jive.apiBaseUrl + "/contents?includeBlogs=true&filter=place(" + url + ")";
        var statusUpdateURL = env.jive.apiBaseUrl + "/contents?filter=place(" + url + ")&filter=type(update)";
        api.group.get(allContentURL).then(function(allContentResponse){
            var allContents = allContentResponse.entity.list.length;
            api.group.get(statusUpdateURL).then(function(statusUpdateResponse){
                var statusUpdates = statusUpdateResponse.entity.list.length;
                var success;
                if(allContents > statusUpdates)
                    success = false;
                else
                    success = true;

                deferred.resolve({url: url, success: success});
            }, function(error){deferred.reject(error);});
        }, function(error){deferred.reject(error);});

        return deferred.promise;
    };

    var results = R.map(function(groupUrl){
        return getResult(groupUrl);
    }, groupURLs);

    return Q.allSettled(results);
};

var content = {
    getBlogPlace:getBlogPlace,
    getGroupsContent:getGroupsContent,
    getSourceContentTypes:getSourceContentTypes,
    updateGroupContentTypes:updateGroupContentTypes,
    processContent:processContent,
    compileResults:compileResults
}

module.exports = content;
