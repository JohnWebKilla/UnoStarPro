const Redis = require('ioredis');

// Create a Redis client
const redis = new Redis({
    host: 'localhost',
    port: 6379,
    connectTimeout: 2000, // 2 seconds
    retryStrategy: () => null // Don't retry
});

// Set a timeout for the connection attempt
const timeout = setTimeout(() => {
    console.error('\x1b[31m%s\x1b[0m', '❌ Redis connection timed out');
    console.log('\nTo use Redis locally:');
    console.log('\x1b[33m%s\x1b[0m', '1. Install Redis:');
    console.log('   - macOS: brew install redis');
    console.log('   - Linux: sudo apt install redis-server');
    console.log('   - Windows: https://redis.io/download');
    console.log('\x1b[33m%s\x1b[0m', '2. Start Redis:');
    console.log('   - macOS/Linux: redis-server');
    console.log('   - Windows: Start the Redis service');
    console.log('\x1b[33m%s\x1b[0m', '3. Alternative - Use Docker:');
    console.log('   docker run --name redis -p 6379:6379 -d redis');
    console.log('\x1b[33m%s\x1b[0m', '4. Alternative - Use Redis Cloud:');
    console.log('   - Sign up at https://redis.com/try-free/');
    console.log('   - Create a database');
    console.log('   - Update .env.local with your Redis URL and password');
    process.exit(1);
}, 2000);

// Handle connection events
redis.on('connect', () => {
    clearTimeout(timeout);
    console.log('\x1b[32m%s\x1b[0m', '✅ Redis is running locally');
    process.exit(0);
});

redis.on('error', (err) => {
    clearTimeout(timeout);
    console.error('\x1b[31m%s\x1b[0m', `❌ Redis connection error: ${err.message}`);
    console.log('\nTo use Redis locally:');
    console.log('\x1b[33m%s\x1b[0m', '1. Install Redis:');
    console.log('   - macOS: brew install redis');
    console.log('   - Linux: sudo apt install redis-server');
    console.log('   - Windows: https://redis.io/download');
    console.log('\x1b[33m%s\x1b[0m', '2. Start Redis:');
    console.log('   - macOS/Linux: redis-server');
    console.log('   - Windows: Start the Redis service');
    console.log('\x1b[33m%s\x1b[0m', '3. Alternative - Use Docker:');
    console.log('   docker run --name redis -p 6379:6379 -d redis');
    console.log('\x1b[33m%s\x1b[0m', '4. Alternative - Use Redis Cloud:');
    console.log('   - Sign up at https://redis.com/try-free/');
    console.log('   - Create a database');
    console.log('   - Update .env.local with your Redis URL and password');
    process.exit(1);
});