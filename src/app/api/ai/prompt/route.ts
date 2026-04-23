/**
 * AI Prompt Assistant — uses Groq (llama-3.1-8b-instant) for fast inference.
 *
 * Get a free key at https://console.groq.com and add to .env.local:
 *   GROQ_API_KEY=your-key-here
 */

import Groq from "groq-sdk";
import { NextResponse } from "next/server";

const GROQ_MODEL   = "llama-3.1-8b-instant";
const SYSTEM_PROMPT =
  "You are a research paper writing assistant. " +
  "The user will give you an instruction and a passage of text. " +
  "Apply the instruction exactly as requested and return ONLY the transformed text. " +
  "Do not include explanations, preamble, or markdown code fences — just the result.";

export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === "your-groq-api-key-here") {
    return NextResponse.json(
      { error: "GROQ_API_KEY is not configured. Add it to .env.local." },
      { status: 500 },
    );
  }

  let prompt = "";
  let selectedText = "";
  try {
    const body = await request.json();
    prompt       = (body.prompt       ?? "").trim();
    selectedText = (body.selectedText ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!prompt || !selectedText) {
    return NextResponse.json(
      { error: "prompt and selectedText are required" },
      { status: 400 },
    );
  }

  try {
    const client = new Groq({ apiKey });

    const completion = await client.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: `INSTRUCTION: ${prompt}\n\nTEXT:\n${selectedText}` },
      ],
      temperature: 0.3,
      max_tokens: 1024,
    });

    const output = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!output) {
      return NextResponse.json({ error: "Model returned empty response" }, { status: 502 });
    }

    return NextResponse.json({ output, model: GROQ_MODEL });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Groq request failed";
    console.error("Groq AI error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
