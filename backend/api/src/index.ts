/**
 * LLM-DAW API — Minimal Fastify server that proxies MIDI analysis requests to Claude.
 */

import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import Anthropic from '@anthropic-ai/sdk'

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

const app = Fastify({ logger: true })

await app.register(cors, {
  origin: CORS_ORIGIN,
  methods: ['GET', 'POST', 'OPTIONS'],
})

// ── Health check ─────────────────────────────────────────────────────────────

app.get('/api/health', async () => ({ status: 'ok', service: 'llm-daw-api' }))

// ── Analyze endpoint ─────────────────────────────────────────────────────────

app.post<{ Body: AnalyzeRequest }>('/api/ai/analyze', async (request, reply) => {
  const { notes, bpm, prompt } = request.body

  if (!notes?.length) {
    return reply.status(400).send({ error: 'No notes provided' })
  }

  const description = notesToDescription(notes, bpm)

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: ANALYZE_SYSTEM,
      messages: [
        {
          role: 'user',
          content: `Here are the MIDI notes I played:\n\n${description}\n\nMy request: ${prompt || 'Analyze these notes and suggest harmonies, continuations, and variations.'}`,
        },
      ],
    })

    const text = message.content[0]?.type === 'text' ? message.content[0].text : ''

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, text]
    const jsonStr = (jsonMatch[1] ?? text).trim()

    const result = JSON.parse(jsonStr)

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
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, text]
    const jsonStr = (jsonMatch[1] ?? text).trim()

    const notes = JSON.parse(jsonStr)

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
  await app.listen({ port: PORT, host: '0.0.0.0' })
  console.log(`LLM-DAW API running on http://localhost:${PORT}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
