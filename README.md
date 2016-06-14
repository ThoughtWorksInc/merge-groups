# Merge Groups
Merge Groups App is a jive app developed using node.js and jive-sdk for merging different groups into one group.

Getting started with Jive node sdk Please refer Jive's official document at https://community.jivesoftware.com/docs/DOC-114053

How to use Merge Groups app : 
###### 1)Pull the code. 
###### 2)Run command "npm update".
###### 3)Put node.js service url in jiveclientconfiguration.json. 
###### 4)Run command "node app" to start the server which will generate an extension.zip. 
###### 5)Upload the extension.zip to your Jive instance.

Please note that you will need to add jiveServiceSignature in jiveclientconfiguration.json (which can be generated for given uuid from jive add on console by Command + Right click on upload package button.

###### You can generate new uuid using:
var jive =require('jive-sdk'); jive.util.guid() 

example of jiveclientconfiguration: 

    
    {
        clientUrl": "http://localhost", 
        "port": "8090",
        "development" : true, 
        "extensionInfo" : {
            "uuid": "" # <- place the generated uuid here 
        }
    } 
    


You also have to add some field values in env.json which are required for sending mail.

    
    "mailInfo":{
        user": "", 
        "userName": "",
        "domainName" : "", 
        "refreshToken" : "",
        "clientId" : "",
        "clientSecret" :""
    } 
    
##### How to Use the app: 
###### 1) Select group(s) you want to merge(You can select maximum 10 groups at a time). 
###### 2) Select streams you want to add users to. 3) Confirm the operation.
