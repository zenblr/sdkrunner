var mongojs = require("mongojs");
var mongohost = process.env.MONGO_HOST ?  process.env.MONGO_HOST : "localhost";
var db = mongojs(mongohost+":27017/SdkRunnerDb", ["tenants", "fiddles"]);
exports.mongojs = mongojs;
//check whether the csv_upload fiddle is present in the database.
//if not, create it
db.fiddles.findOne({name:'csv_upload'}, function(err,fiddle) {
   if (!err) {
       if (!fiddle) {
           db.fiddles.save({name:'csv_upload', html:'csv_upload.html'});
       }
   }
});
exports.db = db;

