var net = require("net")
var Transform = require('stream').Transform
var Writable = require('stream').Writable
var util = require('util')

// TODOs
// client manager object
// client manager - manager adds and removes from multiple channels channels
// welcome message lists channels that can be connected to
// only store client for broadcasting when it identifies itself with 'USER' command

util.inherits(IrcEngine, Writable)


function IrcEngine(options) {
    Writable.call(this, options)
}

IrcEngine.prototype.write = function(chunk, encoding, done) {
    // TODO
}

IrcEngine.prototype.receive = function(command) {
    // TODO
}

util.inherits(IrcTransform, Transform)

// one transformer per client
// holds client information
// pipes to irc engine once user is known
function IrcTransform(options, clientAddress) {
    Transform.call(this, options)
    
    this._clientAddress = clientAddress
    this._name = undefined
}

IrcTransform.prototype._transform = function(chunk, encoding, done) {
    console.log('Received chunk ..')
    var chunkString = chunk.toString()
    var lines = chunkString.split('\n')

    lines.slice(0, lines.length - 1).forEach(function(line) {
	var tokens = line.split(' ')
	
	tokens.forEach(function(token) {
	    console.log(token)
	})
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
    var ircTransform = new IrcTransform 

    // readable -- pipe --> writeable
    socket.pipe(ircTransform)
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



