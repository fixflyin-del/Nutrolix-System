/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_PAYU_KEY: 'bbLKDj',
    NEXT_PUBLIC_STORE_NAME: 'Nutrolix',
    NEXT_PUBLIC_STORE_DOMAIN: 'nutrolix.in'
  },
  async rewrites() {
    return [
      { source: '/shop', destination: '/shop.html' },
      { source: '/food', destination: '/food.html' },
      { source: '/cart', destination: '/cart.html' },
      { source: '/orders', destination: '/orders.html' },
      { source: '/account', destination: '/account.html' },
      { source: '/admin', destination: '/admin.html' },
      { source: '/download', destination: '/download.html' }
    ];
  }
};

module.exports = nextConfig;
