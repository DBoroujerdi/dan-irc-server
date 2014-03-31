var net = require("net");
var Writable = require('stream').Writable;
var util = require('util');

util.inherits(IrcWritable, Writable);

function IrcWritable(opt) {
    Writable.call(this, opt);
}

IrcWritable.prototype._write = function(chunk, encoding, callback) {
    console.log("Received chunks from client ...");
    console.log(chunk.toString());

    callback();
};

var ircWritable = new IrcWritable;

var server = net.createServer(function(socket) {
    console.log('Client connected ...');
    socket.write('Welcome to my IRC server ...\r\n');

    // readable -- pipe --> writeable
    socket.pipe(ircWritable);
});

server.listen(6667, function() {
    console.log('IRC server started listening on port 6667 ...');
});



