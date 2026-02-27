/**
 * Database module — PostgreSQL connection pool and auto-migration.
 */

import pg from 'pg'

const { Pool } = pg

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

/**
 * Auto-create tables on startup if they don't exist.
 */
export async function initDB(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL DEFAULT 'Untitled',
      bpm         INTEGER NOT NULL DEFAULT 120,
      time_sig_n  INTEGER NOT NULL DEFAULT 4,
      time_sig_d  INTEGER NOT NULL DEFAULT 4,
      sample_rate INTEGER NOT NULL DEFAULT 44100,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS tracks (
      id         TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name       TEXT NOT NULL DEFAULT 'Track',
      type       TEXT NOT NULL DEFAULT 'midi',
      color      TEXT NOT NULL DEFAULT '#1a3f7a',
      volume     REAL NOT NULL DEFAULT 0.8,
      pan        REAL NOT NULL DEFAULT 0,
      muted      BOOLEAN NOT NULL DEFAULT FALSE,
      solo       BOOLEAN NOT NULL DEFAULT FALSE,
      armed      BOOLEAN NOT NULL DEFAULT FALSE,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS clips (
      id             TEXT PRIMARY KEY,
      track_id       TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
      name           TEXT NOT NULL DEFAULT 'Clip',
      start_beat     REAL NOT NULL DEFAULT 0,
      duration_beats REAL NOT NULL DEFAULT 4,
      color          TEXT,
      audio_url      TEXT
    );

    CREATE TABLE IF NOT EXISTS notes (
      id             TEXT PRIMARY KEY,
      clip_id        TEXT NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
      pitch          INTEGER NOT NULL,
      start_beat     REAL NOT NULL,
      duration_beats REAL NOT NULL,
      velocity       INTEGER NOT NULL DEFAULT 100
    );

    CREATE INDEX IF NOT EXISTS idx_tracks_project ON tracks(project_id);
    CREATE INDEX IF NOT EXISTS idx_clips_track ON clips(track_id);
    CREATE INDEX IF NOT EXISTS idx_notes_clip ON notes(clip_id);

    -- ── Library tables ──────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS audio_files (
      id          TEXT PRIMARY KEY,
      filename    TEXT NOT NULL,
      mime_type   TEXT NOT NULL DEFAULT 'audio/wav',
      size_bytes  INTEGER NOT NULL DEFAULT 0,
      duration_secs REAL,
      sample_rate INTEGER DEFAULT 44100,
      data        BYTEA NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS library_clips (
      id             TEXT PRIMARY KEY,
      name           TEXT NOT NULL,
      category       TEXT NOT NULL DEFAULT 'uncategorized',
      clip_type      TEXT NOT NULL DEFAULT 'midi',
      duration_beats REAL NOT NULL DEFAULT 4,
      bpm            INTEGER NOT NULL DEFAULT 120,
      color          TEXT,
      audio_file_id  TEXT REFERENCES audio_files(id) ON DELETE SET NULL,
      tags           TEXT,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS library_notes (
      id             TEXT PRIMARY KEY,
      clip_id        TEXT NOT NULL REFERENCES library_clips(id) ON DELETE CASCADE,
      pitch          INTEGER NOT NULL,
      start_beat     REAL NOT NULL,
      duration_beats REAL NOT NULL,
      velocity       INTEGER NOT NULL DEFAULT 100
    );

    CREATE INDEX IF NOT EXISTS idx_library_notes_clip ON library_notes(clip_id);
    CREATE INDEX IF NOT EXISTS idx_library_clips_category ON library_clips(category);
  `)

  // ── Migrations for existing databases ──────────────────────────────────────
  // Add audio_url column to clips if it doesn't exist (safe to run repeatedly)
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE clips ADD COLUMN audio_url TEXT;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$;
  `)
}

/**
 * Load a full project tree: project → tracks → clips → notes.
 */
export async function loadProjectTree(projectId: string) {
  const projRes = await pool.query('SELECT * FROM projects WHERE id = $1', [projectId])
  if (projRes.rows.length === 0) return null

  const proj = projRes.rows[0]

  const tracksRes = await pool.query(
    'SELECT * FROM tracks WHERE project_id = $1 ORDER BY sort_order',
    [projectId]
  )

  const tracks = []
  for (const track of tracksRes.rows) {
    const clipsRes = await pool.query(
      'SELECT * FROM clips WHERE track_id = $1 ORDER BY start_beat',
      [track.id]
    )

    const clips = []
    for (const clip of clipsRes.rows) {
      const notesRes = await pool.query(
        'SELECT * FROM notes WHERE clip_id = $1 ORDER BY start_beat',
        [clip.id]
      )

      clips.push({
        id: clip.id,
        trackId: clip.track_id,
        name: clip.name,
        startBeat: clip.start_beat,
        durationBeats: clip.duration_beats,
        color: clip.color || undefined,
        audioUrl: clip.audio_url || undefined,
        notes: notesRes.rows.map((n: Record<string, unknown>) => ({
          id: n.id,
          pitch: n.pitch,
          startBeat: n.start_beat,
          durationBeats: n.duration_beats,
          velocity: n.velocity,
        })),
      })
    }

    tracks.push({
      id: track.id,
      name: track.name,
      type: track.type,
      color: track.color,
      volume: track.volume,
      pan: track.pan,
      muted: track.muted,
      solo: track.solo,
      armed: track.armed,
      clips,
    })
  }

  return {
    id: proj.id,
    name: proj.name,
    bpm: proj.bpm,
    timeSignature: [proj.time_sig_n, proj.time_sig_d],
    sampleRate: proj.sample_rate,
    tracks,
    createdAt: proj.created_at,
    updatedAt: proj.updated_at,
  }
}

/**
 * Save a full project tree (replace strategy).
 * Deletes existing children and re-inserts from the incoming state.
 */
// ─── Library CRUD ───────────────────────────────────────────────────────────

export async function loadLibraryClips(category?: string, search?: string) {
  let query = 'SELECT * FROM library_clips'
  const conditions: string[] = []
  const params: unknown[] = []

  if (category) {
    params.push(category)
    conditions.push(`category = $${params.length}`)
  }
  if (search) {
    params.push(`%${search}%`)
    conditions.push(`(name ILIKE $${params.length} OR tags ILIKE $${params.length})`)
  }

  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ')
  query += ' ORDER BY created_at DESC'

  const res = await pool.query(query, params)

  // Fetch notes for all clips in one query
  const clipIds = res.rows.map((r: Record<string, unknown>) => r.id)
  let notesByClip = new Map<string, Array<{ id: string; pitch: number; startBeat: number; durationBeats: number; velocity: number }>>()

  if (clipIds.length > 0) {
    const notesRes = await pool.query(
      'SELECT * FROM library_notes WHERE clip_id = ANY($1) ORDER BY start_beat',
      [clipIds]
    )
    for (const n of notesRes.rows) {
      const arr = notesByClip.get(n.clip_id) ?? []
      arr.push({ id: n.id, pitch: n.pitch, startBeat: n.start_beat, durationBeats: n.duration_beats, velocity: n.velocity })
      notesByClip.set(n.clip_id, arr)
    }
  }

  return res.rows.map((r: Record<string, unknown>) => {
    const notes = notesByClip.get(r.id as string) ?? []
    return {
      id: r.id,
      name: r.name,
      category: r.category,
      clipType: r.clip_type,
      durationBeats: r.duration_beats,
      bpm: r.bpm,
      color: r.color || undefined,
      audioFileId: r.audio_file_id || undefined,
      tags: r.tags || undefined,
      noteCount: notes.length,
      notes,
      createdAt: r.created_at,
    }
  })
}

export async function loadLibraryClip(id: string) {
  const clipRes = await pool.query('SELECT * FROM library_clips WHERE id = $1', [id])
  if (clipRes.rows.length === 0) return null
  const r = clipRes.rows[0]

  const notesRes = await pool.query(
    'SELECT * FROM library_notes WHERE clip_id = $1 ORDER BY start_beat',
    [id]
  )

  return {
    id: r.id,
    name: r.name,
    category: r.category,
    clipType: r.clip_type,
    durationBeats: r.duration_beats,
    bpm: r.bpm,
    color: r.color || undefined,
    audioFileId: r.audio_file_id || undefined,
    tags: r.tags || undefined,
    createdAt: r.created_at,
    notes: notesRes.rows.map((n: Record<string, unknown>) => ({
      id: n.id,
      pitch: n.pitch,
      startBeat: n.start_beat,
      durationBeats: n.duration_beats,
      velocity: n.velocity,
    })),
  }
}

export async function saveLibraryClip(clip: {
  id: string
  name: string
  category: string
  clipType: string
  durationBeats: number
  bpm: number
  color?: string
  audioFileId?: string
  tags?: string
  notes?: Array<{
    id: string
    pitch: number
    startBeat: number
    durationBeats: number
    velocity: number
  }>
}) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    await client.query(
      `INSERT INTO library_clips (id, name, category, clip_type, duration_beats, bpm, color, audio_file_id, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name, category = EXCLUDED.category,
         clip_type = EXCLUDED.clip_type, duration_beats = EXCLUDED.duration_beats,
         bpm = EXCLUDED.bpm, color = EXCLUDED.color,
         audio_file_id = EXCLUDED.audio_file_id, tags = EXCLUDED.tags`,
      [clip.id, clip.name, clip.category, clip.clipType, clip.durationBeats, clip.bpm, clip.color || null, clip.audioFileId || null, clip.tags || null]
    )

    // Replace notes
    await client.query('DELETE FROM library_notes WHERE clip_id = $1', [clip.id])
    if (clip.notes) {
      for (const note of clip.notes) {
        await client.query(
          `INSERT INTO library_notes (id, clip_id, pitch, start_beat, duration_beats, velocity)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [note.id, clip.id, note.pitch, note.startBeat, note.durationBeats, note.velocity]
        )
      }
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

export async function deleteLibraryClip(id: string): Promise<boolean> {
  const res = await pool.query('DELETE FROM library_clips WHERE id = $1', [id])
  return (res.rowCount ?? 0) > 0
}

export async function saveAudioFile(file: {
  id: string
  filename: string
  mimeType: string
  sizeBytes: number
  durationSecs?: number
  sampleRate?: number
  data: Buffer
}) {
  await pool.query(
    `INSERT INTO audio_files (id, filename, mime_type, size_bytes, duration_secs, sample_rate, data)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [file.id, file.filename, file.mimeType, file.sizeBytes, file.durationSecs ?? null, file.sampleRate ?? 44100, file.data]
  )
}

export async function listAudioFiles() {
  const res = await pool.query(
    'SELECT id, filename, mime_type, size_bytes, duration_secs, sample_rate, created_at FROM audio_files ORDER BY created_at DESC'
  )
  return res.rows.map((r: Record<string, unknown>) => ({
    id: r.id,
    filename: r.filename,
    mimeType: r.mime_type,
    sizeBytes: r.size_bytes,
    durationSecs: r.duration_secs,
    sampleRate: r.sample_rate,
    createdAt: r.created_at,
  }))
}

export async function loadAudioFile(id: string) {
  const res = await pool.query('SELECT * FROM audio_files WHERE id = $1', [id])
  if (res.rows.length === 0) return null
  const r = res.rows[0]
  return {
    id: r.id,
    filename: r.filename,
    mimeType: r.mime_type,
    sizeBytes: r.size_bytes,
    durationSecs: r.duration_secs,
    sampleRate: r.sample_rate,
    data: r.data as Buffer,
    createdAt: r.created_at,
  }
}

// ─── Project persistence ─────────────────────────────────────────────────────

export async function saveProjectTree(project: {
  id: string
  name: string
  bpm: number
  timeSignature: [number, number]
  sampleRate: number
  tracks: Array<{
    id: string
    name: string
    type: string
    color: string
    volume: number
    pan: number
    muted: boolean
    solo: boolean
    armed: boolean
    clips: Array<{
      id: string
      trackId: string
      name: string
      startBeat: number
      durationBeats: number
      color?: string
      audioUrl?: string
      notes?: Array<{
        id: string
        pitch: number
        startBeat: number
        durationBeats: number
        velocity: number
      }>
    }>
  }>
}) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Upsert project
    await client.query(
      `INSERT INTO projects (id, name, bpm, time_sig_n, time_sig_d, sample_rate, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         bpm = EXCLUDED.bpm,
         time_sig_n = EXCLUDED.time_sig_n,
         time_sig_d = EXCLUDED.time_sig_d,
         sample_rate = EXCLUDED.sample_rate,
         updated_at = NOW()`,
      [project.id, project.name, project.bpm, project.timeSignature[0], project.timeSignature[1], project.sampleRate]
    )

    // Delete existing children (cascade handles clips → notes)
    await client.query('DELETE FROM tracks WHERE project_id = $1', [project.id])

    // Insert tracks, clips, notes
    for (let i = 0; i < project.tracks.length; i++) {
      const track = project.tracks[i]
      await client.query(
        `INSERT INTO tracks (id, project_id, name, type, color, volume, pan, muted, solo, armed, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [track.id, project.id, track.name, track.type, track.color, track.volume, track.pan, track.muted, track.solo, track.armed, i]
      )

      for (const clip of track.clips) {
        await client.query(
          `INSERT INTO clips (id, track_id, name, start_beat, duration_beats, color, audio_url)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [clip.id, track.id, clip.name, clip.startBeat, clip.durationBeats, clip.color || null, clip.audioUrl || null]
        )

        if (clip.notes) {
          for (const note of clip.notes) {
            await client.query(
              `INSERT INTO notes (id, clip_id, pitch, start_beat, duration_beats, velocity)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [note.id, clip.id, note.pitch, note.startBeat, note.durationBeats, note.velocity]
            )
          }
        }
      }
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
