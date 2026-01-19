/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Enable WebAssembly support
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true
    };
    
    // Don't run workers on server-side
    if (!isServer) {
      config.output.globalObject = 'self';
    }
    
    return config;
  }
};

module.exports = nextConfig;
