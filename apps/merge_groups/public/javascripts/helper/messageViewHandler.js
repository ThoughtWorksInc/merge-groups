var messageHandler = {

    displayInfoMessage : function (message) {
        var messageJson = {messageClass : "alert-info", message : message}
        $("#app-message").html(Mustache.render($('#message-template').html() ,messageJson));
    },

    displayErrorMessage : function (message) {
        var messageJson = {messageClass : "alert-danger", message : message}
        $("#app-message").html(Mustache.render($('#message-template').html() ,messageJson));
        setTimeout(function(){
            $("#app-message").html('');
        },3000)
    },

    showJiveErrorMessage : function(message){
        osapi.jive.core.container.sendNotification( {'message':message, 'severity' : 'error'} );
    }
}

