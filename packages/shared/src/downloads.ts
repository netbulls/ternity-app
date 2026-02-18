import { z } from 'zod';

export const DownloadArtifactSchema = z.object({
  id: z.string(),
  filename: z.string(),
  version: z.string(),
  platform: z.enum(['darwin', 'windows', 'linux']),
  arch: z.string(),
  size: z.number(),
  checksum: z.string(),
  uploadedAt: z.string(),
  downloadUrl: z.string(),
  label: z.string(),
  description: z.string(),
});

export type DownloadArtifact = z.infer<typeof DownloadArtifactSchema>;

export const DownloadsResponseSchema = z.object({
  version: z.string(),
  releaseDate: z.string(),
  artifacts: z.array(DownloadArtifactSchema),
});

export type DownloadsResponse = z.infer<typeof DownloadsResponseSchema>;
