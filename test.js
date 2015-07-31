'use strict';
var net = require('net');
var http = require('http');
var test = require('tap').test;
var caw = require('./');
var serverPort = 9000;
var proxyPort = 8000;
var server;
var proxy;

test('return undefiend, if not proxy around', function (t) {
	t.equal(caw(), undefined);
	t.end();
});

test('setup http server', function (t) {
	server = http.createServer(function (req, res) {
		res.writeHead(200);
		res.end('Hello proxy');
	});

	server.listen(serverPort, t.end);
});

test('setup http proxy', function (t) {
	proxy = http.createServer(function (req, res) {});
	proxy.on('connect', onConnect);

	function onConnect(req, clientSocket, head) {
		var serverSocket = net.connect(serverPort, function () {
			clientSocket.write('HTTP/1.1 200 Connection established\r\n\r\n');
			clientSocket.pipe(serverSocket);
			serverSocket.write(head);
			serverSocket.pipe(clientSocket);
			serverSocket.on('end', function () {
				clientSocket.end();
			});
		});
	}

	proxy.listen(proxyPort, t.end);
});

test('reassigned args', function (t) {
	var origProxy = process.env.HTTP_PROXY;
	process.env.HTTP_PROXY = 'http://0.0.0.0:8000';

	var agent = caw(undefined, {
		protocol: 'http'
	});

	http.get({
		hostname: 'google.com',
		agent: agent
	}, function (res) {
		res.on('data', function (chunk) {
			t.equal(chunk.toString(), 'Hello proxy');
			process.env.HTTP_PROXY = origProxy;
			t.end();
		});
	}).on('error', function (e) {
		process.env.HTTP_PROXY = origProxy;
		t.error(e);
	});
});

test('http proxy', function (t) {
	var agent = caw('http://0.0.0.0:8000');

	http.get({
		hostname: 'google.com',
		agent: agent
	}, function (res) {
		res.on('data', function (chunk) {
			t.equal(chunk.toString(), 'Hello proxy');
			t.end();
		});
	}).on('error', function (e) {
		t.error(e);
	});
});

test('cleanup', function (t) {
	proxy.close();
	server.close();
	t.end();
});
