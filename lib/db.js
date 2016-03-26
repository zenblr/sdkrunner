var mongojs = require("mongojs");
var mongohost = process.env.MONGO_HOST ?  process.env.MONGO_HOST : "localhost";
var db = mongojs(mongohost+":27017/SdkRunnerDb", ["tenants", "fiddles"]);
exports.mongojs = mongojs;
exports.db = db;

