import { ImageResponse } from "next/og";
import { SITE } from "@/site.config";

/** The card a link to the site shows when it is pasted into LinkedIn, WhatsApp, Slack or X. */
export const alt = `${SITE.name}: ${SITE.positioning}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#15181c";
const MUTED = "#585e66";
const PAPER = "#f2f3f0";
const MARK = "#f3d34a";

/**
 * One of the page's own typefaces, as the TrueType file the image renderer reads. The card is
 * drawn once, while the site is built. If the file cannot be fetched then, the card is drawn in
 * the renderer's own typeface instead of failing the build.
 */
async function typeface(family: string, weight: 400 | 500 | 700) {
  try {
    const query = `family=${family.replaceAll(" ", "+")}:wght@${weight}`;
    const css = await fetch(`https://fonts.googleapis.com/css2?${query}`).then((r) => r.text());
    const file = css.match(/src: url\((https:[^)]+\.ttf)\)/)?.[1];
    if (!file) return null;
    const response = await fetch(file);
    if (!response.ok) return null;
    return { name: family, data: await response.arrayBuffer(), weight, style: "normal" } as const;
  } catch {
    return null;
  }
}

/** A row of customers as the page draws them: some in line, some gone, most paid. */
const DOTS = [
  ...Array<string>(7).fill(INK),
  ...Array<string>(9).fill("#a33a2c"),
  ...Array<string>(14).fill("#2e6b4e"),
].map((color, n) => ({ id: `dot-${n}`, color }));

export default async function Image() {
  const fonts = (
    await Promise.all([
      typeface("Schibsted Grotesk", 700),
      typeface("Schibsted Grotesk", 500),
      typeface("Source Serif 4", 400),
    ])
  ).filter((font) => font !== null);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: PAPER,
        color: INK,
        fontFamily: "Schibsted Grotesk",
      }}
    >
      <div style={{ width: 14, height: "100%", background: MARK }} />
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px 60px 66px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: "-0.02em" }}>{SITE.name}</div>
          <div style={{ marginTop: 6, fontSize: 30, fontWeight: 500, color: MUTED }}>
            {SITE.role}
          </div>
        </div>
        <div
          style={{
            maxWidth: 980,
            fontFamily: "Source Serif 4",
            fontSize: 42,
            lineHeight: 1.32,
          }}
        >
          {SITE.positioning}
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", gap: 9 }}>
              {DOTS.map((dot) => (
                <div
                  key={dot.id}
                  style={{ width: 14, height: 14, borderRadius: 7, background: dot.color }}
                />
              ))}
            </div>
            <div style={{ marginTop: 14, fontSize: 24, fontWeight: 500, color: MUTED }}>
              Try it on a made-up company you can watch, question and fix
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>heyjuanse.com</div>
        </div>
      </div>
    </div>,
    { ...size, fonts: fonts.length > 0 ? fonts : undefined },
  );
}
