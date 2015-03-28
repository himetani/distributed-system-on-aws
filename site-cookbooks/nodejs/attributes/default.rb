default['nodejs']['version'] = "v0.10.33"                                                                                                                                 
default['nodejs']['dirname'] = "node-#{default['nodejs']['version']}"
default['nodejs']['filename'] = "#{default['nodejs']['dirname']}.tar.gz"
default['nodejs']['remote_uri'] = "http://nodejs.org/dist/#{default['nodejs']['version']}/#{default['nodejs']['filename']}"
