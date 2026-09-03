export const metadata = {
  title: "MP3 to Khmer SRT",
  description: "បំលែងឯកសារ MP3 ជាចំណងជើងរង (SRT) ភាសាខ្មែរ",
};

export default function RootLayout({ children }) {
  return (
    <html lang="km">
      <body
        style={{
          margin: 0,
          fontFamily:
            "'Khmer OS', 'Noto Sans Khmer', system-ui, -apple-system, sans-serif",
          background: "#0f172a",
          color: "#e2e8f0",
          minHeight: "100vh",
        }}
      >
        {children}
      </body>
    </html>
  );
}
