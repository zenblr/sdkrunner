var express = require('express');
var router = express.Router();
var log4js = require('log4js');
var logger = log4js.getLogger("INDEX");
logger.setLevel("DEBUG");
var db = require('../lib/db').db;
var utils = require('../lib/utils');
var config = require('../config/config');
var oneHour = 1 * 60 * 60 * 1000;

const SUCCESS = "success";
const FAIL    = "fail";

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', {mode:config.mode});
});

router.post('/:ask', function(req, res, next) {
  switch(req.params.ask) {
      case 'add_tenant':
            res.setHeader('Content-Type', 'application/json');
            saveTenant(req.body, function(result) {
                if (result.status == SUCCESS) {
                    res.send({status:SUCCESS, tenant:req.body.domain});
                }
                else {
                    res.send({status:FAIL, tenant: req.body.domain, message:result.message});
                }
                res.end();
            })
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
        case 'get_access_token':
            res.setHeader('Content-Type', 'application/json');
            var domain = req.query.domain;
            var username = req.query.username;
            var password = req.query.password;
            db.tenants.findOne(
                {
                    "creds.domain":domain,
                },
                {
                    creds:1,
                    clients:
                        {
                            $elemMatch:
                                {
                                    username:username
                                }
                        }
                },
                function(err, tenant) {
                    if (!err && tenant) {
                        if (tenant.clients && is_valid_token(tenant.clients[0].token)) {
                            //check if password is okay
                            utils.verifyPassword(password,tenant.clients[0].password, function(isCorrect) {
                                if (isCorrect) {
                                    res.send({status: SUCCESS, access_token: tenant.clients[0].token.access_token});
                                }
                                else {
                                    res.send({status: FAIL, message: "incorrect username/password"});
                                }
                                res.end();
                            })
                            return;
                        }
                        else {
                            refresh_token(tenant.creds, username, password, function (result) {
                                if (result.status == SUCCESS) {
                                    utils.encodePassword(password, function(encPassword) {
                                        var client = {
                                            token:result.token,
                                            username: username,
                                            password: encPassword
                                        };
                                        if (tenant.clients) {
                                            db.tenants.update(
                                                {
                                                    "creds.domain": domain,
                                                    "clients.username": username
                                                },
                                                {
                                                    $set: {
                                                        "clients.$": client
                                                    }
                                                }
                                            );
                                        }
                                        else {
                                            db.tenants.update(
                                                {
                                                    "creds.domain": domain
                                                },
                                                {
                                                    $push: {
                                                        clients: client
                                                    }
                                                }
                                            );
                                        }
                                        res.send({status: SUCCESS, access_token: client.token.access_token});
                                        res.end();
                                        return;
                                    });
                                }
                                else {
                                    res.send({status: FAIL, message: result.message});
                                    res.end();
                                }
                            });
                        }
                    } else {
                        res.send({status: FAIL, message: err});
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

function refresh_token(creds,username, password, cb) {
    var access_data = {
        grant_type   : creds['grant_type'],
        client_id    : creds['client'],
        client_secret: creds['secret'],
        scope        : creds['scopes'],
        redirect_uri : creds['redirect_uri'],
        username     : username,
        password     : password
    };
    authenticate(creds['domain'], access_data, function(data) {
        if (data.access_token) {
            data.date = Date.now();
            cb({status:SUCCESS, token:data});
            return;
        }
        else {
            cb({status:FAIL, message:JSON.stringify(data)});
        }
    });
}

function authenticate(domain, access_data, cb) {
    var port         = 443;
    var querystring = require('querystring'),
        https       = require('https');

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
                    cb(JSON.parse(repl));
                });
                res.on('error', function (e) {
                    logger.error(e);
                    cb(e);
                });
              });

    req.on('error', function(err) {
        logger.error(err);
        cb(err);
    });

    req.write(data);
    req.end();
}

function is_valid_token(token) {
    var now = Date.now();
    var then = token.date;
    if (((now-then)/1000) > token.expires_in) {
        return false;
    }
    return true;
}

function saveTenant(creds, cb) {
    db.tenants.update({"creds.domain":creds.domain},{$set:{creds:creds}}, {upsert:true}, function(err,value) {
        if (!err) {
            cb({status:SUCCESS});
            return;
        }
        cb({status:FAIL, message:err});
    });
}
