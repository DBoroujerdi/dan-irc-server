var net = require("net")
var stream = require('stream')
var util = require('util')
var log = require('winston')
var uuid = require('node-uuid')

//************************************************************
// TODOs
// welcome message lists channels that can be connected to
// create package.json
// create readme.md
// create config system to define default behaviour and features. eg. channels, welcome message
//*************************************************************


//
// Utils
//

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


//
// IRC Server
//

// TODO not sure why i decided to do this. might be better off with magic strings
var Protocol = {
    commands: {
	NICK: 'NICK',
	JOIN: 'JOIN',
	KICK: 'KICK',
	USER: 'USER'
    },
    args: {
	NICKNAME: 'NICKNAME',
	REAL_NAME: 'REAL_NAME',
	CHANNEL: 'CHANNEL',
	MODE: 'MODE',
	USER: 'USER'
    }
}

function Channel(name, topic) {
    this.name = name
    this.topic = topic
    var members = new Set

    return {
	containsMember: function(member) {
	    return members.contains(member)
	},
	addMember: function(member) {
	    members.add(member)
	    members.all().forEach(function(member) {
		member.send('JOIN ' + member.nick)
	    })
	},
	setTopic: function(newTopic) {
	    topic = newTopic
	},
	getUserList: function() {
	    var membersString = ''
	    var membersArray = members.getAll()
	    membersArray.forEach(function(member) {
		// TODO should be using nick name??
		membersString = membersString + ' ' + member.name 
	    })
	    return membersString
	}
    }
}

// TODO
// should contain the ability to broadcast to many clients such
// as in a channel for example
function ClientStore() {
    var clients = new Map

    return {
	
    }
}

function ChannelRepo() {
    var channelsMap = new Map

    return {
	addChannels: function(channels) {
	    channels.forEach(function(channel) {
		log.info('Adding channel [%s] to ChannelRepo ...', channel.name)
		channelsMap.put(channel.name, channel)
	    })
	},
	addChannel: function(channel) {
	    // TODO log
	    channelsMap.put(channel.name, channel)
	},
	addUserToChannel: function(channelName, user) {
	    log.info('adding user [%s] to channel [%s]', user.name, channelName)
	    var channel = channelsMap.get(channelName)
	    channel.addMember(user)
	}
    }
}

// TODO pull in server specific functions such as..
//    - handling/managing socket connections
function Server(config, channelRepo) {
    var port = config.port
    var welcomeMessage = config.welcomeMessage
    var clients = new Map
    var netServer = undefined
    var commandFactory = new CommandFactory

    function createConnectionHandler(server) {
	
	function connectionHandler(socket) {
	    var newUuid = uuid.v4()
	    var connection = new Connection(newUuid, socket)
	    var user = new User(connection, server, commandFactory)
	    user.init()
	    
	    log.info('socket open with remote host [%s] and connection uuid [%s]', connection.getAddress(), newUuid.toString())
	    connection.send(welcomeMessage)
	}
	
	return connectionHandler
    }
    
    function createChannels() {
	var channels = []
	config.channels.forEach(function(c) {
	    log.info('Creating new channel [%s] with topic [%s]', c.name, c.topic)
	    var channel = new Channel(c.name, c.topic, this)
	    channels.push(channel)
	})
	channelRepo.addChannels(config.channels)
    }
    
    return {
	addClient: function(name, client) {
	    clients.put(name, client)
	},
	start: function() {
	    createChannels()
	    
	    // start server
	    var connectionHandler = createConnectionHandler(this)
	    netServer = net.createServer(connectionHandler)
	    netServer.listen(port, function() {
		log.info('IRC server started listening on port [%s] ...', port)
	    })
	},
	executeCommand: function(command) {
	    try {
		command.execute(this)
	    } catch (e) {
		log.error('Error executing command [%s] due to error [%s]', command.getName(), e.toString())
	    }
	}
    }
}

function CommandFactory() {

    var executors = {
	'JOIN': function(command, user, server) {
	    var channelName = command.getArg('CHANNEL')
	    if (channelStore.exist(channelName)) {
		channelStore.addUserToChannel(channelName, user)
	    }
	},
	'NICK': function(command, user, server) {
	    var nickname = command.getArg('NICKNAME')
	    
	    // TODO should check nickname is not in use by anyone else
	    // and return appropriate error codes
	    // if nickname is different to current - rename and let everyone know
	    user.setNick(nickname)
	},
	'USER': function(command, user, server) {
	    log.warn('Not yet implemented executor for USER')
	}
    }

    return {
	createCommandFrom: function(user, line) {
	    log.info('Creating command from [%s]', line)
	    
	    var tokens = line.split(' ')
	    var command = tokens[0]
	    var argMap = new Map
	    
	    switch (command) {
	    case 'NICK':
		var args = tokens.slice(1, tokens.length)
		var nickName = tokens[1]

		argMap.put(Protocol.args.NICKNAME, nickName)

		return new Command('NICK', argMap, user, executors.NICK)
		break;
	    case 'USER':
		var args = tokens.slice(1, tokens.length)
		var realName = tokens[4] + ' ' + tokens[5]
		var user = tokens[1]
		var mode = tokens[2]

		argMap.put(Protocol.args.REALNAME, realName)
		argMap.put(Protocol.args.MODE, mode)
		argMap.put(Protocol.args.USER, user)
		
		return new Command('USER', argMap, user, executors.USER)
		break;
	    case 'JOIN':
		var channelName = tokens[1]

		argMap.put(Protocol.args.CHANNEL)

		return new Command('JOIN', argMap, user, executors.JOIN)
		break;
	    default:
		log.warn('Unkown command [' + command + '], ignoring ...')
		return undefined
	    }
	}
    }
}

function Command(name, argsMap, user, executor) {
    var name = name
    var argsMap = argsMap
    var executor = executor

    return {
	getName: function() {
	    return name
	},
	execute: function(server) {
	    log.info('Executing command [%s] ...', name)
	    executor(this, user, server)
	},
	getArg: function(argName) {
	    return argsMap.get(argName)
	},
	getUser: function() {
	    return user
	},
	toString: function() {
	    // TODO user as well
	    return 'Command[' + name + ' Args[' + args.join() + ']]'
	}
    }
}


// info about the user in irc domain
function Member(client, server) {
    var client = client
    
    return {
	// TODO send should be more descriptive of function at irc level
	send: function() {
	    client.send(arguments);
	}
    }
}

// info about the user in connection domain
function User(connection, server, commandFactory) {
    var address = connection.getAddress()
    var socket = connection.getSocket()
    var connectionUuid = connection.getUuid()
    var self = this
    var nick = undefined

    function setUpDataHandler(user) {
	// datahandler has access to user and server
	// TODO test whether this is actually required
	function dataHandler(data) {
	    var dataString = data.toString()
	    var lines = dataString.split("\n")
	    var commands = []
	    lines.slice(0, lines.length - 1).forEach(function(line) {
		var command 

		try {
		    // TODO pass in user here instead of undefined
		    command = commandFactory.createCommandFrom(user, line.replace('\r', ''))
		} catch (e) {
		    // TODO this log line is not working as expected
		    log.error('Error parsing line [%s], error - [%s]', line, e.toString())
		    return
		}
		
		if (command !== undefined) {
		    commands.push(command)
		}
	    })

	    commands.forEach(function(command) {
		server.executeCommand(command)
	    })
	    
	    log.info('%d commands received from [%s]', commands.length, connection.getAddress())
	}

	return dataHandler
    }

    return {
	send: function(params) {
	    try {
		connection.send(params.join(' '))
	    } catch (e) {
		log.error('could not send message to client [%s] because of error [%s]', address, e)
	    }
	},
	setNick: function(newNick) {
	    log.info('Setting user nick with connection UUID [%s] from [%s] to [%s]', this.getConnectionUuid(), nick, newNick)
	    nick = newNick
	},
	getConnectionUuid: function() {
	    return connection.getUuid()
	},
	init: function() {
	    socket.on('data', setUpDataHandler(this))
	}
    }
}

// ircWritable.on('JOIN', function(d) {
// 	// TODO this logic should love elsewhere
// 	log.info(JSON.stringify(d))
// 	if (channels.contains(d.channel)) {
// 	    var channel = channels.get(d.channel)
// 	    if (!channel.containsMember(d.client)) {
// 		channel.addMember(d.client)
// 		var client = clients.get(d.client)
// 		client.write(channel.getTopic())
// 		client.write('/JOIN ' + channel.getName())
// 		client.write('/RPL_TOPIC ' + channel.getTopic())
// 		client.write('/RPL_NAMREPLY ' + d.client)
// 	    }
// 	}
// });

function UserRepository(server) {

    var users = []
    
    return {
	addUser: function(user) {
	    users.push(user)
	}
    }
}

function Connection(uuid, socket) {
    var address = socket.remoteAddress
    var port = socket.remotePort
    var uuid = uuid
    
    return {
	send: function(message) {
	    socket.write(message + '\r\n')
	},
	getAddress: function() {
	    return address
	},
	getPort: function() {
	    return port
	},
	getUuid: function() {
	    return uuid
	},
	getSocket: function() {
	    return socket
	}
    }
}

//
// Startup code
//

var config = {
    port: 6667,
    welcomeMessage: 'Welcome to my IRC server ...',
    channels: [
	{
	    name: 'default',
	    topic: 'this is the topic'
	},
	{
	    name: 'cats',
	    topic: 'We actually hate cats'
	}
    ]
}

var userRepository = new UserRepository(server)
var channelRepo = new ChannelRepo

var server = new Server(config, channelRepo)
server.start()

