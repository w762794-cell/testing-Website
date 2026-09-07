// Parse raw .srt text into an array of { index, time, text }
export function parseSRT(raw) {
  const content = raw
    .replace(/^\uFEFF/, "") // strip BOM if present
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();

  const blocks = content.split(/\n\s*\n/);
  const entries = [];

  for (const block of blocks) {
    const lines = block.split("\n").filter((l) => l.length > 0 || true);
    if (lines.length < 2) continue;

    // First line is the numeric index, second line is the timestamp range
    const time = lines[1];
    if (!/-->/.test(time)) continue; // skip malformed blocks

    const text = lines.slice(2).join("\n").trim();
    entries.push({ time, text });
  }

  return entries;
}

// Rebuild .srt text from an array of { time, text }, renumbering sequentially
export function buildSRT(entries) {
  return (
    entries
      .map((e, i) => `${i + 1}\n${e.time}\n${e.text}`)
      .join("\n\n") + "\n"
  );
}

// Split entries into chunks so each translation request stays small
// (keeps each serverless function call fast and within free-tier limits)
export function chunkEntries(entries, size = 25) {
  const chunks = [];
  for (let i = 0; i < entries.length; i += size) {
    chunks.push(entries.slice(i, i + size));
  }
  return chunks;
}
