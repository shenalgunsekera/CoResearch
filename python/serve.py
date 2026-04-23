"""
FastAPI inference server using Groq for fast text transformations.

Setup:
    pip install -r requirements.txt
    set GROQ_API_KEY=your-key-here   # Windows
    # or: export GROQ_API_KEY=your-key-here  (Linux/Mac)

Start:
    python serve.py

Listens on http://localhost:8000
The Next.js app POSTs to /transform with { "prompt": "...", "text": "..." }

Get a free Groq API key at: https://console.groq.com
"""

import os
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env.local"))

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq
from pydantic import BaseModel

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_MODEL   = "llama-3.1-8b-instant"   # fast + free tier; swap to "llama-3.3-70b-versatile" for higher quality

if not GROQ_API_KEY:
    raise RuntimeError(
        "GROQ_API_KEY environment variable is not set.\n"
        "Add it to .env.local or set it in your shell before starting the server."
    )

client = Groq(api_key=GROQ_API_KEY)

SYSTEM_PROMPT = (
    "You are a research paper writing assistant. "
    "The user will give you an instruction and a passage of text. "
    "Apply the instruction exactly as requested and return ONLY the transformed text. "
    "Do not include explanations, preamble, or markdown code fences — just the result."
)

app = FastAPI(title="CoResearch AI Transform (Groq)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type"],
)


class TransformRequest(BaseModel):
    prompt: str
    text: str


class TransformResponse(BaseModel):
    output: str
    model: str


@app.post("/transform", response_model=TransformResponse)
def transform(req: TransformRequest):
    prompt = req.prompt.strip()
    text   = req.text.strip()

    if not prompt:
        raise HTTPException(status_code=400, detail="prompt is required")
    if not text:
        raise HTTPException(status_code=400, detail="text is required")

    completion = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": f"INSTRUCTION: {prompt}\n\nTEXT:\n{text}"},
        ],
        temperature=0.3,
        max_tokens=1024,
    )

    output = completion.choices[0].message.content.strip()
    return TransformResponse(output=output, model=GROQ_MODEL)


@app.get("/health")
def health():
    return {"status": "ok", "model": GROQ_MODEL}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
