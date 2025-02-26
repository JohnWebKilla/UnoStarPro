const Redis = require('ioredis');
const tls = require('tls');
require('dotenv').config({
    path: '.env.local'
});

console.log('Redis URL:', process.env.REDIS_URL);
console.log('Redis Password:', process.env.REDIS_PASSWORD ? '[REDACTED]' : 'Not set');
console.log('Node.js version:', process.version);
console.log('OpenSSL version:', tls.getCiphers().length > 0 ? 'Available' : 'Unknown');

// Try both secure and non-secure connections
const testConnections = async () => {
    const configs = [{
            name: 'Standard Redis URL with TLS',
            url: `redis://:${process.env.REDIS_PASSWORD}@${process.env.REDIS_URL}`,
            options: {
                tls: {
                    rejectUnauthorized: false,
                }
            }
        },
        {
            name: 'Secure Redis URL (rediss://)',
            url: `rediss://:${process.env.REDIS_PASSWORD}@${process.env.REDIS_URL.replace(/^(rediss?:\/\/)/, '')}`,
            options: {
                tls: {
                    rejectUnauthorized: false,
                }
            }
        },
        {
            name: 'Direct connection with TLS',
            options: {
                host: process.env.REDIS_URL.split(':')[0],
                port: parseInt(process.env.REDIS_URL.split(':')[1], 10),
                password: process.env.REDIS_PASSWORD,
                tls: {
                    rejectUnauthorized: false,
                }
            }
        },
        {
            name: 'Direct connection without TLS',
            options: {
                host: process.env.REDIS_URL.split(':')[0],
                port: parseInt(process.env.REDIS_URL.split(':')[1], 10),
                password: process.env.REDIS_PASSWORD,
            }
        }
    ];

    for (const config of configs) {
        console.log(`\nTrying connection: ${config.name}`);
        if (config.url) {
            console.log('URL:', config.url.replace(process.env.REDIS_PASSWORD, '[REDACTED]'));
        } else {
            console.log('Options:', JSON.stringify({
                ...config.options,
                password: '[REDACTED]'
            }, null, 2));
        }

        try {
            const redis = config.url ?
                new Redis(config.url, config.options) :
                new Redis(config.options);

            // Set a timeout for the connection attempt
            const connectionPromise = new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Connection timed out'));
                }, 5000);

                redis.on('connect', () => {
                    clearTimeout(timeout);
                    console.log('\x1b[32m%s\x1b[0m', '✅ Connected successfully!');
                    resolve(redis);
                });

                redis.on('error', (err) => {
                    clearTimeout(timeout);
                    reject(err);
                });
            });

            await connectionPromise;

            // Test basic operations
            console.log('Testing SET operation...');
            const setResult = await redis.set('test:key', 'Hello from test script');
            console.log('SET result:', setResult);

            console.log('Testing GET operation...');
            const getResult = await redis.get('test:key');
            console.log('GET result:', getResult);

            await redis.quit();
            console.log('\x1b[32m%s\x1b[0m', '✅ Connection test successful!');

            // If we get here, we've found a working configuration
            console.log('\n\x1b[32m%s\x1b[0m', '✅ SOLUTION FOUND!');
            console.log('Use this configuration in your application:');
            if (config.url) {
                console.log('URL format:', config.url.replace(process.env.REDIS_PASSWORD, '[PASSWORD]'));
            } else {
                console.log('Options format:', JSON.stringify({
                    ...config.options,
                    password: '[PASSWORD]'
                }, null, 2));
            }

            return true;
        } catch (err) {
            console.error('\x1b[31m%s\x1b[0m', `❌ Connection failed: ${err.message}`);
            console.error('Error details:', err);
        }
    }

    return false;
};

// Run the tests
testConnections()
    .then(success => {
        if (!success) {
            console.error('\n\x1b[31m%s\x1b[0m', '❌ All connection attempts failed');
            console.log('\nPossible solutions:');
            console.log('1. Check if the Redis server is running and accessible');
            console.log('2. Verify that the Redis URL and password are correct');
            console.log('3. Check if the Redis server requires a specific TLS/SSL configuration');
            console.log('4. Contact Redis Cloud support for assistance');
        }
        process.exit(success ? 0 : 1);
    })
    .catch(err => {
        console.error('Test error:', err);
        process.exit(1);
    });