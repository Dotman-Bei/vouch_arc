/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { serverActions: { allowedOrigins: ["localhost:3000"] } },
  webpack: (config) => {
    // wagmi/RainbowKit pull in @metamask/sdk + WalletConnect, which reference
    // optional React-Native / Node-only modules that don't exist in a web
    // build. Stub them so the bundle doesn't emit "module not found" warnings.
    config.externals.push("pino-pretty", "lokijs", "encoding");
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "@react-native-async-storage/async-storage": false,
    };
    // viem's `ox` dependency uses a dynamic require webpack can't analyze
    // statically — harmless, just noisy.
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      { message: /Critical dependency: the request of a dependency is an expression/ },
    ];
    return config;
  },
};
export default nextConfig;
