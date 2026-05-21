const isGithubPages = process.env.GITHUB_PAGES === "true";

const nextConfig = {
  output: "export",
  images: {
    unoptimized: true
  },
  basePath: isGithubPages ? "/ghost-alpha" : undefined,
  assetPrefix: isGithubPages ? "/ghost-alpha/" : undefined,
  trailingSlash: true
};

export default nextConfig;
