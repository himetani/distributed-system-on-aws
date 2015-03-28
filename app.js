/**                                                                                       
 *  * Main application file
 *   */

'use strict';

var formidable   = require('formidable');
var fs           = require('fs');
var exec         = require('child_process').exec;
var _            = require('lodash');
var scpClient    = require('scp2');
var sshClient    = require('ssh2').Client;
var EventEmitter = require('events').EventEmitter;
var emitter      = new EventEmitter;
var AWS          = require('aws-sdk');
AWS.config.apiVersions = {
    ec2: '2014-10-01'
};
AWS.config.update({region: 'ap-northeast-1'});
var ec2          = new AWS.EC2();
var index        = fs.readFileSync('dist/index.html');
var express = require('express');
var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server);

var instancesTableFunc = function() {
    var table = new Array();
    return {
        add: function(name, ipaddr) {
            table.push({Name: name, IP: ipaddr});
        },
        ip: function(name) {
            return table.filter(function(tuple) { return tuple.Name==name })[0].IP;
        },  
        name: function(ip) {
            return table.filter(function(tuple) { return tuple.IP==ip })[0].Name;
        },  
        remove: function(str){
            table.splice(_.findIndex(table, function(tuple) { return (tuple.Name==str||tuple.IP==str) }), 1); 
        },  
        getTable: function() {
            return table;
        }   
    }   
};

var resultFunc = function () {
    var array = new Array();
    var counter = 0;
    return {
        getArray: function() {
            return array;
        },
        push: function(result) {
            array.push(result);
        },
        getCounter: function() {
            return counter;
        },
        increment: function() {
            counter++;
        }
    }
}
var isCanceledFunc = function() {
    var value = false;
    return {
        val: function() {
            return value;
        },
        totrue: function() {
            value = true;
        },
        tofalse: function() {
            value = false;
        }
    }
}

function Config() {
    return {
        username: 'ec2-user',
        privateKey: fs.readFileSync('/home/ec2-user/.ssh/internship_key.pem')
    }
}

function vagrantup(emitInfo) {
    io.emit('vagrantup',{ name: emitInfo.slaveName });
    exec('vagrant up '+emitInfo.slaveName+' --provider=aws', function(err, stdout, stderr) {
        if (err){ console.log('vagrant up error: '+ err);
        } else {
            var params = {
                Filters: [
                    { Name: "vpc-id", Values: ["vpc-4e80492b"]},
                    { Name: "tag:Name", Values: [emitInfo.slaveName] }
                ]
            };
            ec2.describeInstances(params, function(err, data) {
                if (err) console.log(err, err.stack);
                else {
                    console.log("");
                    console.log("### vagrantUp Func ###");
                    var ipaddr = data.Reservations[0].Instances[0].PrivateIpAddress;
                    emitInfo.instancesTable.add(emitInfo.slaveName, ipaddr);
                    if (emitInfo.isCanceled.val()) emitter.emit('remove', emitInfo);
                    else emitter.emit('scpruncheck', emitInfo);
                }
            });
        }
    });
}

function scpruncheck(emitInfo) {
    io.emit('scp', { name: emitInfo.slaveName, ip: emitInfo.instancesTable.ip(emitInfo.slaveName) });
    var config = new Config();
    config.host = emitInfo.instancesTable.ip(emitInfo.slaveName);
    config.path = '/home/ec2-user/',
        scpClient.scp('runcheck.sh', config, function(err) { 
        if(err) console.log(err);
        else {
            console.log("");
            console.log("### scpruncheck ###");
            if (emitInfo.isCanceled.val()) emitter.emit('remove', emitInfo);
            else {
                if (emitInfo.type === 'zip') emitter.emit('scpzip', emitInfo);
                else if (emitInfo.type === 'git') emitter.emit('gitclone', emitInfo);
            }
        }
    });
}

function scpzip(emitInfo) {
    io.emit('scp', { name: emitInfo.slaveName,ip: emitInfo.instancesTable.ip(emitInfo.slaveName) });
    var config = new Config();
    config.host = emitInfo.instancesTable.ip(emitInfo.slaveName);
    config.path = '/home/ec2-user/';
    scpClient.scp(emitInfo.filename, config, function(err) { 
        if(err) console.log(err);
        else {
            console.log("### scpzip ###");
            if (emitInfo.isCanceled.val()) emitter.emit('remove', emitInfo);
            else emitter.emit('unzip', emitInfo);
        }
    });
}

function gitclone(emitInfo) {
    var conn = new sshClient();
    var config = new Config();
    config.host = emitInfo.instancesTable.ip(emitInfo.slaveName);
    conn.on('ready', function() {
        conn.exec('git clone '+emitInfo.url, function(err, stream) {
            if (err) {
                console.log(err);
                return conn.end();
            } else {
                stream.stderr.on('data', function(data) {
                    var dataString = data.toString();
                    if ( !(dataString.slice(0, 12) === 'Cloning into') ) {
                        io.emit('error', "Git URL is invalid");
                        emitter.emit('remove', emitInfo);
                        emitInfo.runcheck = false;
                    }
                })
                .on('close', function(code, signal) {
                    console.log("");
                    console.log("### git clone ###");
                    if (emitInfo.isCanceled.val()) emitter.emit('remove', emitInfo);
                    else { 
                        if (emitInfo.runcheck) emitter.emit('expanddir', emitInfo);
                    }
                })
            };
        });
    })
    .connect(config);
}

function unzip(emitInfo) {
    io.emit('unzip', { name: emitInfo.slaveName });
    var conn = new sshClient();
    var config = new Config();
    config.host = emitInfo.instancesTable.ip(emitInfo.slaveName);
    conn.on('ready', function() {
        console.log("unzip :: connection ready");
        conn.exec('unzip '+ emitInfo.filename, function(err, stream) {
            if (err) {
                console.log('unzip exec error: ' + err);
                return conn.end();
            } else {
                console.log("");
                console.log("### unzip ###");
                stream.on('close', function(code, signal) {
                    if (emitInfo.isCanceled.val()) emitter.emit('remove', emitInfo);
                    else emitter.emit('runcheck', emitInfo);
                });
            };
        });
    })
    .connect(config);
}

function runcheck(emitInfo) {
    var conn = new sshClient();
    var config = new Config();
    config.host = emitInfo.instancesTable.ip(emitInfo.slaveName);
    conn.on('ready', function() {
        conn.exec('sh runcheck.sh', function(err, stream) {
            if (err) {
                console.log(err);
                return conn.end();
            } else {
                stream.on('data', function(data) {
                    console.log("");
                    console.log("### runcheck ###");
                    if (emitInfo.isCanceled.val()) emitter.emit('remove', emitInfo);
                    else {
                        var isExist = Boolean(parseInt(data.toString()));
                        if(isExist) emitter.emit('execute', emitInfo);
                        else {
                            if (emitInfo.runcheck) emitter.emit('expanddir', emitInfo);
                            else { 
                                io.emit('error', "Expanded Directory hasn't run.sh");
                                emitter.emit('remove', emitInfo);
                            }
                        }
                    }
                })
            };
        });
    })
    .connect(config);
}

function expanddir(emitInfo) {
    var conn = new sshClient();
    var config = new Config();
    config.host = emitInfo.instancesTable.ip(emitInfo.slaveName);
    conn.on('ready', function() {
        conn.exec('cp -r */* .', function(err, stream) {
            if (err) {
                console.log(err);
                return conn.end();
            } else {
                stream.stderr.on('data', function(data) {
                    emitInfo.runcheck = false;
                    io.emit('error', 'Expanded directory is Empty.');
                    emitter.emit('remove', emitInfo);
                })
                .on('close', function(code, signal) {
                    console.log("");
                    console.log("### expanddir ###");
                    if (emitInfo.isCanceled.val()) emitter.emit('remove', emitInfo);
                    else {
                        if (emitInfo.runcheck) {
                            emitInfo.runcheck = false;
                            emitter.emit('runcheck', emitInfo);
                        }
                    }
                })
            };
        });
    })
    .connect(config);
}

function execute(emitInfo) {
    io.emit('execute', { name: emitInfo.slaveName });
    var conn = new sshClient();
    var config = new Config();
    config.host = emitInfo.instancesTable.ip(emitInfo.slaveName);
    conn.on('ready', function() {
        conn.exec('sh run.sh', function(err, stream) {
            if (err) {
                console.log(err);
                return conn.end();
            } else {
                stream.on('data', function(data){
                    var dataString = data.toString();
                    try {
                        var json = JSON.parse(dataString);
                    } catch(e) {
                        if (dataString.slice(0, 1) == '#') {
                            io.emit('message', { name: emitInfo.slaveName, message: dataString });
                        }
                    }
                    if (json) {
                        console.log("");
                        console.log("### execute ###");
                        emitInfo.results.push(json);
                    }
                })
                .on('close', function(code, signal) {
                    emitter.emit('increment', emitInfo);
                    emitter.emit('remove', emitInfo);
                })
                .stderr.on('data', function(data) {
                    console.log('STDERR: ' + data);
                });;
            }
        });
    }).connect(config);
}
function remove(emitInfo) {
    io.emit('remove', { name: emitInfo.slaveName });
    var conn = new sshClient();
    var config = new Config();
    config.host = emitInfo.instancesTable.ip(emitInfo.slaveName);
    conn.on('ready', function() {
        conn.exec('ls | grep -v -E install.sh | xargs rm -r', function(err, stream) {
            if (err) {
                console.log('remove exec error: ' + err);
                return conn.end();
            } else {
                console.log("");
                console.log("### remove ###");
                stream.on('close', function(code, signal) {
                    emitter.emit('destroy', emitInfo);
                });
            };
        });
    })
    .connect(config);
}
function increment(emitInfo) {
    emitInfo.results.increment();
    console.log("Increment");
    emitter.emit('sendResult');
}

function destroy(emitInfo) {
    io.emit('destroy', {
        name: emitInfo.slaveName
    });
    exec('vagrant destroy -f '+emitInfo.slaveName, function(err, stdout, stderr) {
        if (err){ console.log('vagrant up error: '+ err);
        } else {
            emitInfo.instancesTable.remove(emitInfo.slaveName);
        }
    });
}

emitter.on('vagrantup', vagrantup);
emitter.on('scpzip' , scpzip);
emitter.on('gitclone', gitclone);
emitter.on('scpruncheck' , scpruncheck);
emitter.on('unzip', unzip);
emitter.on('runcheck', runcheck);
emitter.on('expanddir', expanddir);
emitter.on('execute', execute);
emitter.on('remove', remove);
emitter.on('increment', increment);
emitter.on('destroy', destroy);

io.on('connection', function(socket) {
    console.log("### Socket connetction success ###");
    var params = {
        Filters: [
            { Name: "state", Values: ["available"] }
        ],
        Owners: ["self"]
    };
    ec2.describeImages(params, function(err, data) {
        if (err) console.log(err);
        else {
            var amiIDs = data.Images.map(function(image) { return image.ImageId });
            io.emit('amiID', amiIDs);
        }
    });
    socket.on('cancel', function() {
        emitter.emit('cancel');
    });
});

app.use('/dist', express.static('./dist/'));
app.use('/js', express.static('./dist/js/'));

app.get('/', function(req, res) {
    res.sendfile('./dist/index.html');
});

app.post('/', function(req, res) {
    var results        = new resultFunc();
    var instancesTable = new instancesTableFunc();
    var isCanceled     = new isCanceledFunc();
    console.log(isCanceled.val());

    var prefiles = fs.readdirSync('.'); 
    var form = new formidable.IncomingForm();
    var files = [];
    var fields = [];

    form.keepExtensions = true;

    form.on('fileBegin', function(field, file){
        file.path = file.name;
    });

    /*
       .on('field', function(field, value) {
       })
       */
    /*
       .on('file', function(field, file) {
       })
       .on('end', function() {
       });
       */
    form.parse(req, function(err, fields, files) {
        var slavesNum = parseInt(fields['num']);
        var iteration = fields['iteration'];
        process.env.AWS_AMI_ID = fields['amiID'];
        console.log(fields['instanceType']);
        process.env.AWS_INSTANCE_TYPE = fields['instanceType'];
        console.log(process.env.AWS_INSTANCE_TYPE);
        for(var i =0;i< slavesNum; i++){
            var slaveName = 'intern.tsukamoto.slave.child'+i;
            var emitInfo = {
                slaveName     : slaveName,
                instancesTable: instancesTable,
                results       : results,
                runcheck      : true,
                slavesNum     : slavesNum,
                isCanceled    : isCanceled
            };
            if (fields.type === 'zip') {
                emitInfo.type     = 'zip';
                emitInfo.filename = files['zip'].path; 
            } else if (fields.type === 'git') {
                emitInfo.type = 'git';
                emitInfo.url = fields['git'];
            }
            console.log("vagrant up :" + i);
            emitter.emit('vagrantup', emitInfo);
        }
        res.send('Event emit Done');
        /*
           } else if (fields.type === 'git') {
           console.log("Type = git");
           console.log(fields['slaves-num']);
           } else if (fields.type === 'docker') {
           console.log("Type = Docker");
           }
           */
        emitter.on('cancel', function() {
                console.log('ACCEPT CANCEL');
                isCanceled.totrue();
        });
        emitter.on('sendResult', function() { 
            console.log("Counter:");
            console.log(results.getCounter());
            if (results.getCounter() == slavesNum) { 
                io.emit('result', results.getArray());
                var postfiles = fs.readdirSync('.');
                _.difference(postfiles, prefiles).forEach(function(e, i) {
                    fs.unlink(e, function(){});
                });
            }
        });
    });
});

server.listen(8080, function () {
    console.log('Express server listening on %d, in %s mode', 8080, app.get('env'));
});


