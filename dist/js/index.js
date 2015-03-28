// To use socket.io in AngularJS
angular.module('distributedApp', [])
.factory('socket', function ($rootScope) {
    var socket = io.connect();
    return {
        on: function (eventName, callback) {
            socket.on(eventName, function () {  
                var args = arguments;
                $rootScope.$apply(function () {
                    callback.apply(socket, args);
                });
            });
        },
        emit: function (eventName, data, callback) {
            socket.emit(eventName, data, function () {
                var args = arguments;
                $rootScope.$apply(function () {
                    if (callback) {
                        callback.apply(socket, args);
                    }
                });
            })
        }
    };
})
.config( [
    '$compileProvider',
    function( $compileProvider )
    {   
        $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|ftp|mailto|chrome-extension|blob):/);
    }
])
.controller('DistributedController', ['$scope', '$http', 'socket', function($scope, $http, socket) {
    $scope.instances     = new Array(); 
    $scope.isRunning     = false;
    $scope.isEnd         = false;
    $scope.types         = ['zip', 'git', 'docker'];
    $scope.isZipType     = false;
    $scope.isGitType     = false;
    $scope.isDockerType  = false;
    $scope.num           = 1;
    $scope.result;
    $scope.instanceTypes = [
        't2.micro',
        't2.small',
        't2.medium',
        'm3.medium',
        'm3.large',
        'm3.xlarge',
        'm3.wxlarge',
        'c4.large',
        'c4.xlarge',
        'c4.2xlarge',
        'c4.4xlarge',
        'c4.8xlarge',
        'c3.large',
        'c3.xlarge',
        'c3.2xlarga',
        'c3.4xlarge'
    ];
    $scope.isCanceled = false;

    socket.on('amiID', function(data) {
        $scope.amiIDs = data;
    });

    $scope.$watch("type",function() {
        if ($scope.type === 'zip') {
            $scope.isZipType = true;
            $scope.isGitType = false;
            $scope.isDockerType = false;
        } else if ($scope.type === 'git'){
            $scope.isZipType = false;
            $scope.isGitType = true;
            $scope.isDockerType = false;
        } else if ($scope.type === 'docker') {
            $scope.isZipType = false;
            $scope.isGitType = false;
            $scope.isDockerType = true;
        }
    },true);

    $scope.bindZipFile = function(files) {
        $scope.zip = files[0];
    }
    $scope.bindDockerFile = function(files) {
        $scope.docker = files[0];
    }

    $scope.validate = function() {
        if ($scope.type && $scope.num && $scope.instanceType && $scope.amiID) {
            if ($scope.type === 'zip') {
                if($scope.zip) {
                    var fd = new FormData();
                    fd.append("zip", $scope.zip);
                    send(fd);
                } else {
                    alert("Fill all input");
                }
            } else if ($scope.type === 'git'){
                if($scope.git) {
                    var fd = new FormData();
                    fd.append("git", $scope.git)
                    send(fd);
                } else {
                    alert("Fill all input");
                }
            } else if ($scope.type === 'docker') {
                alert('Docker is not supported');
            }
        } else {
            alert("Fill All Input!");
        }
    };

    function send(fd) {
        fd.append("type", $scope.type);
        fd.append("num", $scope.num);
        fd.append("instanceType", $scope.instanceType);
        fd.append("amiID", $scope.amiID);
        $scope.isRunning = true;
        $http.post('http://54.65.216.163:8080/', fd,{
            headers: { 'Content-Type': undefined },
            transformRequest: angular.identity
        })
        .success(function(data, status, headers, config) {
            console.log(data);
        })
        .error(function(data, status, headers, config) {
            console.log(headers);
        }); 
    }

    $scope.cancel = function() {
        /*
        $scope.isRunning = false;
        $scope.isEnd     = false;
        $scope.instances = new Array();
        $scope.result    = null;
        $scope.isCanceled = true;
        */
        socket.emit('cancel');
        console.log('Cancel');
    }

    $scope.clear = function() {
        $scope.isRunning = false;
        $scope.isEnd     = false;
        $scope.instances = new Array();
        $scope.result    = null;
    }

    socket.on('vagrantup', function(data) {
        $scope.instances.push({ name: data.name, step: "Initializing" });
    });
    socket.on('scp', function(data) {
        var index = $scope.instances.map(function(instance) { return instance.name }).indexOf(data.name);
        $scope.instances[index].ip = data.ip;
        $scope.instances[index].step = 'Copy File';
    });
    socket.on('unzip', function(data) {
        var index = $scope.instances.map(function(instance) { return instance.name }).indexOf(data.name);
        $scope.instances[index].step = 'Unzip File';
    });
    socket.on('execute', function(data) {
        var index = $scope.instances.map(function(instance) { return instance.name }).indexOf(data.name);
        $scope.instances[index].step = 'Running';
    });
    socket.on('message', function(data) {
        var index = $scope.instances.map(function(instance) { return instance.name }).indexOf(data.name);
        $scope.instances[index].message = data.message;
    });
    socket.on('remove', function(data) {
        var index = $scope.instances.map(function(instance) { return instance.name }).indexOf(data.name);
        $scope.instances[index].step = 'Remove Files';
    });
    socket.on('destroy', function(data) {
        var index = $scope.instances.map(function(instance) { return instance.name }).indexOf(data.name);
        $scope.instances[index].step = 'Terminate';
    });
    socket.on('result', function(data) {
        $scope.result = data;
        var blob = new Blob([JSON.stringify(data)], { type: 'text/plain' });
        $scope.resultURL = URL.createObjectURL(blob);
        $scope.isEnd = true;
    });
    socket.on('error', function(data) {
        alert(data);
    });
    socket.on('checkcanceled', function(emitInfo) {
        if ($scope.isCanceled) socket.emit('terminate', emitInfo);
    });
}]);
