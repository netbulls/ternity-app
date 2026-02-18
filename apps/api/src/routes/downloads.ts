import { FastifyInstance } from 'fastify';
import { createHmac } from 'node:crypto';

/** Platform+arch → human-readable label and description */
const ARTIFACT_META: Record<string, { label: string; description: string }> = {
  'darwin:arm64': { label: 'macOS — Apple Silicon', description: 'M1, M2, M3, M4 · .dmg installer' },
  'darwin:x64': { label: 'macOS — Intel', description: 'x86_64 · .dmg installer' },
  'windows:x64': { label: 'Windows — 64-bit (x64)', description: 'Most Windows PCs · .exe installer' },
  'windows:arm64': { label: 'Windows — ARM64', description: 'Surface Pro X, Snapdragon laptops · .exe installer' },
  'linux:x64:AppImage': { label: 'Linux — AppImage (x64)', description: 'Universal — runs on any distro' },
  'linux:x64:deb': { label: 'Linux — .deb (x64)', description: 'Ubuntu, Debian' },
};

function deriveLabel(platform: string, arch: string, filename: string): { label: string; description: string } {
  // Try filename-based match for Linux (AppImage vs deb)
  if (platform === 'linux') {
    if (filename.endsWith('.AppImage')) {
      return ARTIFACT_META[`linux:${arch}:AppImage`] ?? { label: `Linux — ${arch}`, description: filename };
    }
    if (filename.endsWith('.deb')) {
      return ARTIFACT_META[`linux:${arch}:deb`] ?? { label: `Linux — .deb (${arch})`, description: filename };
    }
  }
  return ARTIFACT_META[`${platform}:${arch}`] ?? { label: `${platform} — ${arch}`, description: filename };
}

function signDownloadUrl(artifactId: string, publicBaseUrl: string, secret: string): string {
  const expires = Math.floor(Date.now() / 1000) + 3600; // 1 hour
  const message = `${artifactId}:${expires}`;
  const token = createHmac('sha256', secret).update(message).digest('hex');
  return `${publicBaseUrl}/download/${artifactId}?token=${token}&expires=${expires}`;
}

interface DriveArtifact {
  id: string;
  filename: string;
  version: string;
  platform: string;
  arch: string;
  size: number;
  checksum: string;
  uploadedAt: string;
}

interface DriveLatestEntry {
  platform: string;
  arch: string;
  artifact: DriveArtifact;
}

interface DriveLatestResponse {
  latest: DriveLatestEntry[];
}

export async function downloadsRoutes(fastify: FastifyInstance) {
  fastify.get('/api/downloads', async (_request, reply) => {
    const driveInternalUrl = process.env.DRIVE_INTERNAL_URL;
    const drivePublicUrl = process.env.DRIVE_PUBLIC_URL;
    const signedUrlSecret = process.env.SIGNED_URL_SECRET;

    if (!driveInternalUrl || !drivePublicUrl || !signedUrlSecret) {
      return reply.code(503).send({ error: 'Downloads not configured' });
    }

    let driveResponse: DriveLatestResponse;
    try {
      const res = await fetch(`${driveInternalUrl}/api/artifacts/latest`);
      if (!res.ok) {
        fastify.log.error(`Drive API returned ${res.status}: ${await res.text()}`);
        return reply.code(502).send({ error: 'Failed to fetch downloads' });
      }
      driveResponse = (await res.json()) as DriveLatestResponse;
    } catch (err) {
      fastify.log.error({ err }, 'Failed to reach Drive service');
      return reply.code(502).send({ error: 'Failed to fetch downloads' });
    }

    if (!driveResponse.latest || driveResponse.latest.length === 0) {
      return reply.send({ version: '', releaseDate: '', artifacts: [] });
    }

    // Use the first artifact's version and uploadedAt as the release info
    const firstArtifact = driveResponse.latest[0]!.artifact;

    const artifacts = driveResponse.latest.map((entry) => {
      const a = entry.artifact;
      const meta = deriveLabel(a.platform, a.arch, a.filename);
      return {
        id: a.id,
        filename: a.filename,
        version: a.version,
        platform: a.platform,
        arch: a.arch,
        size: a.size,
        checksum: a.checksum,
        uploadedAt: a.uploadedAt,
        downloadUrl: signDownloadUrl(a.id, drivePublicUrl, signedUrlSecret),
        label: meta.label,
        description: meta.description,
      };
    });

    return {
      version: firstArtifact.version,
      releaseDate: firstArtifact.uploadedAt,
      artifacts,
    };
  });
}
