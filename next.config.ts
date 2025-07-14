/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development', // Only enable PWA in production
});

const nextConfig = withPWA({
  reactStrictMode: true,
});

module.exports = nextConfig;
