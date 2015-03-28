# README #

This repository is master server.
User posts master server some information, slave number, zip, git, instance type, AMI ID, etc.
Master server creates slave servers in AWS and then distributes zip, runs program, and gather results.
After run program in slave, slave server is destroied.
(Zip and Git supported, Docker unsupported)

## How do I get set up? ##
 
###master server requirement (tested version)
* Vagrant (1.7.2)
* Node.js (0.10.33)
* vagrant-aws (0.6.0)
* vagrant-omnibus (1.4.1)
* Chef (12.0.3)

### AWS setting ###
Master server need some information for accessing AWS.
You need to set some environment variables in .bashrc or .zshrc.

For example
```  
# .bashrc 
export AWS_ACCESS_KEY_ID=XXX  
export AWS_SECRET_ACCESS_KEY=XXX  
export AWS_KEYPAIR_NAME=XXX  
export AWS_PRIVATE_KEY_PAIR_PATH=XXX  
export AWS_REGION=XXX
```

* security group   
This application uses 8080 port, so you need to open it in AWS managemetn console.
### Vagrant setting
Vagrant-aws plugin need to Dummy Box for AMI.
```
$ vagrant box add dummy https://github.com/mitchellh/vagrant-aws/raw/master/dummy.box  
$ vagrant box list  
dummy                               (aws)  
```
### Create AMI ###
You need to create AMI from instance inited by vagrant.
So, first you need to initialize parent-slave in AWS.
```
$ vagrant up parent-slave --provider=aws
```
After then, you can login parent-slave and create environment you like.
```
$ vagrant ssh parent-slave
```
After then, you can create AMI by running instances by EC2 Management Console.

### Zip File ###
Zip file need to include run.sh or directory which has run.sh at the top.

## Install npm package ##
$ npm install

## How to start  ##
$ npm start