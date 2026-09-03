function pad(num, len) {
  return String(Math.max(0, Math.floor(num))).padStart(len, "0");
}

// seconds (float) -> "HH:MM:SS,mmm"
export function formatTimestamp(totalSeconds) {
  const safe = Math.max(0, totalSeconds);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = Math.floor(safe % 60);
  const ms = Math.round((safe - Math.floor(safe)) * 1000);
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${pad(ms, 3)}`;
}

// segments: [{ start: number, end: number, text: string }]
export function buildSrt(segments) {
  return segments
    .map((seg, i) => {
      const index = i + 1;
      const time = `${formatTimestamp(seg.start)} --> ${formatTimestamp(seg.end)}`;
      return `${index}\n${time}\n${seg.text.trim()}\n`;
    })
    .join("\n");
}
