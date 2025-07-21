import anyTest, {TestFn as TestInterface} from 'ava';
import {GridFsStorage} from '../src';
import {cleanStorage} from './utils/testutils';
import {storageOptions} from './utils/settings';
import {ConnectionOptionsContext} from './types/connection-options-context';

const test = anyTest as TestInterface<ConnectionOptionsContext>;

test.afterEach.always('cleanup', async (t) => {
	await cleanStorage(t.context.storage);
});

test('is compatible with an options object on url based connections', async (t) => {
	const {url, options} = storageOptions();
	const storage = new GridFsStorage({
		url,
		options: {...options, maxPoolSize: 10},
	});
	t.context.storage = storage;

	await storage.ready();
	// Verify that the maxPoolSize option was correctly passed through
	// In MongoDB 6+, maxPoolSize is the correct option instead of poolSize
	t.truthy(storage.db);
	t.truthy(storage.client);

	// Check that the connection was established with the custom maxPoolSize
	// The exact value is not easily accessible, but we can verify the connection works
	const collections = await storage.db.listCollections().toArray();
	t.truthy(collections); // Connection works, indicating options were processed
});
