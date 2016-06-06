var jive = require('jive-sdk');
var req = require(process.cwd() + '/require-from-app-root').req;
var env = req('config').config;
var ejs=require('ejs');
var fs = require('fs');
var logger = req('utils/logger');
var sendEmail = req('utils/send');
var urlCreator = req('services/JiveServicesUrlCreator');
var api = require('jive-api-client')(env.jive.url);
var R = require('ramda');
var Q= require('q')
var lodash = require('lodash');

var getPath = function (obj, ks) {
    if (typeof ks == "string") ks = ks.split(".");
    if (obj === undefined) return void 0;

    if (ks.length === 0) return obj;

    if (obj === null) return void 0;

    return getPath(obj[lodash.first(ks)], lodash.rest(ks));
};

var  getFollowerUserId = function (list) {
    return R.map(function (e) {
        return e.id
    },list);
};
var  getMemberUserId = function (list) {
    return R.map(function (e) {
        return e.person.id
    },list);
};
var getPromises =  function (arr,iterator) {
    var promises = arr.map(function (el) {
        return iterator(el);
    });
    return Q.allSettled(promises);
}


var addPromises = function (groupId,usersList,selectedStreams,iterator) {
    var promises = usersList.map(function (el) {
        return iterator(groupId,el,selectedStreams);
    });
    return Q.allSettled(promises);
}

var deleteGroup = function(group){
    var deferred = Q.defer();
    api.group.deleteGroup(group.url).then(function(){
        deferred.resolve();
    })
    return deferred.promise;
}

var addMemberInGroup = function (groupId, userId,selectedStreams) {
    var addMemberInGroupPromise = Q.defer();
    api.group.addMember(urlCreator.getGroupMembersServiceUrlFor(groupId),urlCreator.getPeopleServiceUrlFor(userId))
        .then(function (response) {
            if(selectedStreams.indexOf("Email Watches") != -1){
                addFollowerInGroup(groupId, userId,["Email Watches"])
                    .then(function(){
                        logger.info("Add Member success",{fn:"addMemberInGroup",message :"Add Member success",stage : "success_handler",user:userId});
                        addMemberInGroupPromise.resolve(userId);
                    })

            }
            else{
                logger.info("Add Member success",{fn:"addMemberInGroup",message :"Add Member success",stage : "success_handler",user:userId});
                addMemberInGroupPromise.resolve(userId);
            }
        },
        function (failureResponse) {
            if(failureResponse.statusCode == 500){
                addMemberInGroup(groupId,userId,selectedStreams).then(function(){
                    addMemberInGroupPromise.resolve(userId);
                },function(err){
                    addMemberInGroupPromise.reject(err.statusCode);
                })
            }
            else if (failureResponse.statusCode == 409){
                logger.info("Add Member success",{fn:"addMemberInGroup",message :"Add Member success",stage : "success_handler",user:userId});
                addMemberInGroupPromise.resolve(userId);
            }
            else {
                logger.error("Add Member error ",{fn:"addMemberInGroup",message :"Add Member error ",stage:"failure_handler",user:userId, err: failureResponse.entity});
                addMemberInGroupPromise.reject(failureResponse.statusCode);
            }
        });
    return addMemberInGroupPromise.promise;
}

var addFollowerInGroup = function (targetGroupID, userId,selectedStreams) {
    var addFollowerInGroupPromise = Q.defer();
    var userUrl = env.jive.apiBaseUrl + "/people/" + userId;
    api.user.get(userUrl).then(function(user){
        if(user.jive.enabled){
            api.user.getAllStreams(userUrl).then(function (streams) {
                logger.info("got following in streams",{fn: "getAllStreams", streams: streams, stage: "success_callback"})
                var streamIDs = streams.filter(function(stream){
                    if(selectedStreams.indexOf(stream.name) > -1 || selectedStreams.indexOf(stream.source) > -1)
                        return true;
                })
                if(streamIDs.length == 0)
                    addFollowerInGroupPromise.resolve(userId);
                else{
                    R.map(function(stream){
                        api.stream.createStreamAssociation(env.jive.apiBaseUrl + "/streams/" + stream.id + "/associations", urlCreator.getPlaceServiceUrlFor(targetGroupID))
                            .then(function () {
                                logger.info("stream association created",{
                                    fn: "createStreamAssociation",
                                    message: "stream association created",
                                    stage: "success_callback"
                                })
                                addFollowerInGroupPromise.resolve(userId);

                            },function(failureResponse){
                                if(failureResponse.statusCode == 500){
                                    addFollowerInGroup(targetGroupID, userId,selectedStreams).then(function(){
                                        addFollowerInGroupPromise.resolve(userId);
                                    },function(err){
                                        addFollowerInGroupPromise.reject(userId);
                                    })
                                }
                                else if (failureResponse.statusCode == 409)
                                    addFollowerInGroupPromise.resolve(userId);
                                else {
                                    logger.error( "error while creating stream association",{fn: "createStreamAssociation", message: "error while creating stream association", stage: "failure_callback", error: failureResponse})
                                    addFollowerInGroupPromise.reject(userId);
                                }
                            })
                    },streamIDs)
                }
            }, function (failureResponse) {
                logger.error("error while getting following in streams",{fn: "getAllStreams", err: failureResponse, stage: "failure_callback"})

            })
        }
        else{
            addFollowerInGroupPromise.resolve(userId);
        }

    })

    return addFollowerInGroupPromise.promise;
};

var sendMessage = function (mailInfo,template,failedIDs) {
    var messageBody;
    fs.readFile(template, 'utf-8', function (err, data) {
        if (!err) {
            if(failedIDs){
                messageBody = ejs.render(data,{groupName : mailInfo.targetGroupName,groupUrl : mailInfo.groupUrl,failedIDs : failedIDs});
            }
            else
                messageBody = ejs.render(data,{groupName : mailInfo.targetGroupName,groupUrl : mailInfo.groupUrl});
            var message = {
                to: [mailInfo.currentUserName + '@' + env.domainName],
                headers: {
                    Subject: mailInfo.subject
                },
                contentType: 'text/html;chartset=utf8',
                body: messageBody
            }
            sendEmail(message, function (err, res) {
                if (err)
                    logger.error("Error while sending mail",{fn :"sendMessage", message:"Error while sending mail", selectedUser : mailInfo.currentUserName,err :err});
                else {
                    logger.info("Email has been sent to user",{fn :"sendMessage", selectedUser : mailInfo.currentUserName});
                }
            });
        }
        else
            console.log("error while reading")
    });
}
var getGroupNames = function(groupURLs){
    var getResult = function(groupUrl){
        var deferred = Q.defer();
        api.group.get(groupUrl.url).then(function(group){
            deferred.resolve({groupName :group.entity.name,groupUrl : group.entity.resources.html.ref});
        })

        return deferred.promise;
    };

    var results = R.map(function(groupUrl){
        return getResult(groupUrl);
    }, groupURLs);

    return Q.allSettled(results);
};

var isAdded = function(memberResponse){
    return R.all(function(response){
        return response.state == 'fulfilled';
    },memberResponse)
}

var getFollowersList = function (url, list, callback) {
    jive.context.persistence.findByID("community", env.jive.url).then(function (community) {
        jive.community.doRequest(community, {
            url: url,
            "method": "GET"
        }).then(function (successResponse) {
            logger.info({fn: "getFollowersList", stage: "success_handler"})
            if(successResponse.entity.links && successResponse.entity.links.next){
                getFollowersList(successResponse.entity.links.next, list.concat(getFollowerUserId(successResponse.entity.list)), callback);
            }
            else{
                return  callback(null, list.concat(getFollowerUserId(successResponse.entity.list)));
            }
        }, function (failureResponse) {
            logger.error({fn: "getFollowersList",error:JSON.stringify(failureResponse), stage: "failure_handler"})
            return callback(failureResponse, null)
        });
    });
}

var getMembersList = function (url, list, callback) {
    jive.context.persistence.findByID("community", env.jive.url).then(function (community) {
        jive.community.doRequest(community, {
            url: url,
            "method": "GET"
        }).then(function (successResponse) {
            logger.info({fn: "getMembersList", stage: "success_handler"})
            if(successResponse.entity.links && successResponse.entity.links.next) {
                getMembersList(successResponse.entity.links.next, list.concat(getMemberUserId(successResponse.entity.list)), callback);
            }
            else{
                return  callback(null, list.concat(getMemberUserId(successResponse.entity.list)));
            }
        }, function (failureResponse)
        {
            logger.error({fn: "getMembersList",stage: "failure_handler", error: JSON.stringify(failureResponse)});
            return callback(failureResponse, null)
        });
    });
}
var getFollowersAndMembers = function(sourceGroupID){
    var followersList = [];
    var membersList = [];
    var getMemberAndFollowerPromise = Q.defer();
    var groupUrl = urlCreator.getPlaceServiceUrlFor(sourceGroupID);
    var followersAndMembers = {members : [],followers : [],sourceGroupID :sourceGroupID };
    api.group.get(groupUrl).then(function(group){
        logger.info("got group successfully",{fn:"getFollowersAndMembers : get",group:group,stage:"success_callback"})
        if(group.entity.type == "space"){
            getMemberAndFollowerPromise.resolve(followersAndMembers);
        }
        else if(group.entity.groupTypeNew == "PUBLIC"){
            Q.nfcall(getFollowersList,group.entity.resources.followers["ref"] ,followersList)
                .then(function(followers){
                    followersAndMembers.followers = followers;
                    getMemberAndFollowerPromise.resolve(followersAndMembers);
                })
        }
        else{
            Q.all([Q.nfcall(getFollowersList,group.entity.resources.followers["ref"] ,followersList)
                    , Q.nfcall(getMembersList,group.entity.resources.members["ref"],membersList)])
                .spread(function(followers,members){
                    logger.info({fn:"getFollowersAndMembers",followers : followers,members : members,stage:"success_callback"})
                    followersAndMembers.members = members;
                    followersAndMembers.followers = followers;
                    getMemberAndFollowerPromise.resolve(followersAndMembers);

                },function(error){
                    logger.error({fn:"getFollowersAndMembers",message:"error while getting followers and members",stage:"failure_callback",error:error})
                    getMemberAndFollowerPromise.reject();
                })
        }

    },function(err){
        logger.error({fn:"getFollowersAndMembers",message:"error while getting group",stage:"failure_callback",error:err})
        getMemberAndFollowerPromise.reject();
    });
    return getMemberAndFollowerPromise.promise;
}

var addMembersAndFollowers = function(targetGroupID,followersList,selectedStreams,membersList,sourceGroupID){
    var addMembersAndFollowersPromise = Q.defer();
    addPromises(targetGroupID, followersList,selectedStreams,addFollowerInGroup)
        .then(function(followerResponse){
            addPromises(targetGroupID,membersList,selectedStreams,addMemberInGroup)
                .then(function(memberResponse){
                    if(isAdded(memberResponse) && isAdded(followerResponse)){
                        logger.info("Merged followers successfully",{fn: "addFollowersInGroup", message:"Merged followers successfully", stage: "success_callback"});
                        logger.info("Merged members successfully",{fn: "addMembersInGroup", message:"Merged members successfully", stage: "success_callback"});
                        addMembersAndFollowersPromise.resolve(sourceGroupID);
                    }
                    else{
                        addMembersAndFollowersPromise.reject(sourceGroupID);
                        logger.error("error while merging group followers or members",{app:"importMembers",fn: "addMembersAndFollowers",message:"error while merging group followers or members",stage:"failure_callback"});
                    }
                },function(err){
                    logger.error("error while merging group members",{app:"importMembers",fn:"addMembersInGroup",message:"error while merging group members",stage:"failure_callback",error:err});
                    addMembersAndFollowersPromise.reject(sourceGroupID)
                })
        },function(err){
            logger.error("error while merging group followers",{app:"importMembers",fn:"addFollowersInGroup",message:"error while merging group followers",stage:"failure_callback",error:err});
            addMembersAndFollowersPromise.reject(sourceGroupID);
        })
    return addMembersAndFollowersPromise.promise;
};

var generateFailureGroupsResult = function (resultsImportMembers, resultsMergeContent) {
    var generateFailureResultPromise = Q.defer();

    var failuresImportMembers = R.filter(function (result) {
        return !result.success;
    }, resultsImportMembers);
    var failuresMergeContent = R.filter(function (result) {
        return !result.success;
    }, resultsMergeContent);

    if (failuresImportMembers.length != 0 || failuresMergeContent.length != 0) {
        Q.allSettled([group.getGroupNames(failuresImportMembers),
            group.getGroupNames(failuresMergeContent)])
            .spread(function (importMembersFailureGroups, mergeContentFailureGroups) {
                var mergeContentFailureGroupsNames = [];
                R.map(function (el) {
                    mergeContentFailureGroupsNames.push(el.value)
                }, mergeContentFailureGroups.value);
                var importMembersFailureGroupsNames = [];
                R.map(function (el) {
                    importMembersFailureGroupsNames.push(el.value)
                }, importMembersFailureGroups.value);
                var result = {
                    members: importMembersFailureGroupsNames,
                    content: mergeContentFailureGroupsNames
                }
                generateFailureResultPromise.resolve(result)
            })
    }
    else {
        generateFailureResultPromise.resolve()
    }
    return generateFailureResultPromise.promise;
};

var generateSuccessGroupsResult = function (resultsMergeContent, resultsImportMembers) {
    var generateSuccessResultPromise = Q.defer();

    var successMergeContent = R.filter(function (result) {
        return result.success;
    }, resultsMergeContent)
    var successImportMembers = R.filter(function (result) {
        return result.success;
    }, resultsImportMembers)
    var successCommon = R.map(function (e1) {
        var contains = R.filter(function (e2) {
            return e2.url == e1.url;
        }, successImportMembers);
        if (contains.length > 0) return e1;
    }, successMergeContent)
    generateSuccessResultPromise.resolve(successCommon);
    return generateSuccessResultPromise.promise;
};

var group = {
    sendMessage : sendMessage,
    getFollowersAndMembers : getFollowersAndMembers,
    addMembersAndFollowers : addMembersAndFollowers,
    getPromises : getPromises,
    deleteGroup:deleteGroup,
    generateFailureGroupsResult:generateFailureGroupsResult,
    generateSuccessGroupsResult:generateSuccessGroupsResult
}

module.exports = group;
