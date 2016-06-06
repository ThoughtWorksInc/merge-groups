var req = require(process.cwd() + '/require-from-app-root').req;
var structuredLogger = req('utils/logger');
var mergeGroups = req('services/mergeGroups').mergeGroups;

module.exports = function (app) {
    app.post('/mergeGroups', function (req, res) {
        res.writeHead(200);
        res.end();
        var sourceGroupIDs = req.body.sourceGroupIDs;
        var currentUserName = req.body.currentUserName;
        var targetGroup = req.body.targetGroup;
        var selectedStreams = req.body.selectedStreams;
        var subject = "Merge Groups task completion status";

        var mailInfo = {
            groupUrl : targetGroup.resources.html.ref,
            targetGroupName : targetGroup.name,
            currentUserName :currentUserName,
            subject : subject
        };
        mergeGroups(sourceGroupIDs,targetGroup.placeID,selectedStreams,mailInfo)
            .then(function(res){
                structuredLogger.debug("Results of Merge groups", res);
            },function(err){
                structuredLogger.error("Error in Merge Content : ", err);
            })
    });

}