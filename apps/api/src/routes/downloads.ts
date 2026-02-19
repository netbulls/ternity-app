import { FastifyInstance } from 'fastify';
import { createHmac } from 'node:crypto';

/** Platform+arch → human-readable label and description */
const ARTIFACT_META: Record<string, { label: string; description: string }> = {
  'darwin:arm64': { label: 'macOS — Apple Silicon', description: 'M1, M2, M3, M4 · .dmg installer' },
  'darwin:x64': { label: 'macOS — Intel', description: 'x86_64 · .dmg installer' },
  'darwin:universal': { label: 'macOS — Universal', description: 'Apple Silicon + Intel · .dmg installer' },
  'windows:x64': { label: 'Windows — 64-bit (x64)', description: 'Most Windows PCs · .exe installer' },
  'windows:arm64': { label: 'Windows — ARM64', description: 'Surface Pro X, Snapdragon laptops · .exe installer' },
  'linux:x64:AppImage': { label: 'Linux — AppImage (x64)', description: 'Universal — runs on any distro' },
  'linux:x64:deb': { label: 'Linux — .deb (x64)', description: 'Ubuntu, Debian' },
  'linux:arm64:AppImage': { label: 'Linux — AppImage (ARM64)', description: 'Raspberry Pi, ARM servers' },
  'linux:arm64:deb': { label: 'Linux — .deb (ARM64)', description: 'Ubuntu/Debian ARM' },
};

/** Framework metadata: name + description per framework */
const FRAMEWORK_META: Record<string, { name: string; description: string }> = {
  tauri: { name: 'Ternity Desktop', description: 'Lightweight native app built with Rust' },
  electron: { name: 'Ternity Desktop', description: 'Full-featured app with system tray and offline support' },
  flutter: { name: 'Ternity Desktop', description: 'Cross-platform native app' },
  unknown: { name: 'Ternity Desktop', description: 'Desktop app' },
};

/** Determine channel from version string: tagged (v1.2.3) = release, untagged (v1.2.3-N-gXXX) = snapshot */
function deriveChannel(version: string): 'release' | 'snapshot' {
  // Untagged versions from git describe have format: v1.2.3-5-gabc123f
  // Tagged versions are clean semver: v1.2.3, 1.2.3, 1.2.3-beta.1
  // The distinguishing pattern is: digits-g followed by hex (the git commit hash suffix)
  return /\d+-g[0-9a-f]+$/i.test(version) ? 'snapshot' : 'release';
}

/**
 * Parse framework from filename convention: Ternity-{Framework}-{version}-{arch}.{ext}
 * Falls back to 'unknown' for legacy filenames without a framework segment.
 */
function parseFramework(filename: string): string {
  const match = filename.match(/^Ternity-([A-Za-z]+)-\d/);
  if (match) {
    const fw = match[1]!.toLowerCase();
    if (fw in FRAMEWORK_META) return fw;
    return fw; // Unknown framework — still parse it
  }
  return 'unknown';
}

function deriveLabel(platform: string, arch: string, filename: string): { label: string; description: string } {
  // Try filename-based match for Linux (AppImage vs deb)
  if (platform === 'linux') {
    if (filename.endsWith('.AppImage')) {
      return ARTIFACT_META[`linux:${arch}:AppImage`] ?? { label: `Linux — AppImage (${arch})`, description: filename };
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
  framework?: string;
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
      return { products: [] };
    }

    // Enrich artifacts with labels, signed URLs, framework, and channel
    const enrichedArtifacts = driveResponse.latest.map((entry) => {
      const a = entry.artifact;
      const meta = deriveLabel(a.platform, a.arch, a.filename);
      const framework = a.framework ? a.framework.toLowerCase() : parseFramework(a.filename);
      const channel = deriveChannel(a.version);
      return {
        id: a.id,
        filename: a.filename,
        framework,
        channel,
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

    // Group by framework → channel
    const frameworkMap = new Map<string, Map<string, typeof enrichedArtifacts>>();
    for (const artifact of enrichedArtifacts) {
      let channelMap = frameworkMap.get(artifact.framework);
      if (!channelMap) {
        channelMap = new Map();
        frameworkMap.set(artifact.framework, channelMap);
      }
      const channelArtifacts = channelMap.get(artifact.channel) ?? [];
      channelArtifacts.push(artifact);
      channelMap.set(artifact.channel, channelArtifacts);
    }

    // Build products array with channels
    const products = [...frameworkMap.entries()].map(([framework, channelMap]) => {
      const meta = FRAMEWORK_META[framework] ?? FRAMEWORK_META.unknown!;

      const channels = [...channelMap.entries()].map(([channel, artifacts]) => {
        // Use latest artifact for version/releaseDate
        const latest = artifacts.reduce((a, b) =>
          new Date(b.uploadedAt) > new Date(a.uploadedAt) ? b : a,
        );
        // Strip channel from artifacts sent to client
        const clientArtifacts = artifacts.map(({ channel: _ch, ...rest }) => rest);
        return {
          channel: channel as 'release' | 'snapshot',
          version: latest.version,
          releaseDate: channel === 'release' ? latest.uploadedAt : null,
          releaseNotes: [], // Populated from CHANGELOG.md in future
          artifacts: clientArtifacts,
        };
      });

      // Sort: release before snapshot
      channels.sort((a, b) => (a.channel === 'release' ? -1 : 1) - (b.channel === 'release' ? -1 : 1));

      return {
        framework,
        name: meta.name,
        description: meta.description,
        channels,
      };
    });

    return { products };
  });
}
