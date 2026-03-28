import localFont from "next/font/local";

export const fontSans = localFont({
  src: "../../node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2",
  variable: "--font-sans",
  weight: "100 900",
  display: "swap",
});

export const fontMono = localFont({
  src: "../../node_modules/@fontsource/fira-code/files/fira-code-latin-400-normal.woff2",
  variable: "--font-mono",
  weight: "300 700",
  display: "swap",
});
