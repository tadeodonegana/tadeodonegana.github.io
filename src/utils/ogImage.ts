import { join } from "node:path";
import satori, { type SatoriOptions } from "satori";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";

import RobotoMono from "@/assets/roboto-mono-regular.ttf";
import RobotoMonoBold from "@/assets/roboto-mono-700.ttf";

// Shared by the social cards: src/pages/og-image/[slug].png.ts (one per post)
// and src/pages/social-card.png.ts (every other page). Both follow /brand/:
// two greys, one monospace, the name as the only mark, no photo and no colour.

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

// Mirrors the site's monochrome dark palette (src/styles/global.css `:root.dark`),
// which is also the palette the post covers are drawn in. Satori runs at build
// time without a DOM, so it can't resolve the CSS variables and these have to be
// kept in sync by hand.
export const ogColors = {
	bg: "#1d1f20", // --theme-bg        210deg 6% 12%
	title: "#ededed", // --theme-accent-2  0deg 0% 93%
	body: "#c8c9cb", // --theme-text      220deg 3% 79%
	muted: "#878a92", // dimmer step, for date + domain
	divider: "#3a3c41", // subtle hairline
};

// The site itself uses the system monospace, which can't be embedded; Roboto
// Mono is the closest freely licensed match.
const ogOptions: SatoriOptions = {
	width: OG_WIDTH,
	height: OG_HEIGHT,
	fonts: [
		{ name: "Roboto Mono", data: Buffer.from(RobotoMono), weight: 400, style: "normal" },
		{ name: "Roboto Mono", data: Buffer.from(RobotoMonoBold), weight: 700, style: "normal" },
	],
};

export async function renderPng(markup: Parameters<typeof satori>[0]) {
	const svg = await satori(markup, ogOptions);
	return new Resvg(svg).render().asPng();
}

export function pngResponse(png: Buffer) {
	return new Response(png, {
		headers: {
			"Content-Type": "image/png",
			"Cache-Control": "public, max-age=31536000, immutable",
		},
	});
}

const dataUri = (png: Buffer) => `data:image/png;base64,${png.toString("base64")}`;

// The covers are mostly empty charcoal with the drawing in the middle. Trim the
// empty space and fit just the drawing into a box, so every card shows its art
// at the same size whatever the cover's composition.
export async function coverArt(fsPath: string, maxWidth: number, maxHeight: number) {
	const trimmed = await sharp(fsPath)
		.flatten({ background: ogColors.bg })
		.trim({ background: ogColors.bg, threshold: 24 })
		.toBuffer();
	const { data, info } = await sharp(trimmed)
		.resize({ width: maxWidth, height: maxHeight, fit: "inside" })
		.png()
		.toBuffer({ resolveWithObject: true });
	return { src: dataUri(data), width: info.width, height: info.height };
}

// The footer's pixel-art landscape, scaled up without smoothing like on the site.
export async function landscapeArt(width: number) {
	// Relative to the project root: this module is bundled, so import.meta.url moves.
	const path = join(process.cwd(), "public/footer/sierras-bayas-dark-wide.png");
	const { data, info } = await sharp(path)
		.resize({ width, kernel: "nearest" })
		.png()
		.toBuffer({ resolveWithObject: true });
	return { src: dataUri(data), width: info.width, height: info.height };
}
