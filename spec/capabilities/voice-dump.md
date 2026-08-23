# Capability: Voice Dump

## What It Does
Lets a user speak a dump instead of typing it — transcribes audio to text via Groq Whisper, then hands the text to the normal Dump Capture & Classification flow.

## Inputs
| Input | Type | Source | Required |
|---|---|---|---|
| audio file | multipart upload | device microphone recording | yes |

## Outputs
| Output | Type | Destination |
|---|---|---|
| transcribed text | string | fed into a subsequent `/process` call (two separate requests, not one combined call) |

## External Calls
| System | Operation | On Failure |
|---|---|---|
| Groq Whisper (`whisper-large-v3`) | audio transcription | `500` directly — no retry, no fallback (unlike the classification path's 2-retry-then-degrade pattern) |

## Business Rules
- Transcription and classification are two separate API calls — the client is responsible for chaining them (transcribe, then send the resulting text through the normal dump flow).

## Known Gap
Not confirmed against the actual chat screen's microphone UI during this migration whether voice dump is fully wired end-to-end — the endpoint exists and is real, but its client-side integration wasn't traced. Verify before assuming this capability is complete.

## Success Criteria
- [ ] A recorded audio clip transcribes to reasonably accurate text
- [ ] A transcription failure surfaces a clear error to the user rather than a silent stuck state (no retry/fallback exists server-side, so client-side handling matters here specifically)
