/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        serverComponentsExternalPackages: ["grammy"],
    },
};

module.exports = nextConfig;