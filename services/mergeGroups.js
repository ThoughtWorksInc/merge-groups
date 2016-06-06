var req = require(process.cwd() + '/require-from-app-root').req;
var Q = require('q');
var group = req('services/group');
var importMembers = req('services/import_members').importMembers;
var mergeContent = req('services/merge_content').mergeContent;
var failureTemplate = process.cwd() + "/templates/MergeGroupsFailureEmailTemplate.ejs";
var successTemplate = process.cwd() + "/templates/MergeGroupsSuccessEmailTemplate.ejs";

module.exports = {
    mergeGroups : function (sourceGroupIDs,targetGroupID,selectedStreams,mailInfo) {
        var  deferred = Q.defer();

        mergeContent(sourceGroupIDs, targetGroupID).then(function (resultsMergeContent) {
            importMembers(sourceGroupIDs, targetGroupID, selectedStreams)
                .then(function (resultsImportMembers) {
                    Q.all([group.generateSuccessGroupsResult(resultsMergeContent, resultsImportMembers),
                        group.generateFailureGroupsResult(resultsImportMembers, resultsMergeContent)])
                        .then(function(result){
                            var successResult = result[0];
                            var failureResult = result[1];
                            group.getPromises(successResult,  group.deleteGroup)
                                .then(function () {
                                    if(failureResult){
                                        group.sendMessage(mailInfo, failureTemplate, failureResult);
                                    }else
                                        group.sendMessage(mailInfo, successTemplate);

                                }, function (err) {
                                    group.sendMessage(mailInfo, failureTemplate, {members: [], content: []});
                                })
                        })

                }, function (err) {
                    group.sendMessage(mailInfo, failureTemplate, {members: [], content: []});
                })
        }, function (err) {
            group.sendMessage(mailInfo, failureTemplate, {members: [], content: []});
        });
        return deferred.promise;
    }

}
