import "./globals.css";

export const metadata = {
  title: "កម្មវិធីបកប្រែ SRT ចិន→ខ្មែរ",
  description: "Translate Chinese SRT subtitles into natural Khmer",
};

export default function RootLayout({ children }) {
  return (
    <html lang="km">
      <body>{children}</body>
    </html>
  );
}
