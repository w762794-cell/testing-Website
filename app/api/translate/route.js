export const runtime = "nodejs";

export async function POST(req) {
  try {
    const { lines, apiKey, model } = await req.json();

    if (!Array.isArray(lines) || lines.length === 0) {
      return Response.json({ error: "No lines provided" }, { status: 400 });
    }

    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      return Response.json(
        { error: "Missing Gemini API key. Set GEMINI_API_KEY or provide one in the form." },
        { status: 400 }
      );
    }

    const modelName = model || process.env.GEMINI_MODEL || "gemini-2.0-flash";

    const numbered = lines
      .map((t, i) => `${i + 1}: ${String(t).replace(/\n/g, " / ")}`)
      .join("\n");

    const prompt = `អ្នកគឺជាអ្នកបកប្រែស៊ុបថាយថល (subtitle) ជំនាញ ជំនាញក្នុងការបកប្រែពីភាសាចិនទៅជាភាសាខ្មែរ។
គោលដៅ៖ បកប្រែឲ្យមានលក្ខណៈធម្មជាតិ រលូន ស័ក្តិសមសម្រាប់ការសម្រាយរឿង (narration) និងការសន្ទនាក្នុងរឿងភាគ មិនមែនបកប្រែពាក្យទល់នឹងពាក្យទេ។
សូមបកប្រែជួរនីមួយៗខាងក្រោមពីភាសាចិនទៅខ្មែរ ដោយរក្សាលេខរៀងដដែល។
កុំបន្ថែមការពន្យល់ ចំណារពន្យល់ ឬអក្សរផ្សេងទៀត។
ទម្រង់លទ្ធផលត្រូវតែជា៖ "លេខ: អត្ថបទបកប្រែជាភាសាខ្មែរ" មួយបន្ទាត់ក្នុងមួយជួរ ត្រូវគ្នានឹងលេខចូល។

ជួរចូល៖
${numbered}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`;

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3 },
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return Response.json(
        { error: `Gemini API error: ${resp.status} ${errText}` },
        { status: 502 }
      );
    }

    const data = await resp.json();
    const outText =
      data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("\n") ||
      "";

    const resultMap = {};
    outText.split("\n").forEach((line) => {
      const m = line.match(/^\s*(\d+)\s*[:：]\s*(.*)$/);
      if (m) resultMap[parseInt(m[1], 10)] = m[2].trim();
    });

    // Fall back to the original text for any line the model didn't return
    const translated = lines.map((orig, i) => resultMap[i + 1] || orig);

    return Response.json({ translated });
  } catch (err) {
    return Response.json(
      { error: err?.message || "Unknown server error" },
      { status: 500 }
    );
  }
}
