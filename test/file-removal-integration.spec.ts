import anyTest, {TestFn as TestInterface} from 'ava';
import {GridFSBucket} from 'mongodb';

import {GridFsStorage} from '../src';
import {cleanStorage, files} from './utils/testutils';
import {storageOptions} from './utils/settings';
import {FileRemovalContext} from './types/file-removal-context';

const test = anyTest as TestInterface<FileRemovalContext>;

test.afterEach.always('cleanup', async (t) => {
	return cleanStorage(t.context.storage);
});

test('_removeFile method exists and can be called manually', async (t) => {
	t.context.storage = new GridFsStorage({
		...storageOptions(),
		file: () => ({filename: 'test-manual.jpg'})
	});

	const {storage} = t.context;
	await storage.ready();

	// Test that _removeFile method exists and is callable
	t.is(typeof (storage as any)._removeFile, 'function', '_removeFile should be a function');

	// Create a mock file object
	const mockFile = {
		id: '507f1f77bcf86cd799439011',
		bucketName: 'fs'
	};

	// Test that _removeFile can be called without throwing
	const promise = new Promise((resolve, reject) => {
		(storage as any)._removeFile(null, mockFile, (error: Error | null) => {
			// We expect an error because the file doesn't exist
			if (error) {
				resolve(error);
			} else {
				resolve(null);
			}
		});
	});

	const result = await promise;
	t.truthy(result, '_removeFile should handle non-existent files');
});


test('_removeFile properly cleans up uploaded files', async (t) => {
	t.context.storage = new GridFsStorage({
		...storageOptions(),
		file: () => ({filename: 'cleanup-test.jpg'})
	});

	const {storage} = t.context;
	await storage.ready();

	// Upload a file first using storage directly
	const fileInfo = await storage.fromFile(null, {
		stream: require('fs').createReadStream(files[0]),
		mimetype: 'image/jpeg'
	});

	t.truthy(fileInfo.id, 'File should be uploaded successfully');

	// Verify the file exists in GridFS
	const bucket = new GridFSBucket(storage.db, {bucketName: fileInfo.bucketName || 'fs'});
	const filesBeforeDelete = await bucket.find({_id: fileInfo.id}).toArray();
	t.is(filesBeforeDelete.length, 1, 'File should exist in GridFS before deletion');

	// Now manually call _removeFile to simulate cleanup
	await new Promise<void>((resolve, reject) => {
		(storage as any)._removeFile(null, fileInfo, (error: Error | null) => {
			if (error) {
				reject(error);
			} else {
				resolve();
			}
		});
	});

	// Verify the file was actually deleted from GridFS
	const filesAfterDelete = await bucket.find({_id: fileInfo.id}).toArray();
	t.is(filesAfterDelete.length, 0, 'File should be deleted from GridFS');
});

test('_removeFile handles non-existent file gracefully', async (t) => {
	t.context.storage = new GridFsStorage(storageOptions());
	const {storage} = t.context;

	await storage.ready();

	// Mock file object with non-existent ID
	const mockFile = {
		id: '507f1f77bcf86cd799439011', // Valid ObjectId format but doesn't exist
		bucketName: 'fs'
	};

	// _removeFile should not throw when trying to delete non-existent file
	const error = await t.throwsAsync(
		new Promise<void>((resolve, reject) => {
			(storage as any)._removeFile(null, mockFile, (error: Error | null) => {
				if (error) {
					reject(error);
				} else {
					resolve();
				}
			});
		})
	);

	// GridFS typically throws an error when trying to delete non-existent file
	t.truthy(error);
	t.regex(error.message, /not found|does not exist/i);
});
