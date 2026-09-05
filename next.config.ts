import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["*"],
  // ★ التدقيق النهائي: ignoreBuildErrors أُزيل — كل أخطاء TypeScript صُلحت
  // والبناء يفشل الآن على أي خطأ نوع جديد (بوابة جودة صارمة)
  reactStrictMode: false,
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
  // 🔑 السماح بعرض صور Cloudinary عبر Next/Image
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
