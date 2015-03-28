var AWS          = require('aws-sdk');
AWS.config.apiVersions = {
    ec2: '2014-10-01'
};
AWS.config.update({region: 'ap-northeast-1'});
var ec2          = new AWS.EC2();

var params = {
    Filters: [
        { Name: "state", Values: ["available"] }
    ],
    Owners: ["self"]
};
ec2.describeImages(params, function(err, data) {
    if (err) { console.log(err, err.stack);
    } else {
        var amiIDs = data.Images.map(function(image) { return image.ImageId });
        console.log(amiIDs);
    }
});

