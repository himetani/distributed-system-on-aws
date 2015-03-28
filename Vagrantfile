# -*- mode: ruby -*-
# vi: set ft=ruby :

VAGRANTFILE_API_VERSION = "2"
Vagrant.configure(VAGRANTFILE_API_VERSION) do |config|
  config.vm.box    = "dummy"
  ssh_username     = "ec2-user"
  ssh_keypath      = "/home/ec2-user/.ssh/internship_key.pem"
  default_ami      = "ami-18869819" 

  config.vm.define "parent-slave" do |parent|
    parent.omnibus.chef_version = :latest
    parent.vm.provision "chef_solo" do |chef|
      chef.cookbooks_path = ["./cookbooks", "./site-cookbooks"]
      #TODO Add recipies
      chef.run_list = %w[
        recipe[nodejs]
      ]
    end
    parent.vm.provider :aws do |aws, override|
      aws.access_key_id             = ENV['AWS_ACCESS_KEY_ID']
      aws.secret_access_key         = ENV['AWS_SECRET_ACCESS_KEY'] 
      aws.keypair_name              = ENV['AWS_KEYPAIR_NAME']
      aws.instance_type             = ENV['AWS_INSTANCE_TYPE']
      aws.region                    = ENV['AWS_REGION']
      aws.security_groups           = ['intern.tsukamoto.master','intern.tsukamoto.local']
      aws.ami                       = default_ami
      aws.user_data                 = "#!/bin/sh\nsed -i 's/^.*requiretty/#Defaults requiretty/' /etc/sudoers\n"
      aws.tags                      = {
        'Name'=>'intern.tsukamoto.slave.parent'
      }
      override.ssh.username         = ssh_username
      override.ssh.private_key_path = ssh_keypath
    end
  end

  100.times do |i|
    config.vm.define "intern.tsukamoto.slave.child#{i}" do |slave|
      slave.vm.provider :aws do |aws, override|
        aws.access_key_id             = ENV['AWS_ACCESS_KEY_ID']
        aws.secret_access_key         = ENV['AWS_SECRET_ACCESS_KEY'] 
        aws.keypair_name              = ENV['AWS_KEYPAIR_NAME']
        aws.instance_type             = ENV['AWS_INSTANCE_TYPE'] 
        aws.region_config ENV['AWS_REGION'] do |region|
          region.spot_instance = true
          region.spot_max_price = "0.020"
        end
        aws.region                    = ENV['AWS_REGION']
        aws.security_groups           = ['intern.tsukamoto.master','intern.tsukamoto.local']
        aws.ami                       = ENV['AWS_AMI_ID']
        aws.user_data                 = "#!/bin/sh\nsed -i 's/^.*requiretty/#Defaults requiretty/' /etc/sudoers\n"
        aws.tags                      = {
          "Name"=>"intern.tsukamoto.slave.child#{i}",
          "tsukamoto-group"=>"child-slaves"
        }
        override.ssh.username         = ssh_username
        override.ssh.private_key_path = ENV['AWS_PRIVATE_KEY_PAIR_PATH'] 
      end
    end
  end
end
