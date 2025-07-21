import anyTest, {TestFn as TestInterface} from 'ava';
import express from 'express';
import request from 'supertest';
import multer from 'multer';
import mongoose from 'mongoose';
import {MongoClient} from 'mongodb';
import delay from 'delay';
import {GridFsStorage} from '../src';
import {
	files,
	cleanStorage,
	getDb,
	getClient,
	dropDatabase,
	mongoVersion,
} from './utils/testutils';
import {storageOptions} from './utils/settings';
import {fileMatchMd5Hash} from './utils/macros';
import {StorageConstructorContext} from './types/storage-constructor-context';

const test = anyTest as TestInterface<StorageConstructorContext>;
const [major] = mongoVersion;

function prepareTest(t, options) {
	const app = express();
	const storage = new GridFsStorage(options);
	const upload = multer({storage});
	t.context.storage = storage;
	t.context.upload = upload;
	t.context.app = app;
}

test.afterEach.always('cleanup', async (t) => {
	const {storage, url} = t.context;

	// For mongoose test, handle cleanup differently
	if (t.title.includes('connects to a mongoose instance')) {
		// Close mongoose connection first for mongoose tests
		if (mongoose.connection.readyState !== 0) {
			await mongoose.connection.close();
		}
		// Don't call cleanStorage for mongoose tests as it conflicts with closed connections
		if (url) {
			return dropDatabase(url);
		}
		return;
	}

	// Standard cleanup for non-mongoose tests
	try {
		await cleanStorage(storage);
	} catch (error) {
		// Ignore cleanup errors if connection is already closed
		console.warn('Cleanup warning:', error.message);
	}

	// For non-mongoose tests, ensure mongoose is not interfering
	if (mongoose.connection.readyState !== 0) {
		await mongoose.connection.close();
	}

	if (url) {
		return dropDatabase(url);
	}
});

test.serial('connects to a mongoose instance', async (t) => {
	// Ensure mongoose is disconnected before starting
	if (mongoose.connection.readyState !== 0) {
		await mongoose.connection.close();
	}

	const {url, options} = storageOptions();
	t.context.url = url;
	let result: any = {};
	const promise = mongoose.connect(url, options);
	prepareTest(t, {db: promise});
	const {app, storage, upload} = t.context;

	app.post('/url', upload.array('photos', 2), (request_, response) => {
		result = {
			headers: request_.headers,
			files: request_.files,
			body: request_.body,
		};
		response.end();
	});

	const {db} = await storage.ready();
	// Ensure mongoose connection is fully established
	await promise;
	await request(app)
		.post('/url')
		.attach('photos', files[0])
		.attach('photos', files[1]);

	t.true(db instanceof mongoose.mongo.Db);
	await fileMatchMd5Hash(t, result.files);

	storage.client = mongoose.connection;
});

test('create storage from url parameter', async (t) => {
	let result: any = {};
	prepareTest(t, storageOptions());
	const {app, storage, upload} = t.context;

	app.post('/url', upload.array('photos', 2), (request_, response) => {
		result = {
			headers: request_.headers,
			files: request_.files,
			body: request_.body,
		};
		response.end();
	});

	await storage.ready();
	await request(app)
		.post('/url')
		.attach('photos', files[0])
		.attach('photos', files[1]);

	return fileMatchMd5Hash(t, result.files);
});

test('create storage from db parameter', async (t) => {
	const {url, options} = storageOptions();
	t.context.url = url;
	let result: any = {};
	const _db = await MongoClient.connect(url, options);
	const db = getDb(_db, url);
	prepareTest(t, {db});
	const {app, storage, upload} = t.context;
	storage.client = getClient(_db);

	app.post('/url', upload.array('photos', 2), (request_, response) => {
		result = {
			headers: request_.headers,
			files: request_.files,
			body: request_.body,
		};
		response.end();
	});

	await storage.ready();
	await request(app)
		.post('/url')
		.attach('photos', files[0])
		.attach('photos', files[1]);

	return fileMatchMd5Hash(t, result.files);
});


test('creates an instance without the new keyword', async (t) => {
	let result: any = {};
	const app = express();

	// @ts-expect-error, compatibility with older versions
	const storage = GridFsStorage(storageOptions());

	const upload = multer({storage});
	t.context.storage = storage;

	app.post('/url', upload.array('photos', 2), (request_, response) => {
		result = {
			headers: request_.headers,
			files: request_.files,
			body: request_.body,
		};
		response.end();
	});

	await storage.ready();
	await request(app)
		.post('/url')
		.attach('photos', files[0])
		.attach('photos', files[1]);

	return fileMatchMd5Hash(t, result.files);
});
if (major >= 3) {
	test('accept the client as one of the parameters', async (t) => {
		const {url, options} = storageOptions();
		t.context.url = url;
		let result: any = {};
		const _db = await MongoClient.connect(url, options);
		const db = getDb(_db, url);
		const client = getClient(_db);
		prepareTest(t, {db, client});
		const {app, storage, upload} = t.context;
		t.is(storage.client, client);

		app.post('/url', upload.array('photos', 2), (request_, response) => {
			result = {
				headers: request_.headers,
				files: request_.files,
				body: request_.body,
			};
			response.end();
		});

		await storage.ready();
		await request(app)
			.post('/url')
			.attach('photos', files[0])
			.attach('photos', files[1]);

		return fileMatchMd5Hash(t, result.files);
	});

	test('waits for the client if is a promise', async (t) => {
		const {url, options} = storageOptions();
		t.context.url = url;
		let result: any = {};
		const _db = await MongoClient.connect(url, options);
		const db = getDb(_db, url);
		const client = delay(100).then(() => getClient(_db));
		prepareTest(t, {db, client});
		const {app, storage, upload} = t.context;
		t.is(storage.client, null);

		app.post('/url', upload.array('photos', 2), (request_, response) => {
			result = {
				headers: request_.headers,
				files: request_.files,
				body: request_.body,
			};
			response.end();
		});

		await storage.ready();
		await request(app)
			.post('/url')
			.attach('photos', files[0])
			.attach('photos', files[1]);

		t.not(storage.client, null);
		return fileMatchMd5Hash(t, result.files);
	});
}
