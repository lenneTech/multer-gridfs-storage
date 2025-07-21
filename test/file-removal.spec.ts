import anyTest, {TestFn as TestInterface} from 'ava';
import sinon from 'sinon';
import {ObjectId, GridFSBucket} from 'mongodb';

import {GridFsStorage} from '../src';
import {cleanStorage} from './utils/testutils';
import {storageOptions} from './utils/settings';
import {FileRemovalContext} from './types/file-removal-context';

const test = anyTest as TestInterface<FileRemovalContext>;

test.beforeEach((t) => {
	t.context.sandbox = sinon.createSandbox();
});

test.afterEach.always('cleanup', async (t) => {
	if (t.context.sandbox) {
		t.context.sandbox.restore();
	}
	return cleanStorage(t.context.storage);
});

test('_removeFile successfully deletes file from GridFS', async (t) => {
	t.context.storage = new GridFsStorage(storageOptions());
	const {storage} = t.context;

	await storage.ready();

	// Mock file object
	const mockFile = {
		id: new ObjectId(),
		bucketName: 'fs'
	};

	// Create a spy on GridFSBucket.delete
	const deleteSpy = t.context.sandbox.stub(GridFSBucket.prototype, 'delete')
		.resolves();

	// Test _removeFile method
	const result = await new Promise((resolve, reject) => {
		(storage as any)._removeFile(null, mockFile, (error: Error | null, result: any) => {
			if (error) {
				reject(error);
			} else {
				resolve(result);
			}
		});
	});

	// Verify GridFSBucket.delete was called with correct parameters
	t.true(deleteSpy.calledOnce);
	t.true(deleteSpy.calledWith(mockFile.id));
	t.is(result, undefined); // delete() resolves with undefined
});

test('_removeFile handles GridFS delete errors correctly', async (t) => {
	t.context.storage = new GridFsStorage(storageOptions());
	const {storage} = t.context;

	await storage.ready();

	// Mock file object
	const mockFile = {
		id: new ObjectId(),
		bucketName: 'fs'
	};

	const deleteError = new Error('GridFS delete failed');

	// Stub GridFSBucket.delete to reject
	t.context.sandbox.stub(GridFSBucket.prototype, 'delete')
		.rejects(deleteError);

	// Test _removeFile method error handling
	const error = await t.throwsAsync(
		new Promise((resolve, reject) => {
			(storage as any)._removeFile(null, mockFile, (error: Error | null, result: any) => {
				if (error) {
					reject(error);
				} else {
					resolve(result);
				}
			});
		})
	);

	t.is(error.message, 'GridFS delete failed');
});

test('_removeFile uses correct bucket name from file object', async (t) => {
	t.context.storage = new GridFsStorage(storageOptions());
	const {storage} = t.context;

	await storage.ready();

	// Mock file object with custom bucket name
	const mockFile = {
		id: new ObjectId(),
		bucketName: 'custom-bucket'
	};

	// Create a spy on GridFSBucket constructor to verify options
	const deleteSpy = t.context.sandbox.stub(GridFSBucket.prototype, 'delete')
		.resolves();

	// Test _removeFile method
	await new Promise((resolve, reject) => {
		(storage as any)._removeFile(null, mockFile, (error: Error | null, result: any) => {
			if (error) {
				reject(error);
			} else {
				resolve(result);
			}
		});
	});

	// Verify GridFSBucket was created with correct bucket name
	t.true(deleteSpy.calledOnce);
	t.true(deleteSpy.calledWith(mockFile.id));
});

test('_removeFile handles missing file id gracefully', async (t) => {
	t.context.storage = new GridFsStorage(storageOptions());
	const {storage} = t.context;

	await storage.ready();

	// Mock file object without id
	const mockFile = {
		bucketName: 'fs'
	};

	const deleteSpy = t.context.sandbox.stub(GridFSBucket.prototype, 'delete')
		.resolves();

	// Test _removeFile method with undefined id
	await new Promise((resolve, reject) => {
		(storage as any)._removeFile(null, mockFile, (error: Error | null, result: any) => {
			if (error) {
				reject(error);
			} else {
				resolve(result);
			}
		});
	});

	// Verify delete was called with undefined id
	t.true(deleteSpy.calledOnce);
	t.true(deleteSpy.calledWith(undefined));
});

test.serial('_removeFile callback receives null error on success', async (t) => {
	t.context.storage = new GridFsStorage(storageOptions());
	const {storage} = t.context;

	await storage.ready();

	const mockFile = {
		id: new ObjectId(),
		bucketName: 'fs-success'
	};

	const deleteSpy = t.context.sandbox.stub(GridFSBucket.prototype, 'delete')
		.resolves();

	const callbackSpy = t.context.sandbox.spy();

	// Test _removeFile callback
	(storage as any)._removeFile(null, mockFile, callbackSpy);

	// Wait for async operation to complete
	await new Promise(resolve => setTimeout(resolve, 50));

	t.true(callbackSpy.calledOnce);
	t.is(callbackSpy.firstCall.args[0], null); // error should be null
	t.is(callbackSpy.firstCall.args[1], undefined); // result should be undefined (delete returns void)

	t.context.sandbox.restore();
	deleteSpy.restore();
});

test.serial('_removeFile callback receives error on failure', async (t) => {
	// Create fresh storage for this test
	const storage = new GridFsStorage(storageOptions());
	await storage.ready();

	const mockFile = {
		id: new ObjectId(),
		bucketName: 'fs-error-test'
	};

	const deleteError = new Error('Delete operation failed');
	const deleteSpy = sinon.stub(GridFSBucket.prototype, 'delete').rejects(deleteError);
	const callbackSpy = sinon.spy();

	try {
		// Test _removeFile error callback
		(storage as any)._removeFile(null, mockFile, callbackSpy);

		// Wait for async operation to complete
		await new Promise(resolve => setTimeout(resolve, 100));

		t.true(callbackSpy.calledOnce);
		t.is(callbackSpy.firstCall.args[0], deleteError); // error should be passed
		t.is(callbackSpy.firstCall.args[1], null); // result should be null
	} finally {
		deleteSpy.restore();
		await cleanStorage(storage);
	}
});

test.serial('_removeFile works with different ObjectId formats', async (t) => {
	// Create fresh storage for this test
	const storage = new GridFsStorage(storageOptions());
	await storage.ready();

	const deleteSpy = sinon.stub(GridFSBucket.prototype, 'delete').resolves();

	try {
		// Test with ObjectId instance
		const objectIdFile = {
			id: new ObjectId(),
			bucketName: 'fs-formats'
		};

		await new Promise(resolve => {
			(storage as any)._removeFile(null, objectIdFile, () => resolve(undefined));
		});

		// Test with string ID
		const stringIdFile = {
			id: '507f1f77bcf86cd799439011',
			bucketName: 'fs-formats'
		};

		await new Promise(resolve => {
			(storage as any)._removeFile(null, stringIdFile, () => resolve(undefined));
		});

		t.is(deleteSpy.callCount, 2);
		t.true(deleteSpy.firstCall.calledWith(objectIdFile.id));
		t.true(deleteSpy.secondCall.calledWith(stringIdFile.id));
	} finally {
		deleteSpy.restore();
		await cleanStorage(storage);
	}
});
