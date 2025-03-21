/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        remotePatterns: [{
            protocol: 'https',
            hostname: 'pemndyzhgrsilquongzm.supabase.co',
            pathname: '/storage/v1/object/public/**',
        }, ],
    },
    serverExternalPackages: ["@node-rs/argon2", "@node-rs/bcrypt"],
};

module.exports = nextConfig;