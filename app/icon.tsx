import { ImageResponse } from "next/og";

export const size = {
  width: 64,
  height: 64,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        borderRadius: "9999px",
        backgroundColor: "#065f46",
        color: "#ffffff",
        fontSize: 32,
        fontWeight: 900,
        boxShadow: "0 1px 2px rgba(6, 78, 59, 0.15)",
      }}
    >
      5
      <span
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          width: 12,
          height: 12,
          borderRadius: "9999px",
          border: "2px solid #f4f1e9",
          backgroundColor: "#fbbf24",
        }}
      />
    </div>,
    { ...size },
  );
}