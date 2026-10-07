/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#E8870A",
        secondary: "#F5A623",
        success: "#36B37E",
        warning: "#FFAB00",
        ink: "#172B4D",
        muted: "#6B778C",
        line: "#DFE1E6",
        canvas: "#F7F9FC",
      },
      fontFamily: {
        sans: [
          "Inter",
          "PingFang SC",
          "Microsoft YaHei",
          "system-ui",
          "sans-serif",
        ],
      },
      boxShadow: {
        low: "0 2px 4px rgba(0,0,0,0.08)",
        mid: "0 4px 12px rgba(0,0,0,0.12)",
        high: "0 8px 24px rgba(0,0,0,0.18)",
      },
      borderRadius: { DEFAULT: "8px", lg: "16px" },
    },
  },
  plugins: [],
};
