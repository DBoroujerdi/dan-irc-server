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
	    var at = items.indexOf(key)
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

    console.log('Created channel [' + name + ']' + ' with topic [' + topic + ']')

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
	}
    }
}

var defaultChannel = new Channel('default', 'this is the topic')

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
	    console.log('emitting NICK')
	    self.emit('NICK', {
		client: self._clientAddress,
		params: tokens.slice(1, tokens.length)
	    })
	    break;
	case 'USER':
	    console.log('emitting USER')
	    self.emit('USER', {
		client: self._clientAddress,
		params: tokens.slice(1, tokens.length)
	    })
	    break;
	case 'JOIN':
	    console.log('emitting JOIN')
	    self.emit('USER', {
		client: self._clientAddress,
		channel: tokens[1]
	    })
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
	console.log('on NICK ' + d.params)
	// TODO
    });
    ircWritable.on('USER', function(d) {
	console.log('on USER ' + d.params)
	// TODO
    });
    ircWritable.on('JOIN', function(d) {
	console.log('on JOIN' + d.channel)
	// TODO
    });
})

server.listen(6667, function() {
    console.log('IRC server started listening on port 6667 ...')
})
