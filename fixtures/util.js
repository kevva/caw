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

exports.createServer = () => getPort().then(port => {
	const s = http.createServer((req, res) => {
		res.writeHead(200);
		res.end('ok');
	});

	s.host = 'localhost';
	s.port = port;
	s.url = `http://${s.host}:${port}`;
	s.protocol = 'http';
	s.listen = pify(s.listen);
	s.close = pify(s.close);

	return s;
});

exports.createSSLServer = () => getPort().then(port => {
	const s = https.createServer((req, res) => {
		res.writeHead(200);
		res.end('ok');
	});

	s.host = 'localhost';
	s.port = port;
	s.url = `https://${s.host}:${port}`;
	s.protocol = 'https';
	s.listen = pify(s.listen);
	s.close = pify(s.close);

	return s;
});

exports.createProxy = serverPort => getPort().then(port => {
	const p = http.createServer(() => {});

	p.host = 'localhost';
	p.port = port;
	p.url = `http://${p.host}:${port}`;
	p.protocol = 'http';
	p.listen = pify(p.listen);
	p.close = pify(p.close);

	p.on('connect', onConnect(serverPort));

	return p;
});

exports.createSSLProxy = (serverPort, opts) => getPort().then(port => {
	const p = https.createServer(opts, () => {});

	p.host = 'localhost';
	p.port = port;
	p.url = `https://${p.host}:${port}`;
	p.protocol = 'https';
	p.listen = pify(p.listen);
	p.close = pify(p.close);

	p.on('connect', onConnect(serverPort));

	return p;
});
