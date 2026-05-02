import { NextRequest, NextResponse } from "next/server";
import { verifyToken, signToken } from "@/lib/jwt";

type Accent = "american" | "british" | "australian" | "canadian" | "indian";

// Valid voices for gpt-4o-realtime-preview: alloy, ash, ballad, coral, echo, sage, shimmer, verse
const ACCENT_CONFIG: Record<Accent, { voice: string; instruction: string }> = {
  american: {
    voice: "alloy",
    instruction:
      'Use standard American English. Use American vocabulary: "elevator" (not lift), "apartment" (not flat), "gasoline" (not petrol), "fall" (not autumn). Reference American culture naturally.',
  },
  british: {
    voice: "echo",
    instruction:
      'Use British English. Use British spelling (colour, favourite, realise, organise) and vocabulary (lift, flat, chemist, brilliant, cheers, mate, quite, lovely, rubbish). Reference British culture naturally.',
  },
  australian: {
    voice: "shimmer",
    instruction:
      'Use Australian English. Use Australian expressions (no worries, arvo for afternoon, reckon, heaps, mate, fair dinkum, keen). Reference Australian culture, landmarks, and laid-back attitude naturally.',
  },
  canadian: {
    voice: "ash",
    instruction:
      'Use Canadian English. Mix some British spelling (colour, behaviour) with American vocabulary. Use Canadian expressions and politeness. Reference Canadian culture, hockey, and multiculturalism naturally.',
  },
  indian: {
    voice: "sage",
    instruction:
      'Use Indian English. Use expressions common in Indian English (do the needful, revert back, out of station, prepone). Be warm, respectful, and formal. Reference Indian culture naturally.',
  },
};

const BASE_PROMPT = `You are Alex, a warm and encouraging English conversation teacher for Japanese speakers.

About the student:
- Their native language is Japanese
- They actively mix Japanese and English in a single sentence — this is completely normal and expected
- Examples of how they might speak: "昨日 I went to the supermarket", "これって how do you say in English?", "とても tired だった"
- You must understand both Japanese and English equally well, including full Japanese sentences

Your role:
- Always respond in English to maximise the student's exposure to natural English
- When the student speaks Japanese (fully or partially), understand it completely and respond naturally in English — do not ask them to repeat in English
- If they say something entirely in Japanese, respond to its meaning in English, as if it were said in English
- Speak clearly and at a moderate pace, using vocabulary appropriate to the student's level
- Be positive, patient, and supportive — mixing languages while learning is natural and brave
- Keep sentences clear and natural

Correction policy — this is important:
After responding naturally to the student, ALWAYS check for any of the following and give a tip if found:
1. Grammar errors (wrong tense, missing articles, subject-verb disagreement, wrong preposition, etc.)
2. Unnatural or awkward word choices (e.g., "I am boring" instead of "I am bored")
3. Expressions that native speakers would phrase differently
4. Vocabulary that could be upgraded to sound more fluent

When you have a correction or suggestion, say it clearly using this exact spoken phrase:
"Quick tip: [your correction or better expression]"

Examples:
- "Quick tip: we say 'I was bored' not 'I was boring' — boring describes things, bored describes feelings."
- "Quick tip: instead of 'very big', a more natural word is 'huge' or 'enormous'."
- "Quick tip: the correct form is 'I went there yesterday', using past tense."

If the student spoke perfectly, skip the quick tip entirely. Do not force one.

Accent and variety:
`;

const SESSION_DURATION_SECONDS = 900; // 15 minutes

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not set" },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const { paymentToken, sessionToken, accent: accentInput } = body;

  let isNewSession = false;

  if (sessionToken) {
    try {
      const payload = await verifyToken(sessionToken);
      if (payload.type !== "session") throw new Error("Invalid token type");
    } catch {
      return NextResponse.json(
        { error: "Invalid or expired session token" },
        { status: 401 }
      );
    }
  } else if (paymentToken) {
    try {
      const payload = await verifyToken(paymentToken);
      if (payload.type !== "payment") throw new Error("Invalid token type");
      isNewSession = true;
    } catch {
      return NextResponse.json(
        { error: "Invalid or expired payment token" },
        { status: 401 }
      );
    }
  } else {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  const accent: Accent =
    accentInput in ACCENT_CONFIG ? (accentInput as Accent) : "american";

  const { voice, instruction } = ACCENT_CONFIG[accent];
  const systemPrompt =
    BASE_PROMPT +
    instruction +
    "\n\nStart by warmly greeting the student in simple English and asking what they'd like to talk about today.";

  const res = await fetch("https://api.openai.com/v1/realtime/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-realtime-preview",
      voice,
      instructions: systemPrompt,
      input_audio_transcription: { model: "gpt-4o-transcribe" },
      turn_detection: {
        type: "server_vad",
        silence_duration_ms: 2000,
        threshold: 0.5,
        prefix_padding_ms: 300,
      },
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    return NextResponse.json({ error }, { status: res.status });
  }

  const data = await res.json();
  const response: Record<string, unknown> = { token: data.client_secret.value };

  if (isNewSession) {
    const sessionExp = Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS;
    response.sessionToken = await signToken({ type: "session" }, sessionExp);
    response.sessionExp = sessionExp;
  }

  return NextResponse.json(response);
}
