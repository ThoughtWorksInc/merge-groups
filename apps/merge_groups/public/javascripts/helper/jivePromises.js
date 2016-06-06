var jivePromises = {
    isSuperAdmin : function(){
        var adminPromise = $.Deferred();
        osapi.jive.corev3.securityGroups.get({"id": "1001"}).execute(function(data){
            if (data.status != '403' && data.type && data.type.toUpperCase() == 'SECURITYGROUP'){
                adminPromise.resolve(true);
            } else {
                adminPromise.reject(false);
            }
        });
        return adminPromise;
    },
    getGroupAdmins: function(group){
        var groupAdminPromise = $.Deferred();
        group.getMembers({"state":"owner"}).execute(
            function (groupAdmins) {
                groupAdminPromise.resolve(groupAdmins);
            },
            function(error){
                groupAdminPromise.reject(error);
            }
        );
        return groupAdminPromise;
    },
    getGroup: function(groupId){
        var groupPromise = $.Deferred();
        osapi.jive.corev3.places.get({ entityDescriptor: 700 + "," + groupId }).execute(
            function(response) {
                groupPromise.resolve(response.list[0]);
            },
            function(error){
                groupPromise.reject(error);
            }
        );
        return groupPromise;
    },

    getCurrentUserDetails:function(){
        var currentUserPromise = $.Deferred();
        osapi.people.getViewer().execute(
            function (currentUser) {
                currentUserPromise.resolve(currentUser);
            },
            function(error) {
                currentUserPromise.reject(error);
            }
        );
        return currentUserPromise;
    },
    isGroupAdmin: function (groupAdmins, userId) {
        return groupAdmins.list.filter(function (entry) {
            return entry.person.id.indexOf(userId) !== -1;
        }).length > 0 ;
    },

    mergeGroups : function(info){
        var deferred = $.Deferred();
        osapi.jive.connects.post({
            authz:"signed",
            alias: "mergeService",
            headers : { "Content-Type" : "application/json" },
            format: 'json',
            href:'/mergeGroups',
            "body": info
        }).execute(function(data){
            console.log("data",data);
            deferred.resolve(data);
        })
        return deferred;
    },

    hasAccess: function(place,sourceGroupIDs,currentUser){
        var that = this;
        var groupPromise = $.Deferred();
        that.isSuperAdmin().done(function(){
            if(sourceGroupIDs.indexOf(place.placeID) == -1 && sourceGroupIDs.length < 10){
                groupPromise.resolve(true);
            }
        }).fail(function(){
            that.getGroupAdmins(place).done(function(groupAdmins) {
                if (that.isGroupAdmin(groupAdmins, currentUser)) {
                    if(sourceGroupIDs.indexOf(place.placeID) == -1 && sourceGroupIDs.length < 10) {
                        groupPromise.resolve(true);
                    }
                }
                else
                    groupPromise.resolve(false);
            }).fail(function(errorResponse){
                groupPromise.reject(errorResponse);
            })
        })
        return groupPromise;
    }
}


