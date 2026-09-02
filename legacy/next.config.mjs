/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [{ source: '/(student|helper|admin)(.*)', headers: [{ key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, private' }, { key: 'Pragma', value: 'no-cache' }, { key: 'Expires', value: '0' }] }]
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
