module.exports = {
	require: ['ts-node/register/transpile-only'],
	files: ['test/**/*.spec.ts'],
	cache: true,
	concurrency: 10, // Moderate concurrency for stability
	verbose: true,
	tap: false,
	failFast: false, // Allow all tests to run even if some fail
	timeout: '10s', // Increased timeout for better stability
	workerThreads: false, // Disable worker threads to avoid cleanup issues
	typescript: {
		rewritePaths: {
			'src/': 'lib/',
		},
		compile: false,
	},
};
