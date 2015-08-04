'use strict';
var net = require('net');
var http = require('http');
var https = require('https');
var fs = require('fs');
var path = require('path');
var sinon = require('sinon');
var proxyquire = require('proxyquire');
var test = require('tap').test;
var caw = require('./');
var serverPort = 9000;
var proxyPort = 8000;
var httpsProxyPort = 5000;
var server;
var proxy;
var httpsProxy;

test('return undefined, if not proxy around', function (t) {
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
	proxy = http.createServer(function () {});
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

test('setup https proxy', function (t) {
	var options = {
		key: fs.readFileSync(path.join(__dirname, './fixtures/ssl/privatekey.pem'), 'utf8'),
		cert: fs.readFileSync(path.join(__dirname, './fixtures/ssl/certificate.pem'), 'utf8')
	};

	httpsProxy = https.createServer(options, function () {});
	httpsProxy.protocol = 'https';
	httpsProxy.on('connect', onConnect);

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

	httpsProxy.listen(httpsProxyPort, t.end);
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

test('https proxy', function (t) {
	process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

	var agent = caw('https://0.0.0.0:5000');
	var waitForConnection = setTimeout(function () {
		throw new Error('agent didn\'t connect to proxy');
	}, 50);

	https.get({
		hostname: 'google.com',
		agent: agent
	}, function (res) {
		clearTimeout(waitForConnection);
		res.on('data', function (chunk) {
			t.equal(chunk.toString(), 'Hello proxy');
			t.end();
		});
	}).on('error', function (e) {
		t.error(e);
	});
});

test('tunnel methods', function (t) {
	var httpOverHttpSpy = sinon.spy();
	var httpsOverHttpSpy = sinon.spy();
	var httpOverHttpsSpy = sinon.spy();
	var httpsOverHttpsSpy = sinon.spy();

	var _caw = proxyquire('./index.js', {
		'tunnel-agent': {
			httpOverHttp: httpOverHttpSpy,
			httpsOverHttp: httpsOverHttpSpy,
			httpOverHttps: httpOverHttpsSpy,
			httpsOverHttps: httpsOverHttpsSpy
		}
	});

	_caw('http://0.0.0.0:8000');
	t.equal(httpOverHttpSpy.calledOnce, true);

	_caw('http://0.0.0.0:8000', {
		protocol: 'https:'
	});
	t.equal(httpsOverHttpSpy.calledOnce, true);

	_caw('https://0.0.0.0:5000', {
		protocol: 'http:'
	});
	t.equal(httpOverHttpsSpy.calledOnce, true);

	_caw('https://0.0.0.0:5000', {
		protocol: 'https:'
	});
	t.equal(httpsOverHttpsSpy.calledOnce, true);

	t.end();
});

test('cleanup', function (t) {
	proxy.close();
	server.close();
	httpsProxy.close();
	process.env.NODE_TLS_REJECT_UNAUTHORIZED = undefined;
	t.end();
});
