"use client";

import { useState } from "react";
import { parseSRT, buildSRT, chunkEntries } from "../lib/srt";

export default function Home() {
  const [file, setFile] = useState(null);
  const [apiKey, setApiKey] = useState("");
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleTranslate() {
    if (!file) {
      setStatus("សូមជ្រើសរើសឯកសារ .srt សិន");
      return;
    }

    setBusy(true);
    setStatus("កំពុងអានឯកសារ...");
    setProgress(0);
    setDownloadUrl(null);

    const raw = await file.text();
    const entries = parseSRT(raw);

    if (entries.length === 0) {
      setStatus("មិនអាចអានទ្រង់ទ្រាយ SRT នេះបានទេ សូមពិនិត្យឯកសារ");
      setBusy(false);
      return;
    }

    const chunks = chunkEntries(entries, 25);
    const translatedEntries = [];
    let done = 0;
    let hadError = false;

    for (const chunk of chunks) {
      const lines = chunk.map((c) => c.text);
      let translated = lines;

      try {
        const res = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lines, apiKey }),
        });
        const data = await res.json();
        if (data.translated) {
          translated = data.translated;
        } else {
          hadError = true;
          setStatus(`កំហុស៖ ${data.error || "unknown error"}`);
        }
      } catch (e) {
        hadError = true;
        setStatus("កំហុសក្នុងការភ្ជាប់ទៅសេវាបកប្រែ");
      }

      chunk.forEach((c, i) => {
        translatedEntries.push({ time: c.time, text: translated[i] });
      });

      done += chunk.length;
      setProgress(Math.round((done / entries.length) * 100));
    }

    const outSrt = buildSRT(translatedEntries);
    const blob = new Blob([outSrt], { type: "text/plain;charset=utf-8" });
    setDownloadUrl(URL.createObjectURL(blob));
    setStatus(hadError ? "បកប្រែរួច ប៉ុន្តែមានកំហុសខ្លះ" : "បកប្រែរួចរាល់!");
    setBusy(false);
  }

  return (
    <main
      style={{
        maxWidth: 640,
        margin: "40px auto",
        padding: 24,
        background: "#fff",
        borderRadius: 12,
        boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
      }}
    >
      <h1 style={{ fontSize: 22 }}>បកប្រែ SRT ចិន → ខ្មែរ</h1>
      <p style={{ color: "#555" }}>
        ផ្ទុកឯកសារ .srt ជាភាសាចិន ដើម្បីបកប្រែជាភាសាខ្មែរដែលមានលក្ខណៈធម្មជាតិ
        សម្រាប់ការសម្រាយរឿង
      </p>

      <div style={{ margin: "16px 0" }}>
        <label style={{ display: "block", marginBottom: 6, fontSize: 14 }}>
          Groq API Key (ទុកទទេប្រសិនបើម៉ាស៊ីនមេបានកំណត់រួចហើយ)
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="ស្រេចចិត្ត (optional)"
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 8,
            border: "1px solid #ddd",
          }}
        />
      </div>

      <input
        type="file"
        accept=".srt"
        onChange={(e) => setFile(e.target.files[0])}
      />

      <div style={{ marginTop: 16 }}>
        <button
          onClick={handleTranslate}
          disabled={busy}
          style={{
            padding: "10px 22px",
            borderRadius: 8,
            border: "none",
            background: busy ? "#9e9e9e" : "#2e7d32",
            color: "#fff",
            cursor: busy ? "not-allowed" : "pointer",
          }}
        >
          {busy ? "កំពុងបកប្រែ..." : "ចាប់ផ្តើមបកប្រែ"}
        </button>
      </div>

      {progress > 0 && (
        <div style={{ marginTop: 20 }}>
          <div
            style={{
              background: "#eee",
              borderRadius: 6,
              overflow: "hidden",
              height: 10,
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                background: "#4caf50",
                height: "100%",
                transition: "width 0.2s",
              }}
            />
          </div>
          <p style={{ fontSize: 13, color: "#555" }}>{progress}%</p>
        </div>
      )}

      {status && <p style={{ marginTop: 8 }}>{status}</p>}

      {downloadUrl && (
        <a
          href={downloadUrl}
          download="translated_km.srt"
          style={{
            display: "inline-block",
            marginTop: 16,
            padding: "10px 22px",
            background: "#1565c0",
            color: "#fff",
            borderRadius: 8,
            textDecoration: "none",
          }}
        >
          ទាញយកឯកសារបកប្រែ (.srt)
        </a>
      )}
    </main>
  );
}
