var net = require("net")
var stream = require('stream')
var util = require('util')

// TODOs
// client manager object
// client manager - manager adds and removes from multiple channels channels
// welcome message lists channels that can be connected to
// only store client for broadcasting when it identifies itself with 'USER' command

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
    console.log('Received chunk ..' + chunk.toString())
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
		params: tokens.slice(1, tokens.length)
	    })
	    break;
	case 'USER':
	    console.log('emitting USER')
	    self.emit('USER', {
		params: tokens.slice(1, tokens.length)
	    })
	    break;
	default:
	    console.log('Unkown command [' + command + '], ignoring ...')
	}
    })

    done()
}



var clients = (function () {
    var keys = [], values = []

    return {
	contains: function(key) {
	    var at = keys.indexOf(key)
	    if (at === -1) {
		return false
	    }
	    return true
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
}())

var server = net.createServer(function(socket) {
    var clientAddress = socket.remoteAddress

    console.log('Client [' + clientAddress + '] connected ...')

    if (!clients.contains(clientAddress)) {
	clients.put(clientAddress, socket)
    } else {
	socket.end('Client is already connected to this server. Disconnecting ...')
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
})

function removeClient(client) {
    if (clients.contains(client)) {
	console.log('Socket closed/ended, removing client [' + client + '] ...')
	clients.remove(client)
    }
}

server.listen(6667, function() {
    console.log('IRC server started listening on port 6667 ...')
})
