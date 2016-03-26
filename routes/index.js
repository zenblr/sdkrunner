var express = require('express');
var router = express.Router();
var log4js = require('log4js');
var logger = log4js.getLogger("INDEX");
logger.setLevel("DEBUG");
var db = require('../lib/db').db;
var eventemitter = require('events');
var testcomplete = new eventemitter();
var config = require('../config/config');
var oneHour = 1 * 60 * 60 * 1000;

const SUCCESS = "success";
const FAIL    = "fail";

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express', testconfig:config.tests });
});

router.post('/:ask', function(req, res, next) {
  switch(req.params.ask) {
      case 'login':
            var version = req.body.version;
            res.setHeader('Content-Type', 'application/json');
            db.server_auth.findOne({version:version}, function(err, data){
                if ((!err && data) && (is_valid_token(data))){
                    res.send(data);
                    res.end();
                }
                else {
                    remove_token(version);
                    authenticateClient(version, function(repl) {
                        var data = {};
                        if (repl != null) {
                            data = JSON.parse(repl);
                        }
                        if (data.access_token) {
                            data.version=version;
                            data.date = Date.now();
                            db.server_auth.save(data);
                        }
                        res.send(repl);
                        res.end();
                    });
                }
            });
            break;
      case 'refresh_token':
            var version = req.body.version;
            res.setHeader('Content-Type', 'application/json');
            if (typeof(version) == "undefined") {
                res.send({"status": "fail", "message": "no version specified"});
                res.end();
            }
            else if(!(version in creds)) {
                res.send({"status": "fail", "message": "unknown version specified"});
                res.end();
            }
            else {
                remove_token(version, function(ret) {
                    res.send(ret);
                    res.end();
                });
            }
            break;
      case 'add_tenant':
            res.setHeader('Content-Type', 'application/json');
            authenticateTenant(req.body, function(repl) {
                var data = {};
                if (repl != null) {
                    data = JSON.parse(repl);
                }
                if (data.access_token) {
                    data.version=version;
                    data.acquired_date = Date.now();
                    data.domain = req.body.domain;
                    db.tenants.save(data);
                    res.send({status:SUCCESS, tenant:data.domain});
                }
                else {
                    res.send({status:FAIL, tenant: req.body.domain, message:data.message});
                }
                res.end();
            });
            break;
      case 'delete':
          res.setHeader('Content-Type', 'application/json');
          var names = req.body.names;
          if (names) {
              names = JSON.parse(names);
          }
          if (names && (Array.isArray(names))) {
              db.tests.remove({name:{$in:names}}, function(err, doc) {
                if (!err) {
                    res.send({status:'success'});
                    res.end();
                }
                else {
                    res.send({status:'failed', message:err});
                    res.end();
                }
              });
          }
          else {
              res.send({status:'failed', message:'no inputs provided'});
              res.end();
          }
          break;
      case 'rename':
          res.setHeader('Content-Type', 'application/json');
          var original = req.body.original;
          var changed = req.body.changed;
          if (original && changed) {
              db.tests.findAndModify({
                  query : {name: original},
                  update: {$set: {name: changed}},
                  new: false
              }, function (err, doc) {
                  if (!err) {
                      res.send({status:'success'});
                      res.end();
                  }
                  else {
                      res.send({status:'failed', message:err});
                      res.end();
                  }
              })
          }
          else {
              res.send({status:'failed', message:'no inputs provided'});
              res.end();
          }
          break;
      case 'save_results':
          res.setHeader('Content-Type', 'application/json');
          var name = req.body.name;
          var log = req.body.log;
          db.results.update({name:name}, {name:name,log:log}, {upsert:true}, function() {
              testcomplete.emit(name, log);
              console.log(">> Event "+name+"  sent...");
              res.send({status:'success'});
              res.end();
          });
          break;
      case 'update_config':
          res.setHeader('Content-Type', 'application/json');
          for (var n in req.body) {
              if (req.body.hasOwnProperty(n)) {
                  config.tests[n] = req.body[n];
              };
          }
          res.send({status:'success', testconfig:config.tests});
          res.end();
          break;
      default:
            if (next) {
                var err = new Error('Not Found');
                err.status = 404;
                next(err);
            }
            break;
  }
});

router.get('/:ask', function(req, res, next) {
    switch(req.params.ask) {
        case 'get_tenants':
            res.setHeader('Content-Type', 'application/json');
            var tenants = [];
            db.tenants.find({},{domain:1}).forEach(function(err, tenant) {
                if (!err) {
                    if (tenant) {
                        tenants.push(tenant.domain);
                    }
                    else {
                        res.send({status: SUCCESS, tenants:tenants});
                        res.end();
                    }
                } else {
                    res.send({status:FAIL, message:err});
                    res.end();
                }
            });
            break;
        case 'get_fiddles':
            res.setHeader('Content-Type', 'application/json');
            var fiddles = [];
            db.fiddles.find({},{name:1}).forEach(function(err, fiddle) {
                if (!err) {
                    if (fiddle) {
                        fiddles.push(fiddle.name);
                    }
                    else {
                        res.send({status: SUCCESS, fiddles:fiddles});
                        res.end();
                    }
                } else {
                    res.send({status:FAIL, message:err});
                    res.end();
                }
            });
            break;
        case 'get_client_token':
            res.setHeader('Content-Type', 'application/json');
            var domain = req.query.tenant;
            db.tenants.findOne({domain:domain}, {access_token:1}, function(err, tenant){
                if (!err && tenant) {
                    res.send({status:SUCCESS, client_token:tenant.access_token});
                    res.end();
                }
                else {
                    res.send({status:FAIL, message:err});
                    res.end();
                }
            });
            break;
        case 'get_fiddle':
            res.setHeader('Content-Type', 'application/json');
            var name = req.query.name;
            db.fiddles.findOne({name:name}, function(err, fiddle){
                if (!err && fiddle) {
                    res.send({status:SUCCESS, fiddle:fiddle});
                    res.end();
                }
                else {
                    res.send({status:FAIL, message:err});
                    res.end();
                }
            });
            break;
        case 'run_auto':
            var name = req.query.name;
            name = name ? name : "default";
            var quiet = req.query.q;
            if (quiet && (quiet == 'y')) {
                run_auto_quiet(name);
                testcomplete.once(name, function(r) {
                    console.log(">> Event "+name+"  received...");
                    //res.setHeader('Content-Type', 'application/json');
                    res.send(r);
                    res.end();
                });
                return;
            }
            res.render('index', { title: 'Express', run_auto:name, testconfig:config.tests });
            break;
        case 'get_results':
            res.setHeader('Content-Type', 'application/json');
            var name = req.query.name;
            db.results.findOne({name:name}, function(err, result){
                if (!err && result) {
                    res.send({status:'success', result:result.log});
                    res.end();
                }
                else {
                    res.send({status:'failed', result:null});
                    res.end();
                }
            });
            break;
        default:
            if (next) {
                var err = new Error('Not Found');
                err.status = 404;
                next(err);
            }
            break;
    }
});


module.exports = router;

// Private methods below this point

function authenticateTenant(creds, cb) {
    var domain       = creds['domain'],
        port         = 443;

    var querystring = require('querystring'),
        https       = require('https');

    var access_data = {
        grant_type   : creds['grant_type'],
        client_id    : creds['client'],
        client_secret: creds['secret'],
        scope        : creds['scopes'],
        redirect_uri : creds['redirect_uri'],
        username     : creds['username'],
        password     : creds['password']
    };

    var data = querystring.stringify(access_data);

    var options = {
            host: domain,
            port: port,
            path: "/rest/auth/token",
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(data),
                'Accept': "application/json; charset=utf-8",
                "X-Timeli-Version": "2.0"
            }
    };

    var repl = '';

    var req = https.request(options, function(res) {
                res.setEncoding('utf8');
                res.on('data', function (chunk) {
                    repl += chunk;
                });
                res.on('end', function () {
                    cb(repl);
                });
                res.on('error', function (e) {
                    logger.error(e);
                    cb(e);
                });
              });

    req.write(data);
    req.end();
}

function remove_token(version, cb) {
    db.server_auth.remove({version:version}, function(err, data) {
        if (cb && (typeof(cb) == "function")) {
            if (!err) {
                cb({"status": "success"});
            }
            else {
                cb({"status": "fail"});
            }
        }
    });
}

function is_valid_token(data) {
    var now = Date.now();
    var then = data.date;
    var expires_in = data.expires_in;
    if (((now-then)/1000) > expires_in) {
        return false;
    }
    return true;
}


function run_auto_quiet(name) {
    var exec = require('child_process').exec;
    var display = '';
    if (config.env == "production") {
        display = 'export DISPLAY=:10;  ';
    }
    var cmd = display+'firefox http://localhost:3000/run_auto?name='+name;
    exec(cmd, function(error, stdout, stderr) {
    });
}
