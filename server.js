var net = require("net")
var stream = require('stream')
var util = require('util')

// TODOs
// client manager object
// client manager - manager adds and removes from multiple channels channels
// welcome message lists channels that can be connected to
// only store client for broadcasting when it identifies itself with 'USER' command
// rename ircWirtable to clientStream or ircClientStream

function Set() {
    var items = []
    
    return {
	contains: function(item) {
	    var at = items.indexOf(item)
	    return at > -1
	},
	add: function(item) {
	    var at = items.indexOf(item)
            if (at < 0) {
                at = items.length
            } else {
		return false
	    }
            items[at] = item
	    return true
	},
	remove: function(item) {
	    var at = items.indexOf(item)
            if (at >= 0) {
                items.splice(at, 1)
            }
	},
	getAll: function() {
	    return items.slice(0)
	}
    }
}

// replace implementation with object type copy from js DAG
function Map() {
    var keys = [], values = []

    return {
	contains: function(key) {
	    var at = keys.indexOf(key)
	    return at > -1
	},
        get: function (key) {
            var at = keys.indexOf(key)
            if (at >= 0) {
                return values[at]
            }
        },
        put: function (key, value) {
            var at = keys.indexOf(key)
            if (at < 0) {
                at = keys.length
            }
            keys[at] = key
            values[at] = value
        },
        remove: function (key) {
            var at = keys.indexOf(key)
            if (at >= 0) {
                keys.splice(at, 1)
                values.splice(at, 1)
            }
        }
    }
}

function Channel(name, topic) {
    var name = name
    var topic = topic
    var members = new Set

    return {
	getName: function() {
	    return name
	},
	getTopic: function() {
	    return topic
	},
	containsMember: function(member) {
	    return members.contains(member)
	},
	addMember: function(member) {
	    members.add(member)
	},
	setTopic: function(newTopic) {
	    topic = newTopic
	},
	getUserList: function() {
	    var membersString = ''
	    var membersArray = members.getAll()
	    membersArray.forEach(function(member) {
		membersString = membersString + ' '
	    })
	    return membersString
	}
    }
}

var defaultChannel = new Channel('#default', 'this is the topic')

var channels = new Map
channels.put(defaultChannel.getName(), defaultChannel)

util.inherits(IrcWritable, stream.Writable)

// one transformer per client
// holds client information
// pipes to irc engine once user is known
function IrcWritable(clientAddress) {
    stream.Writable.call(this)
    
    this._clientAddress = clientAddress
    this._name = undefined
}

IrcWritable.prototype._write = function(chunk, encoding, done) {
    var self = this;
    var chunkString = chunk.toString()
    var lines = chunkString.split('\n')

    var commandObject

    lines.slice(0, lines.length - 1).forEach(function(line) {
	var tokens = line.split(' ')
	var command = tokens[0]
	
	switch (command) {
	case 'NICK':
	    self.emit('NICK', {
		client: self._clientAddress,
		params: tokens.slice(1, tokens.length)
	    })
	    break;
	case 'USER':
	    self.emit('USER', {
		client: self._clientAddress,
		params: tokens.slice(1, tokens.length)
	    })
	    break;
	case 'JOIN':
	    self.emit('JOIN', {
		client: self._clientAddress,
		channel: tokens[1]
	    })
	    break;
	default:
	    console.log('Unkown command [' + command + '], ignoring ...')
	}
    })

    done()
}

var clients = new Map

function removeClient(client) {
    if (clients.contains(client)) {
	console.log('Socket closed/ended, removing client [' + client + '] ...')
	clients.remove(client)
    }
}

var server = net.createServer(function(socket) {
    var clientAddress = socket.remoteAddress

    console.log('Client [' + clientAddress + '] connected ...')

    if (!clients.contains(clientAddress)) {
	clients.put(clientAddress, socket)
    } else {
	socket.end('Client is already connected to this server. Disconnecting ...')
	return
    }

    socket.write('Welcome to my IRC server ...\r\n')

    socket.on('close', function() {
	removeClient(clientAddress)
    })
    socket.on('end', function() {
	removeClient(clientAddress)
    })
    
    // create transformer for client ...
    var ircWritable = new IrcWritable(clientAddress) 

    // readable -- pipe --> writeable
    socket.pipe(ircWritable)

    ircWritable.on('NICK', function(d) {
	console.log(JSON.stringify(d))
	// TODO
    });
    ircWritable.on('USER', function(d) {
	console.log(JSON.stringify(d))
	var client = clients.get(d.client)
	client.write('USER not implemented yet ..')
	// TODO
    });
    ircWritable.on('JOIN', function(d) {
	console.log(JSON.stringify(d))
	if (channels.contains(d.channel)) {
	    var channel = channels.get(d.channel)
	    if (!channel.containsMember(d.client)) {
		channel.addMember(d.client)
		var client = clients.get(d.client)
		client.write('JOIN ' + channel.getName())
		client.write('RPL_TOPIC ' + channel.getTopic())
		client.write('RPL_NAMREPLY ' + channel.getUserList() + ' ' + d.client)
	    }
	}
    });
})

server.listen(6667, function() {
    console.log('IRC server started listening on port 6667 ...')
})
