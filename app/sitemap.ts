import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://nexus-status-grid.vercel.app',
      lastModified: new Date(),
      changeFrequency: 'always',
      priority: 1,
    },
  ];
}
