var express = require('express');
var router = express.Router();
var log4js = require('log4js');
var logger = log4js.getLogger("INDEX");
logger.setLevel("DEBUG");
var db = require('../lib/db').db;
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
      case 'add_tenant':
            res.setHeader('Content-Type', 'application/json');
            authenticateAndSave(req.body, function(data) {
                if (data.status == SUCCESS) {
                    res.send({status:SUCCESS, tenant:req.body.domain});
                }
                else {
                    res.send({status:FAIL, tenant: req.body.domain, message:data.message});
                }
                res.end();
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

router.get('/:ask', function(req, res, next) {
    switch(req.params.ask) {
        case 'get_tenants':
            res.setHeader('Content-Type', 'application/json');
            var tenants = [];
            db.tenants.find({},{"creds.domain":1}).forEach(function(err, tenant) {
                if (!err) {
                    if (tenant) {
                        tenants.push(tenant.creds.domain);
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
            db.tenants.findOne({"creds.domain":domain}, function(err, tenant){
                if (!err && tenant) {
                    if (!is_valid_token(tenant)) {
                        remove_token(tenant.creds.domain, function(result) {
                            if(result == SUCCESS) {
                                authenticateAndSave(tenant.creds, function(data) {
                                    if (data.status == SUCCESS) {
                                        res.send({status:SUCCESS, client_token:data.access_token});
                                    }
                                    else {
                                        res.send({status:FAIL, message:data.message});
                                    }
                                    res.end();
                                    return;
                                });
                            }
                            else {
                                res.send({status:FAIL, message:"could not delete old access token"});
                                res.end();
                                return;
                            }
                        });
                    }
                    else {
                        res.send({status:SUCCESS, client_token:tenant.access_token});
                        res.end();
                        return;
                    }
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

function remove_token(domain, cb) {
    logger.debug("domain>> "+domain);
    db.tenants.remove({"creds.domain":domain}, function(err, data) {
        if (!err)
            cb(SUCCESS);
        else
            cb(FAIL);
    });
}

function is_valid_token(data) {
    var now = Date.now();
    var then = data.acquired_date;
    var expires_in = data.expires_in;
    if (((now-then)/1000) > expires_in) {
        return false;
    }
    return true;
}


function authenticateAndSave(creds, cb) {
    authenticateTenant(creds, function(repl) {
        var data = {};
        if (repl != null) {
            data = JSON.parse(repl);
        }
        if (data.access_token) {
            data.acquired_date = Date.now();
            data.creds = creds;
            db.tenants.save(data);
            cb({status:SUCCESS, data:data});
            return;
        }
        cb({status:FAIL, message:data.message});
    });
}