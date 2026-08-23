# Capability: Chitchat

## What It Does
Answers general-knowledge questions or conversational messages that have no connection to the user's stored data — "What is the capital of France?", "Should I work out today?", or a direct reply to something Dumpo itself just asked.

## Inputs
| Input | Type | Source | Required |
|---|---|---|---|
| Same `/process` call — this is the CHAT branch of the router's classification | — | — | — |

## Outputs
| Output | Type | Destination |
|---|---|---|
| A conversational reply | string (`confirmation_text`, `primary_bucket: "chat"`) | returned to client, logged to `chat_messages` |

## External Calls
| System | Operation | On Failure |
|---|---|---|
| Groq | conversational completion, `CHATBOT_SYSTEM_PROMPT`, temp 0.7, full recent history | logged and silently dropped — no fallback response is appended for a failed chat item (unlike Dump Capture's hard fallback) |

## Business Rules
- The router LLM is the sole judge of "is this CHAT vs. CRUD-READ" — the prompt gives explicit examples both ways ("What are my tasks?" is CRUD not CHAT; "Should I work out today?" is CHAT). No secondary confirmation step.
- Dumpo maintains a consistent persona/identity across chat replies ("Always maintain your identity as Dumpo").

## Known Gap
Unlike every other node, a chat item's Groq failure produces **no item at all** in the response (the `except` block just logs and moves on — no fallback item is appended). A user whose chitchat message fails silently gets no reply and no error, rather than Dump Capture's graceful "landed in others" story. Worth deciding whether this deserves the same fallback treatment as the other nodes.

## Success Criteria
- [ ] A general-knowledge question gets answered directly without touching any bucket table
- [ ] Chat history context genuinely carries over — "Yes" as a reply to a prior Dumpo question resolves correctly
- [ ] A Groq failure on a chat item doesn't silently drop the user's message with zero feedback — **currently does**, see Known Gap
