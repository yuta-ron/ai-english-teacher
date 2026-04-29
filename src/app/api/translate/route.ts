import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { text } = await req.json();
  if (!text) return NextResponse.json({ translation: "" });

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Translate the following English text to natural Japanese. Output only the translation, nothing else.",
        },
        { role: "user", content: text },
      ],
      max_tokens: 400,
    }),
  });

  if (!res.ok) return NextResponse.json({ translation: "" });
  const data = await res.json();
  const translation = data.choices?.[0]?.message?.content?.trim() ?? "";
  return NextResponse.json({ translation });
}
