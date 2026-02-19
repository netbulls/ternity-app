import { z } from 'zod';

export const DownloadArtifactSchema = z.object({
  id: z.string(),
  filename: z.string(),
  framework: z.string(),
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

export const ReleaseNoteSchema = z.object({
  category: z.string(),
  entries: z.array(z.string()),
});

export type ReleaseNote = z.infer<typeof ReleaseNoteSchema>;

export const DownloadChannelSchema = z.object({
  channel: z.enum(['release', 'snapshot']),
  version: z.string(),
  releaseDate: z.string().nullable(),
  releaseNotes: z.array(ReleaseNoteSchema),
  artifacts: z.array(DownloadArtifactSchema),
});

export type DownloadChannel = z.infer<typeof DownloadChannelSchema>;

export const DownloadProductSchema = z.object({
  framework: z.string(),
  name: z.string(),
  description: z.string(),
  channels: z.array(DownloadChannelSchema),
});

export type DownloadProduct = z.infer<typeof DownloadProductSchema>;

export const DownloadsResponseSchema = z.object({
  products: z.array(DownloadProductSchema),
});

export type DownloadsResponse = z.infer<typeof DownloadsResponseSchema>;
