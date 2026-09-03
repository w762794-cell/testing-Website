"use client";

import { useRef, useState } from "react";
import { buildSrt } from "../lib/srt";

const MAX_DURATION_SECONDS = 60 * 60; // 1 hour
const TARGET_CHUNK_BYTES = 4 * 1024 * 1024; // stay safely under Vercel's ~4.5MB body limit
const MIN_CHUNK_SECONDS = 30;
const MAX_CHUNK_SECONDS = 300;

export default function Home() {
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0); // 0-100
  const [srtText, setSrtText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function getAudioDuration(f) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(f);
      const audio = document.createElement("audio");
      audio.preload = "metadata";
      audio.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        resolve(audio.duration);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("មិនអាចអានទំហំម៉ោងឯកសារបានទេ"));
      };
      audio.src = url;
    });
  }

  async function loadFFmpeg() {
    const { FFmpeg } = await import("@ffmpeg/ffmpeg");
    const { toBlobURL } = await import("@ffmpeg/util");

    const ffmpeg = new FFmpeg();
    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";

    ffmpeg.on("log", () => {});

    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    });

    return ffmpeg;
  }

  async function handleConvert() {
    setError("");
    setSrtText("");
    setProgress(0);

    if (!file) {
      setError("សូមជ្រើសរើសឯកសារ MP3 សិន");
      return;
    }

    setBusy(true);

    try {
      setStatus("កំពុងពិនិត្យរយៈពេលឯកសារ...");
      const duration = await getAudioDuration(file);

      if (duration > MAX_DURATION_SECONDS + 5) {
        throw new Error("ឯកសារវែងជាង 60 នាទី។ សូមកាត់ខ្លីជាមុនសិន។");
      }

      // Pick a chunk length so that each chunk stays comfortably under the
      // request body size limit, regardless of the file's bitrate.
      const bytesPerSecond = file.size / duration;
      let chunkSeconds = Math.floor(TARGET_CHUNK_BYTES / bytesPerSecond);
      chunkSeconds = Math.min(Math.max(chunkSeconds, MIN_CHUNK_SECONDS), MAX_CHUNK_SECONDS);

      setStatus("កំពុងផ្ទុកកម្មវិធីកាត់ audio (ffmpeg)...");
      const ffmpeg = await loadFFmpeg();

      setStatus("កំពុងកាត់ឯកសារជាចំណិតៗ...");
      const inputName = "input.mp3";
      const inputBuf = new Uint8Array(await file.arrayBuffer());
      await ffmpeg.writeFile(inputName, inputBuf);

      await ffmpeg.exec([
        "-i",
        inputName,
        "-f",
        "segment",
        "-segment_time",
        String(chunkSeconds),
        "-reset_timestamps",
        "1",
        "-c",
        "copy",
        "chunk_%03d.mp3",
      ]);

      const numChunks = Math.max(1, Math.ceil(duration / chunkSeconds));

      const allSegments = [];

      for (let i = 0; i < numChunks; i++) {
        const chunkName = `chunk_${String(i).padStart(3, "0")}.mp3`;
        let data;
        try {
          data = await ffmpeg.readFile(chunkName);
        } catch (e) {
          // Fewer chunks than estimated (e.g. duration rounded) — stop here.
          break;
        }

        setStatus(
          `កំពុងបំលែងជាអត្ថបទ និងបកប្រែជាភាសាខ្មែរ... (ចំណិតទី ${i + 1} / ${numChunks})`
        );

        const blob = new Blob([data.buffer], { type: "audio/mpeg" });
        const fd = new FormData();
        fd.append("file", blob, chunkName);
        fd.append("offset", String(i * chunkSeconds));

        const res = await fetchWithRetry("/api/transcribe-chunk", fd, 2);
        const json = await res.json();

        if (!res.ok) {
          throw new Error(json.error || `មានបញ្ហាចំណិតទី ${i + 1}`);
        }

        allSegments.push(...(json.segments || []));
        setProgress(Math.round(((i + 1) / numChunks) * 100));
      }

      allSegments.sort((a, b) => a.start - b.start);
      const srt = buildSrt(allSegments);
      setSrtText(srt);
      setStatus("បំលែងបានជោគជ័យ! ចុចប៊ូតុងខាងក្រោមដើម្បីទាញយកឯកសារ SRT");
    } catch (err) {
      console.error(err);
      setError(err.message || "មានបញ្ហាមិនស្គាល់កើតឡើង");
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  async function fetchWithRetry(url, formData, retries) {
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(url, { method: "POST", body: formData });
        if (res.ok) return res;
        lastErr = new Error(`HTTP ${res.status}`);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr;
  }

  function downloadSrt() {
    const blob = new Blob([srtText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const baseName = file ? file.name.replace(/\.[^/.]+$/, "") : "subtitle";
    a.href = url;
    a.download = `${baseName}-km.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <main
      style={{
        maxWidth: 640,
        margin: "0 auto",
        padding: "48px 20px",
      }}
    >
      <h1 style={{ fontSize: 26, marginBottom: 8 }}>
        MP3 → SRT (ភាសាខ្មែរ)
      </h1>
      <p style={{ color: "#94a3b8", marginBottom: 32, lineHeight: 1.6 }}>
        Upload ឯកសារ MP3 គ្រប់ភាសា (រួមទាំងភាសាចិន) រហូតដល់ 60 នាទី
        ប្រព័ន្ធនឹងបំលែងសម្លេងទៅជាអត្ថបទ ហើយបកប្រែជាភាសាខ្មែរ
        រួចផ្តល់ជាឯកសារ .srt ដែលមានពេលវេលាត្រឹមត្រូវ។
      </p>

      <div
        style={{
          border: "1px dashed #334155",
          borderRadius: 12,
          padding: 24,
          background: "#1e293b",
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/mpeg,audio/mp3,.mp3"
          onChange={(e) => {
            setFile(e.target.files?.[0] || null);
            setSrtText("");
            setError("");
            setStatus("");
            setProgress(0);
          }}
          disabled={busy}
          style={{ color: "#e2e8f0", marginBottom: 16, width: "100%" }}
        />

        {file && (
          <p style={{ fontSize: 14, color: "#94a3b8", marginBottom: 16 }}>
            ឯកសារ: {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)
          </p>
        )}

        <button
          onClick={handleConvert}
          disabled={!file || busy}
          style={{
            background: busy || !file ? "#475569" : "#22c55e",
            color: "#0f172a",
            border: "none",
            borderRadius: 8,
            padding: "12px 20px",
            fontWeight: 600,
            cursor: !file || busy ? "not-allowed" : "pointer",
            width: "100%",
          }}
        >
          {busy ? "កំពុងដំណើរការ..." : "ចាប់ផ្តើមបំលែង"}
        </button>

        {status && (
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: 14, color: "#38bdf8" }}>{status}</p>
            {progress > 0 && (
              <div
                style={{
                  height: 8,
                  background: "#334155",
                  borderRadius: 999,
                  overflow: "hidden",
                  marginTop: 6,
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${progress}%`,
                    background: "#22c55e",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
            )}
          </div>
        )}

        {error && (
          <p style={{ marginTop: 16, color: "#f87171", fontSize: 14 }}>
            កំហុស៖ {error}
          </p>
        )}

        {srtText && (
          <button
            onClick={downloadSrt}
            style={{
              marginTop: 16,
              background: "#38bdf8",
              color: "#0f172a",
              border: "none",
              borderRadius: 8,
              padding: "12px 20px",
              fontWeight: 600,
              cursor: "pointer",
              width: "100%",
            }}
          >
            ទាញយកឯកសារ SRT
          </button>
        )}
      </div>

      <p style={{ marginTop: 24, fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>
        ចំណាំ៖ ការកាត់ឯកសារធ្វើនៅលើ browser របស់អ្នក (ffmpeg.wasm) ដូច្នេះ
        ឯកសារដើមមិនត្រូវបានផ្ទុកទាំងមូលទៅ server ទេ។ មានតែចំណិតៗខ្លីៗប៉ុណ្ណោះ
        ដែលផ្ញើទៅសម្រាប់បំលែងជាអត្ថបទ។
      </p>
    </main>
  );
}
