/**
 * LLM-DAW API — Fastify server with project persistence and AI analysis.
 */

import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import Anthropic from '@anthropic-ai/sdk'
import multipart from '@fastify/multipart'
import { initDB, pool, loadProjectTree, saveProjectTree, loadLibraryClips, loadLibraryClip, saveLibraryClip, deleteLibraryClip, listAudioFiles, saveAudioFile, loadAudioFile } from './db.js'

const PORT = parseInt(process.env.PORT ?? '4000')
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173'

// ─── Anthropic client ────────────────────────────────────────────────────────

const anthropic = new Anthropic()

// ─── Types ───────────────────────────────────────────────────────────────────

interface NoteData {
  pitch: number
  startBeat: number
  durationBeats: number
  velocity: number
}

interface AnalyzeRequest {
  notes: NoteData[]
  bpm: number
  prompt: string
  targetInstrument?: string
}

interface GenerateRequest {
  seedNotes: NoteData[]
  bpm: number
  type: 'continuation' | 'harmony' | 'chord-progression' | 'variation'
  bars: number
  key?: string
  scale?: string
  style?: string
}

// ─── JSON extraction helper ─────────────────────────────────────────────────
// Claude sometimes wraps JSON in ```json ... ``` code blocks despite instructions.

function extractJSON(text: string): string {
  // Try markdown code block first
  const codeBlock = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (codeBlock?.[1]) return codeBlock[1].trim()

  // Try to find raw JSON object or array
  const obj = text.match(/(\{[\s\S]*\})/)
  if (obj?.[1]) return obj[1].trim()

  const arr = text.match(/(\[[\s\S]*\])/)
  if (arr?.[1]) return arr[1].trim()

  return text.trim()
}

// ─── Note name helpers ───────────────────────────────────────────────────────

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

function midiToName(midi: number): string {
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`
}

function notesToDescription(notes: NoteData[], bpm: number): string {
  const sorted = [...notes].sort((a, b) => a.startBeat - b.startBeat)
  const lines = sorted.map((n) => {
    const name = midiToName(n.pitch)
    const startBar = Math.floor(n.startBeat / 4) + 1
    const beatInBar = (n.startBeat % 4) + 1
    return `  ${name} at bar ${startBar} beat ${beatInBar.toFixed(2)}, duration ${n.durationBeats.toFixed(2)} beats, velocity ${n.velocity}`
  })

  const pitches = sorted.map((n) => n.pitch)
  const uniquePitchNames = [...new Set(sorted.map((n) => NOTE_NAMES[n.pitch % 12]))]

  return [
    `BPM: ${bpm}`,
    `Total notes: ${notes.length}`,
    `Pitch range: ${midiToName(Math.min(...pitches))} to ${midiToName(Math.max(...pitches))}`,
    `Unique pitch classes: ${uniquePitchNames.join(', ')}`,
    `Duration: ${Math.ceil(Math.max(...sorted.map((n) => n.startBeat + n.durationBeats)))} beats`,
    '',
    'Notes (chronological):',
    ...lines,
  ].join('\n')
}

// ─── System prompts ──────────────────────────────────────────────────────────

const ANALYZE_SYSTEM = `You are a music theory expert and composition assistant integrated into a browser-based DAW (Digital Audio Workstation). Users play MIDI notes on their keyboard and send them to you for analysis.

Your job is to:
1. Identify the key and scale of the played notes
2. Describe the musical pattern (melody shape, rhythm, style)
3. Based on the user's prompt, generate musical suggestions

ALWAYS respond with valid JSON in this exact format:
{
  "analysis": {
    "key": "C",
    "scale": "minor",
    "tempo": 120,
    "pattern": "A descending melodic phrase with syncopated rhythm, reminiscent of a jazz motif",
    "notesSummary": "8 notes spanning C3 to G4, primarily stepwise motion"
  },
  "suggestions": [
    {
      "id": "sug-1",
      "name": "Melodic Continuation",
      "description": "Continues the phrase upward with a call-and-response pattern",
      "type": "continuation",
      "notes": [
        { "pitch": 60, "startBeat": 0, "durationBeats": 1, "velocity": 90 }
      ],
      "durationBeats": 8
    }
  ]
}

Rules for generating notes:
- pitch: MIDI note number (60 = C4, 69 = A4, etc.)
- startBeat: position relative to the START of the suggestion clip (starts at 0)
- durationBeats: how long the note sounds
- velocity: 0-127
- Generate 2-4 suggestions of different types
- Keep suggestions musically coherent with the input
- Each suggestion should be 4-8 bars (16-32 beats at 4/4)
- Make suggestions that a musician would actually want to use
- Be creative but respect the musical style implied by the input`

const GENERATE_SYSTEM = `You are a music composition AI. Given seed notes and a generation type, produce MIDI note data.

Respond ONLY with valid JSON array of note objects:
[
  { "pitch": 60, "startBeat": 0, "durationBeats": 1, "velocity": 90 }
]

Rules:
- pitch: MIDI note number (60 = C4)
- startBeat: relative to clip start (begins at 0)
- durationBeats: note length
- velocity: 0-127
- Stay in key with the seed notes
- Generate musically interesting, playable parts`

// ─── Server setup ────────────────────────────────────────────────────────────

const app = Fastify({
  logger: true,
  bodyLimit: 1024 * 1024 * 1024, // 1GB — matches multipart limit
})

await app.register(cors, {
  origin: CORS_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
})

await app.register(multipart, {
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB
})

// ── Health check ─────────────────────────────────────────────────────────────

app.get('/api/health', async () => ({ status: 'ok', service: 'llm-daw-api' }))

// ── Project CRUD ─────────────────────────────────────────────────────────────

// List all projects (metadata only, no nested children)
app.get('/api/projects', async () => {
  const res = await pool.query(
    'SELECT id, name, bpm, time_sig_n, time_sig_d, created_at, updated_at FROM projects ORDER BY updated_at DESC'
  )
  return res.rows.map((r: Record<string, unknown>) => ({
    id: r.id,
    name: r.name,
    bpm: r.bpm,
    timeSignature: [r.time_sig_n, r.time_sig_d],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }))
})

// Get single project (full tree)
app.get<{ Params: { id: string } }>('/api/projects/:id', async (request, reply) => {
  const project = await loadProjectTree(request.params.id)
  if (!project) return reply.status(404).send({ error: 'Project not found' })
  return project
})

// Create project
app.post<{ Body: { name: string; bpm?: number } }>('/api/projects', async (request) => {
  const { name, bpm = 120 } = request.body
  const id = crypto.randomUUID()
  await pool.query(
    'INSERT INTO projects (id, name, bpm) VALUES ($1, $2, $3)',
    [id, name, bpm]
  )
  return {
    id,
    name,
    bpm,
    timeSignature: [4, 4],
    sampleRate: 44100,
    tracks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
})

// Full save (upsert project + all children)
app.put<{ Params: { id: string }; Body: Record<string, unknown> }>('/api/projects/:id', async (request, reply) => {
  const body = request.body as {
    id?: string
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
        notes?: Array<{
          id: string
          pitch: number
          startBeat: number
          durationBeats: number
          velocity: number
        }>
      }>
    }>
  }

  try {
    await saveProjectTree({ ...body, id: request.params.id })
    return { ok: true }
  } catch (err) {
    request.log.error({ err }, 'Failed to save project')
    return reply.status(500).send({ error: 'Failed to save project' })
  }
})

// Delete project (cascades to tracks → clips → notes)
app.delete<{ Params: { id: string } }>('/api/projects/:id', async (request, reply) => {
  const res = await pool.query('DELETE FROM projects WHERE id = $1', [request.params.id])
  if (res.rowCount === 0) return reply.status(404).send({ error: 'Project not found' })
  return { ok: true }
})

// ── Library CRUD ─────────────────────────────────────────────────────────────

// List library clips
app.get<{ Querystring: { category?: string; search?: string } }>('/api/library/clips', async (request) => {
  const { category, search } = request.query
  return loadLibraryClips(category, search)
})

// Get library clip with notes
app.get<{ Params: { id: string } }>('/api/library/clips/:id', async (request, reply) => {
  const clip = await loadLibraryClip(request.params.id)
  if (!clip) return reply.status(404).send({ error: 'Clip not found' })
  return clip
})

// Save clip to library
app.post<{ Body: {
  id: string; name: string; category: string; clipType: string
  durationBeats: number; bpm: number; color?: string
  audioFileId?: string; tags?: string
  notes?: Array<{ id: string; pitch: number; startBeat: number; durationBeats: number; velocity: number }>
} }>('/api/library/clips', async (request, reply) => {
  try {
    await saveLibraryClip(request.body)
    return { ok: true, id: request.body.id }
  } catch (err) {
    request.log.error({ err }, 'Failed to save library clip')
    return reply.status(500).send({ error: 'Failed to save library clip' })
  }
})

// Delete library clip
app.delete<{ Params: { id: string } }>('/api/library/clips/:id', async (request, reply) => {
  const deleted = await deleteLibraryClip(request.params.id)
  if (!deleted) return reply.status(404).send({ error: 'Clip not found' })
  return { ok: true }
})

// ── Audio upload + streaming ────────────────────────────────────────────────

// List all uploaded audio files (metadata only, no binary data)
app.get('/api/audio', async () => {
  return listAudioFiles()
})

// Upload audio file
app.post('/api/upload/audio', async (request, reply) => {
  const data = await request.file()
  if (!data) return reply.status(400).send({ error: 'No file provided' })

  const buffer = await data.toBuffer()
  const id = crypto.randomUUID()
  const filename = data.filename
  const mimeType = data.mimetype

  await saveAudioFile({
    id,
    filename,
    mimeType,
    sizeBytes: buffer.length,
    data: buffer,
  })

  return { id, filename, mimeType, sizeBytes: buffer.length }
})

// Stream audio file
app.get<{ Params: { id: string } }>('/api/audio/:id', async (request, reply) => {
  const file = await loadAudioFile(request.params.id)
  if (!file) return reply.status(404).send({ error: 'Audio file not found' })

  return reply
    .header('Content-Type', file.mimeType)
    .header('Content-Length', file.sizeBytes)
    .header('Cache-Control', 'public, max-age=31536000')
    .send(file.data)
})

// ── Analyze endpoint ─────────────────────────────────────────────────────────

app.post<{ Body: AnalyzeRequest }>('/api/ai/analyze', async (request, reply) => {
  const { notes, bpm, prompt, targetInstrument } = request.body

  if (!notes?.length) {
    return reply.status(400).send({ error: 'No notes provided' })
  }

  const description = notesToDescription(notes, bpm)

  // Build instrument context for the AI
  let instrumentCtx = ''
  if (targetInstrument) {
    const lower = targetInstrument.toLowerCase()
    if (lower.includes('drum') || lower.includes('kick') || lower.includes('snare') || lower.includes('hi-hat')) {
      instrumentCtx = `\n\nTarget instrument: drums. Generate notes appropriate for drums using standard GM drum mapping: kick=36, snare=38, closed hi-hat=42, open hi-hat=46, crash=49, ride=51, low tom=45, mid tom=47, high tom=50. Keep patterns on these specific MIDI pitches.`
    } else if (lower.includes('bass')) {
      instrumentCtx = `\n\nTarget instrument: bass. Generate notes in the bass range (MIDI 28-55, i.e. E1 to G3). Use patterns appropriate for bass lines.`
    } else if (lower.includes('pad')) {
      instrumentCtx = `\n\nTarget instrument: pad/synth pad. Generate sustained chords with long durations (2-4 beats). Use the mid range (MIDI 48-72).`
    } else if (lower.includes('lead')) {
      instrumentCtx = `\n\nTarget instrument: lead synth. Generate melodic single-note lines in the mid-high range (MIDI 60-84).`
    } else if (lower.includes('bell') || lower.includes('chime')) {
      instrumentCtx = `\n\nTarget instrument: bells/chimes. Generate sparse, high-register accent notes (MIDI 72-96) with shorter durations.`
    } else if (lower.includes('pluck') || lower.includes('guitar') || lower.includes('harp')) {
      instrumentCtx = `\n\nTarget instrument: plucked strings. Generate arpeggiated patterns or fingerpicked figures in the mid range (MIDI 48-76).`
    } else if (lower.includes('piano') || lower.includes('keys')) {
      instrumentCtx = `\n\nTarget instrument: piano/keys. Generate chord voicings or melodic patterns across a wide range (MIDI 36-84).`
    }
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: ANALYZE_SYSTEM,
      messages: [
        {
          role: 'user',
          content: `Here are the MIDI notes I played:\n\n${description}\n\nMy request: ${prompt || 'Analyze these notes and suggest harmonies, continuations, and variations.'}${instrumentCtx}`,
        },
      ],
    })

    const text = message.content[0]?.type === 'text' ? message.content[0].text : ''
    const result = JSON.parse(extractJSON(text))

    return {
      ...result,
      metadata: {
        model: message.model,
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
      },
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    request.log.error({ err }, 'Claude API error')
    return reply.status(500).send({ error: 'AI analysis failed', message })
  }
})

// ── Generate endpoint ────────────────────────────────────────────────────────

app.post<{ Body: GenerateRequest }>('/api/ai/generate', async (request, reply) => {
  const { seedNotes, bpm, type, bars = 4, key, scale, style } = request.body

  const description = notesToDescription(seedNotes, bpm)

  const prompt = [
    `Generate a ${type} part based on these seed notes:`,
    '',
    description,
    '',
    `Requirements:`,
    `- Type: ${type}`,
    `- Length: ${bars} bars (${bars * 4} beats)`,
    key ? `- Key: ${key}` : null,
    scale ? `- Scale: ${scale}` : null,
    style ? `- Style: ${style}` : null,
  ].filter(Boolean).join('\n')

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: GENERATE_SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0]?.type === 'text' ? message.content[0].text : '[]'
    const notes = JSON.parse(extractJSON(text))

    return {
      notes,
      durationBeats: bars * 4,
      metadata: { model: message.model },
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    request.log.error({ err }, 'Claude API error')
    return reply.status(500).send({ error: 'AI generation failed', message })
  }
})

// ── Start ────────────────────────────────────────────────────────────────────

try {
  await initDB()
  console.log('Database initialized')
  await app.listen({ port: PORT, host: '0.0.0.0' })
  console.log(`LLM-DAW API running on http://localhost:${PORT}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
