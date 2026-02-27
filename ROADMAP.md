# LLM-DAW Roadmap

## Released

### v1.0 — Foundation
- Browser-based DAW with React + Tone.js
- MIDI keyboard input with live monitoring
- Multi-track recording with real-time clip visualization
- AI-powered music analysis and suggestion generation (Claude)
- 35 instrument presets across 8 categories with per-track selection
- Transport controls (play, pause, stop, seek, record)
- Canvas-based arrangement view with note rendering
- Per-track volume, pan, mute, solo, arm controls
- Project persistence via backend API + PostgreSQL
- Industrial-futuristic dark theme UI
- Jenkins CI/CD with Kaniko builds + Helm deploys

### v1.1 — Quantize + Smart Prompts
- Note quantize (1/4, 1/8, 1/16 grid snap) with transport bar controls
- 10 instrument-aware AI quick prompts (drums, bass, piano, pads, etc.)
- Auto-assigns correct instrument preset to AI-generated tracks
- GM drum mapping and pitch range guidance sent to Claude

---

## Next Up

### v1.2 — Multi-Track AI Arrangement
- "Arrange this melody" — Claude generates multiple parts (drums + bass + chords + lead)
- Each part created as a separate track with auto-assigned instrument
- Full arrangement from a single melody input

### v1.3 — Effects & Mixing
- Per-track effects chain (reverb, delay, chorus, distortion via Tone.js)
- Effects bypass/wet-dry controls
- Master bus effects

### v1.4 — Piano Roll Enhancements
- Note drag/resize in piano roll
- Velocity editing per note
- Snap-to-grid during editing (uses quantize grid setting)
- Copy/paste/duplicate notes and clips

### v1.5 — Export & Sharing
- Bounce to WAV (offline render via Tone.js)
- Export MIDI file
- Share project link

---

## Backlog (Unscheduled)

### Admin Preset Management UI
- Move presets from static code to database
- CRUD API endpoints for presets
- Admin page: pick synth type, tweak params, preview live, save
- Per-synth-type option editors (oscillator, envelope, modulation, filter)

### Undo/Redo
- Zustand temporal middleware for state history
- Ctrl+Z / Ctrl+Shift+Z keyboard shortcuts

### Loop Mode
- Wire up existing loop UI (start/end markers already in state)
- Visual loop region on arrangement view
- Transport loops between markers

### Pattern/Loop Library
- Save clips as reusable patterns
- Pattern browser with preview
- Drag patterns onto tracks

### Audio Tracks
- Import audio files (WAV/MP3)
- Waveform visualization
- Audio clip playback via Tone.Player

### Collaboration
- WebSocket real-time sync between users
- Shared project editing
- User presence indicators
