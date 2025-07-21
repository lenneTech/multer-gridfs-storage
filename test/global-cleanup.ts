import {MongoClient} from 'mongodb';
import {connection} from './utils/settings';

/**
 * Global cleanup to remove all test databases after tests complete
 */
export async function cleanupTestDatabases() {
	const {host, port, database} = connection;
	const url = `mongodb://${host}:${port}`;
	
	let client: MongoClient;
	try {
		// Connect to MongoDB
		client = await MongoClient.connect(url);
		
		// Get admin database
		const adminDb = client.db().admin();
		
		// List all databases
		const result = await adminDb.listDatabases();
		const testDatabases = result.databases.filter(db => 
			db.name.startsWith(`${database}_`)
		);
		
		console.log(`Found ${testDatabases.length} test databases to clean up`);
		
		// Drop each test database
		for (const db of testDatabases) {
			try {
				await client.db(db.name).dropDatabase();
				console.log(`Dropped test database: ${db.name}`);
			} catch (error) {
				console.error(`Failed to drop database ${db.name}:`, error.message);
			}
		}
		
		console.log('Test database cleanup completed');
	} catch (error) {
		console.error('Failed to connect for cleanup:', error.message);
	} finally {
		if (client) {
			await client.close();
		}
	}
}

// Register cleanup on process exit
if (require.main === module) {
	cleanupTestDatabases().catch(console.error);
}