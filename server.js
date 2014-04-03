var net = require("net");
var Transform = require('stream').Transform;
var util = require('util');

util.inherits(IrcTransform, Transform);

function IrcTransform(opt) {
    Transform.call(this, opt);
}

IrcTransform.prototype._transform = function(chunk, encoding, done) {
    var chunkString = chunk.toString();
    var lines = chunkString.split('\n');

    lines.slice(0, lines.length - 1).forEach(function(line) {
	var tokens = line.split(' ');
	
	tokens.forEach(function(token) {
	    console.log(token);
	});
    });

    done();
};

var ircTransform = new IrcTransform;

var server = net.createServer(function(socket) {
    console.log('Client connected ...');
    socket.write('Welcome to my IRC server ...\r\n');

    // readable -- pipe --> writeable
    socket.pipe(ircTransform);
});

server.listen(6667, function() {
    console.log('IRC server started listening on port 6667 ...');
});



