declare module './blog-routes.js' {
  export function getBlogRoutes(): string[];
}

declare module './blog-sitemap.js' {
  export function getSitemapLastmod(): Record<string, Date>;
}
