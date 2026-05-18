# LLM Engine Architecture & Model Selection

## Primary Engine: Gemini 3 Flash
**API ID**: `gemini-3.0-flash`
**Provider**: Google (via `@google/genai`)

After extensive latency and intelligence testing, Gemini 3 Flash was selected as the primary brain for The Seeing Eye.

### Why Gemini 3 Flash?
1. **Intelligence:** It is a "frontier-class" model. It handles nuanced interview questions (creative disagreements, workflow pacing, behavioral scenarios) significantly better than Llama 3.3.
2. **Speed:** It has no "thinking" or reasoning overhead. It streams the first token in roughly ~500-800ms.
3. **Cost:** It is incredibly cheap. 
   - **Input:** $0.50 per 1M tokens
   - **Output:** $3.00 per 1M tokens
   - *A full 1-hour interview costs approximately $0.05 to $0.10 total.*

## Fallback Engine: Groq + Llama 3.3 70B
**API ID**: `llama-3.3-70b-versatile`
**Provider**: Groq

Groq acts as the instant-fallback if Gemini experiences rate limits or latency spikes.

### Why Groq?
1. **Raw Speed:** Groq runs on custom LPU hardware designed specifically for inference speed.
2. **Latency:** Delivers the first token in **~200ms**.
3. **Intelligence Tradeoff:** Llama 3.3 is extremely fast but slightly less capable of handling high-level creative nuance compared to Gemini 3 Flash.

## Models Rejected & Why

| Model | Speed | Intelligence | Reason Rejected |
|---|---|---|---|
| **Gemini 3.1 Pro** | Slower | 🧠🧠🧠🧠 Best | Uses reasoning/thinking mode. Too slow for real-time live conversations. |
| **Gemini 2.5 Pro** | Slowest | 🧠🧠🧠🧠 Best | Deep reasoning overhead creates 2-3 second latency. |
| **GPT-4o** | Slow | 🧠🧠🧠🧠 Best | ~2+ second latency. Unacceptable for a conversational HUD. |
| **Gemini 3.1 Flash-Lite** | ⚡⚡ Fastest | 🧠🧠 Good | Kept as a potential backup, but Flash 3 provides better intelligence for the same speed tier. |

## Implementation
The application is hard-coded to prioritize Gemini 3 Flash. If the `generateContentStream` fails or times out, it instantly catches the error and executes the same prompt against Groq's API to ensure the user never misses an answer during a live interview.
