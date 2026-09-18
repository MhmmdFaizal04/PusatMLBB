import { sql } from './db';

export interface TutorialVideo {
  id: string;
  title: string;
  description: string | null;
  youtube_id: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const MAX_TITLE_LENGTH = 150;
export const MAX_DESCRIPTION_LENGTH = 600;

let tableInitialized = false;

/**
 * Creates the tutorial_videos table on first use.
 * `npm run migrate` never ALTERs pre-existing databases, so this keeps the
 * feature self-healing on deployments where the migration was not re-run.
 */
export async function ensureTutorialTable(): Promise<void> {
  if (tableInitialized) return;
  await sql`
    CREATE TABLE IF NOT EXISTS tutorial_videos (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      title VARCHAR(150) NOT NULL,
      description TEXT,
      youtube_id VARCHAR(20) NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_tutorial_videos_active
    ON tutorial_videos(is_active, sort_order)
  `;
  tableInitialized = true;
}

const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;

/**
 * Accepts a bare YouTube video id or any common YouTube URL shape and returns
 * the canonical 11-character video id. Returns null when nothing valid is found.
 *
 * Supported: youtu.be/ID, /watch?v=ID, /embed/ID, /shorts/ID, /live/ID, /v/ID
 */
export function parseYouTubeId(input: string): string | null {
  const raw = String(input ?? '').trim();
  if (!raw) return null;

  // Already a bare video id
  if (YOUTUBE_ID_RE.test(raw)) return raw;

  let url: URL;
  try {
    url = new URL(raw.includes('://') ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  const isYouTube =
    host === 'youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'music.youtube.com' ||
    host === 'youtube-nocookie.com' ||
    host === 'youtu.be';
  if (!isYouTube) return null;

  const candidates: (string | null)[] = [];
  if (host === 'youtu.be') {
    candidates.push(url.pathname.slice(1).split('/')[0] ?? null);
  } else {
    candidates.push(url.searchParams.get('v'));
    const segments = url.pathname.split('/').filter(Boolean);
    const prefixes = ['embed', 'shorts', 'live', 'v'];
    if (segments.length >= 2 && prefixes.includes(segments[0]!.toLowerCase())) {
      candidates.push(segments[1]!);
    }
  }

  for (const candidate of candidates) {
    if (candidate && YOUTUBE_ID_RE.test(candidate)) return candidate;
  }
  return null;
}

/** Highest-quality thumbnail that is guaranteed to exist for every video. */
export function youtubeThumbnail(youtubeId: string): string {
  return `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;
}
