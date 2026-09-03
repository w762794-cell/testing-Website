import { NextResponse } from "next/server";
import OpenAI from "openai";

// Allow this function up to 60s (max on Vercel Hobby plan; raise if you're on Pro).
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const offset = parseFloat(formData.get("offset") || "0");

    if (!file) {
      return NextResponse.json({ error: "គ្មានឯកសារបញ្ចូន" }, { status: 400 });
    }

    // 1) Transcribe the chunk in its ORIGINAL language (auto-detected), with
    //    segment-level timestamps. This is what gives us accurate timing.
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      response_format: "verbose_json",
      timestamp_granularities: ["segment"],
    });

    const segments = transcription.segments || [];

    if (segments.length === 0) {
      return NextResponse.json({ segments: [] });
    }

    // 2) Translate every segment's text to Khmer in a single batched call,
    //    preserving order, so timing/text stay aligned 1:1.
    const originalTexts = segments.map((s) => s.text.trim());

    const translationRes = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "អ្នកគឺជាអ្នកបកប្រែជំនាញ ជំនាញខាងការបកប្រែចំណងជើងរងភាពយន្ត។ " +
            "ត្រូវបកប្រែអត្ថបទនីមួយៗដែលបានផ្ដល់ឱ្យទៅជាភាសាខ្មែរ ដោយរក្សាអត្ថន័យ " +
            "និងសម្លេងដើមឱ្យបានត្រឹមត្រូវបំផុត។ ត្រូវឆ្លើយតបជា JSON object តែមួយប៉ុណ្ណោះ " +
            'ក្នុងទម្រង់ {"translations": ["...","..."]} ដោយចំនួន និងលំដាប់នៃធាតុក្នុង ' +
            "array ត្រូវដូចគ្នាបេះបិទនឹងអត្ថបទដើមដែលបានទទួល កុំបន្ថែមពាក្យពន្យល់អ្វីទាំងអស់។",
        },
        {
          role: "user",
          content: JSON.stringify(originalTexts),
        },
      ],
    });

    let translations;
    try {
      const parsed = JSON.parse(translationRes.choices[0].message.content);
      translations = parsed.translations;
    } catch (e) {
      translations = null;
    }

    if (!Array.isArray(translations) || translations.length !== segments.length) {
      // Fallback: if translation shape didn't match, keep original text
      // rather than failing the whole chunk.
      translations = originalTexts;
    }

    const resultSegments = segments.map((seg, i) => ({
      start: seg.start + offset,
      end: seg.end + offset,
      text: (translations[i] || originalTexts[i] || "").trim(),
    }));

    return NextResponse.json({ segments: resultSegments });
  } catch (err) {
    console.error("transcribe-chunk error:", err);
    return NextResponse.json(
      { error: err?.message || "មានបញ្ហាកើតឡើងក្នុងការបំលែង" },
      { status: 500 }
    );
  }
}
