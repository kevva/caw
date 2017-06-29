'use strict';
const http = require('http');
const https = require('https');
const net = require('net');
const getPort = require('get-port');
const pify = require('pify');

const onConnect = port => (req, socket, head) => {
	const s = net.connect(port, () => {
		socket.write('HTTP/1.1 200 Connection established\r\n\r\n');
		socket.pipe(s);
		s.write(head);
		s.pipe(socket);
	});

	s.on('end', () => socket.end());
};

const createServer = ssl => () => getPort().then(port => {
	const protocol = ssl ? 'https' : 'http';
	const type = ssl ? https : http;
	const s = type.createServer((req, res) => {
		res.writeHead(200);
		res.end('ok');
	});

	s.host = 'localhost';
	s.port = port;
	s.url = `${protocol}://${s.host}:${port}`;
	s.protocol = protocol;
	s.listen = pify(s.listen);
	s.close = pify(s.close);

	return s;
});

const createProxy = ssl => (serverPort, opts) => getPort().then(port => {
	const protocol = ssl ? 'https' : 'http';
	const type = ssl ? https : http;
	const p = type.createServer(opts, () => {});

	p.host = 'localhost';
	p.port = port;
	p.url = `${protocol}://${p.host}:${port}`;
	p.protocol = protocol;
	p.listen = pify(p.listen);
	p.close = pify(p.close);

	p.on('connect', onConnect(serverPort));

	return p;
});

exports.createServer = createServer();
exports.createSSLServer = createServer(true);
exports.createProxy = createProxy();
exports.createSSLProxy = createProxy(true);
