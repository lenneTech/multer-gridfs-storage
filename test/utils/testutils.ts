import {Readable, Writable} from 'stream';
import path from 'path';
import {parse} from 'mongodb-uri';
import {MongoClient} from 'mongodb';
import hasOwn from 'has-own-prop';
import delay from 'delay';

import {version} from 'mongodb/package.json';
import {connection, storageOptions} from './settings';

export const mongoVersion = version.split('.').map((v) => Number(v));

export const files = ['sample1.jpg', 'sample2.jpg'].map((file) =>
	path.join(__dirname, '/../attachments/', file),
);

export async function cleanStorage(
	storage: any,
	{client = null, db = null} = {},
) {
	if (storage) {
		storage.removeAllListeners();
		if (!db && !client) {
			db = storage.db;
			client = storage.client;
		}

		if (db) {
			try {
				await db.dropDatabase();
			} catch (error) {
				// Ignore errors if connection is already closed
				if (!error.message?.includes('must be connected')) {
					throw error;
				}
			}
			return closeConnections({db, client});
		}
	}
}

export async function closeConnections({db, client}) {
	if (client) {
		if (hasOwn(client, 'readyState') && client.readyState === 1) {
			return client.close(true);
		}

		if (hasOwn(client, 'isConnected') && client.isConnected()) {
			return client.close(true);
		}
	} else if (db && typeof db.close === 'function') {
		return db.close(true);
	}
}

export async function dropDatabase(url: string): Promise<any> {
	if (url) {
		const {options} = storageOptions();
		const _db = await MongoClient.connect(url, options);
		const db = getDb(_db, url);
		const client = getClient(_db);
		await db.dropDatabase();
		if (client) {
			return client.close(true);
		}

		return db.close(true);
	}
}

export function getDb(client, url) {
	if (client instanceof MongoClient) {
		const {database} = parse(url);
		return client.db(database || connection.database);
	}

	return client;
}

export function getClient(client) {
	return client instanceof MongoClient ? client : null;
}

export function fakeConnectCb(error = null) {
	return async (...args) => {
		if (args.length === 3) {
			const cb = args[2];
			setTimeout(() => {
				cb(error);
			});
			return;
		}

		await delay(1);
		if (error) {
			return Promise.reject(error);
		}
	};
}

export function defer() {
	const d = {
		promise: null,
		resolve: null,
		reject: null,
	};
	d.promise = new Promise((resolve, reject) => {
		d.resolve = resolve;
		d.reject = reject;
	});
	return d;
}

export class ErrorReadableStream extends Readable {
	err: Error;

	_read() {
		this.err = new Error('Stream error');
		this.emit('error', this.err);
	}
}
export class ErrorWritableStream extends Writable {
	err: Error;

	_write() {
		this.err = new Error('Stream error');
		this.emit('error', this.err);
	}
}
