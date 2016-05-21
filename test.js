import fs from 'fs';
import path from 'path';
import got from 'got';
import pify from 'pify';
import proxyquire from 'proxyquire';
import sinon from 'sinon';
import test from 'ava';
import {createServer, createSSLServer, createProxy, createSSLProxy} from './fixtures/util';
import m from './';

const fsP = pify(fs);

let httpServer;
let httpsServer;
let proxyServer;
let proxySSLServer;

test.before(async () => {
	const cert = await fsP.readFile(path.join(__dirname, 'fixtures', 'certificate.pem'), 'utf8');
	const key = await fsP.readFile(path.join(__dirname, 'fixtures', 'privatekey.pem'), 'utf8');

	httpServer = await createServer();
	httpsServer = await createSSLServer();
	proxyServer = await createProxy(httpServer.port);
	proxySSLServer = await createSSLProxy(httpsServer.port, {key, cert});

	await httpServer.listen(httpServer.port);
	await proxyServer.listen(proxyServer.port);
	await httpsServer.listen(httpsServer.port);
	await proxySSLServer.listen(proxySSLServer.port);
});

test.after(async () => {
	await httpServer.close();
	await proxyServer.close();
	await httpsServer.close();
	await proxySSLServer.close();
});

test('return `undefined` if no proxy is set', t => {
	t.is(m(), null);
});

test('reassigned args', async t => {
	const o = process.env.HTTP_PROXY;

	process.env.HTTP_PROXY = proxyServer.url;

	const agent = m({protocol: 'http'});
	const {body} = await got('google.com', {agent});

	t.is(body, 'ok');

	process.env.HTTP_PROXY = o;
});

test('http proxy', async t => {
	const agent = m(proxyServer.url);
	const {body} = await got('google.com', {agent});

	t.is(body, 'ok');
});

test.skip('https proxy', async t => {
	const agent = m(proxySSLServer.url);
	const {body} = await got('google.com', {
		agent,
		rejectUnauthorized: false
	});

	t.is(body, 'ok');
});

test('tunnel methods', t => {
	const httpOverHttpSpy = sinon.spy();
	const httpsOverHttpSpy = sinon.spy();
	const httpOverHttpsSpy = sinon.spy();
	const httpsOverHttpsSpy = sinon.spy();
	const caw = proxyquire('./', {
		'tunnel-agent': {
			httpOverHttp: httpOverHttpSpy,
			httpsOverHttp: httpsOverHttpSpy,
			httpOverHttps: httpOverHttpsSpy,
			httpsOverHttps: httpsOverHttpsSpy
		}
	});

	caw(proxyServer.url);
	caw(proxyServer.url, {protocol: 'https'});
	caw(proxySSLServer.url, {protocol: 'http'});
	caw(proxySSLServer.url, {protocol: 'https'});

	t.true(httpOverHttpSpy.calledOnce);
	t.true(httpsOverHttpSpy.calledOnce);
	t.true(httpOverHttpsSpy.calledOnce);
	t.true(httpsOverHttpsSpy.calledOnce);
});
