// Generates the pixel-art footer of Sierras Bayas, in the proportions of the
// real place: broad, flat-topped hills with antennas and a water tower, a
// plain of fields, a small cement plant, a scatter of tiny houses among trees,
// the quarry cliff and lake, and thick scrub with limestone in front.
//
//   node scripts/footer-landscape.mjs
//
// The scene is painted at low resolution. Each pixel has a darkness (0 = white,
// 1 = black) and a haze (0 = near, 1 = lost in the sky). Haze mixes towards the
// page background, so distant things and both side edges fade into the page in
// either theme. The result is snapped to a few greys and written as one small
// PNG per theme and width into public/footer/: a 352px crop for the normal
// content column and the full 480px for the wider post pages. The footer shows
// either at 2x with image-rendering: pixelated. The output is seeded.
//
// It also writes src/data/footer-landscape.json: the palette and the anchors
// (clouds, chimney top, antenna tips, water pixels) that the footer's canvas
// uses to animate on the same pixel grid.

import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

// The canvas is 480px wide; at 2x that is 960px, the post pages on xl screens
// (the column plus xl:-mx-32 on each side). The normal column is 704px, a
// 352px crop from the middle. Scene x runs from X0 to X1, with 0..352 being
// that middle crop.
const W = 480;
const H = 100; // height of the scene
// Empty sky added above the scene; the footer's links and copyright sit in it
// (centred over the landscape, after rileyadkisson.com's footer).
const SKY_PAD = 16;
const CH = H + SKY_PAD; // height of the canvas and of the PNGs
const NARROW = 352;
const OX = (W - NARROW) / 2;
const X0 = -OX;
const X1 = W - OX;
const EDGE = 30; // width of the fade at each side edge

// bg matches --theme-bg in src/styles/global.css. black/white are where
// darkness 1 and 0 land in each theme; steps is how many greys sit between.
const THEMES = {
	light: { bg: [0xfa, 0xfa, 0xfa], black: [0x2a, 0x2b, 0x2c], white: [0xf4, 0xf4, 0xf4], steps: 9 },
	dark: { bg: [0x1d, 0x1f, 0x20], black: [0x0f, 0x10, 0x11], white: [0xd6, 0xd6, 0xd6], steps: 10 },
};

// ---------------------------------------------------------------- utilities

let s = 1904;
function rnd() {
	s |= 0;
	s = (s + 0x6d2b79f5) | 0;
	let t = Math.imul(s ^ (s >>> 15), 1 | s);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const R = (a, b) => a + (b - a) * rnd();
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => {
	const t = clamp((x - a) / (b - a));
	return t * t * (3 - 2 * t);
};
function hash(i, k) {
	const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
	return v - Math.floor(v);
}
function vnoise(x, k = 0) {
	const i = Math.floor(x);
	const t = x - i;
	const u = t * t * (3 - 2 * t);
	return hash(i, k) * (1 - u) + hash(i + 1, k) * u;
}
const fbm = (x, k = 0) => vnoise(x, k) * 0.6 + vnoise(x * 2.3, k + 7) * 0.4;

// ---------------------------------------------------------------- canvas

const px = new Float32Array(W * CH); // darkness per pixel
const hz = new Float32Array(W * CH).fill(1); // haze per pixel; the sky is all haze
const water = new Uint8Array(W * CH); // 1 where the lake is still visible
let HAZE = 0; // haze for the layer being painted
let WATER_PX = 0; // set to 1 while painting the lake
const set = (x, y, v, h = HAZE) => {
	x = Math.round(x) + OX;
	y = Math.round(y) + SKY_PAD;
	if (x >= 0 && x < W && y >= 0 && y < CH) {
		px[y * W + x] = v;
		hz[y * W + x] = h;
		water[y * W + x] = WATER_PX;
	}
};
// Anchors for the animation, in canvas coordinates.
const anchors = { clouds: [], smoke: [], antennas: [], windows: [] };
const anchor = (list, x, y, extra = {}) =>
	list.push({ x: Math.round(x) + OX, y: Math.round(y) + SKY_PAD, ...extra });
const val = (v, x, y) => (typeof v === "function" ? v(x, y) : v);
const fillRect = (x0, y0, x1, y1, v) => {
	for (let y = Math.round(y0); y < Math.round(y1); y++)
		for (let x = Math.round(x0); x < Math.round(x1); x++) set(x, y, val(v, x, y));
};
// Fill each column from topFn(x) down to bottomFn(x).
const fillBelow = (x0, x1, topFn, bottomFn, v) => {
	for (let x = x0; x < x1; x++)
		for (let y = Math.round(topFn(x)); y < Math.round(bottomFn(x)); y++) set(x, y, val(v, x, y));
};

function tree(cx, cy, r, base) {
	for (let y = -r; y <= r; y++)
		for (let x = -r; x <= r; x++) {
			const d = Math.hypot(x, y * 1.15) / (r + 0.5);
			if (d > 0.95 + (hash(x * 13 + cx, y + cy) - 0.5) * 0.35) continue;
			// Lit from the upper left.
			const v =
				base + ((x + y) / (r + 0.5)) * 0.12 + (hash(x + cx * 7, y * 5 + cy) > 0.85 ? 0.08 : 0);
			set(cx + x, cy + y, clamp(v));
		}
}
function treeLine(x0, x1, ground, minR, maxR, base, gap = 1.3) {
	const g = typeof ground === "function" ? ground : () => ground;
	const list = [];
	for (let x = x0; x < x1; x += R(minR * gap, maxR * gap * 1.4)) {
		const r = Math.round(R(minR, maxR));
		list.push([x, g(x) - r + R(-1, 1), r]);
	}
	list.sort((a, b) => a[1] - b[1]);
	for (const [x, y, r] of list) tree(Math.round(x), Math.round(y), r, base + R(-0.05, 0.05));
}

// ---------------------------------------------------------------- scene

const HORIZON = 50; // the far edge of the plain
const TOWN = 68; // ground of the town and the plant

// Clouds are not baked into the image; the footer draws them drifting.
function sky() {
	// Three depths, after ignasimonreal.com's back, middle and front cloud
	// layers: higher is further, so smaller, hazier and slower.
	anchor(anchors.clouds, 300, -10, { w: 26, depth: 0 });
	anchor(anchors.clouds, 60, -2, { w: 40, depth: 1 });
	anchor(anchors.clouds, 210, 8, { w: 56, depth: 2 });
}

// The sierras: broad, low and flat-topped. A plateau on the left, a long
// rise on the right with the antennas and a pile of spoil on top.
const plateau = (x, c, half, shoulder, h) =>
	h * smooth(c - half - shoulder, c - half, x) * (1 - smooth(c + half, c + half + shoulder, x));
const farRange = (x) =>
	HORIZON +
	2 -
	plateau(x, -50, 20, 30, 6) -
	plateau(x, 80, 46, 34, 11) -
	plateau(x, 270, 60, 50, 9) -
	plateau(x, 175, 20, 30, 4) -
	plateau(x, 430, 24, 30, 7) +
	(fbm(x / 12, 3) - 0.5) * 1.5;
function sierras() {
	HAZE = 0.55;
	for (let x = X0; x < X1; x++) {
		const t = farRange(x);
		const slope = farRange(x + 6) - farRange(x - 6);
		const lit = slope > 1 ? 0.14 : slope > -1 ? 0.07 : 0;
		for (let y = Math.round(t); y < HORIZON + 3; y++) set(x, y, 0.42 - lit);
		set(x, t, 0.5);
	}
	// Spoil heap on the right hilltop.
	for (let x = 290; x < 304; x++) {
		const top = Math.round(farRange(x) - Math.min(x - 290, 304 - x, 3));
		for (let y = top; y < farRange(x); y++) set(x, y, 0.12);
	}
	// Three antennas and a water tower.
	HAZE = 0.45;
	for (const [x, h] of [
		[252, 15],
		[258, 12],
		[265, 14],
	]) {
		const base = Math.round(farRange(x));
		for (let y = base - h; y < base; y++) set(x, y, 0.55);
		set(x, base - h - 1, 0.35);
		anchor(anchors.antennas, x, base - h - 1);
	}
	const wt = 322;
	const wb = Math.round(farRange(wt));
	fillRect(wt, wb - 7, wt + 1, wb, 0.5);
	fillRect(wt - 1, wb - 10, wt + 2, wb - 7, 0.3);
	fillRect(wt + 1, wb - 10, wt + 2, wb - 7, 0.45);
}

// The plain of fields, striped, with lines of trees.
function fields() {
	const haze = (y) => lerp(0.6, 0.35, (y - HORIZON) / (TOWN - HORIZON));
	for (let y = HORIZON + 1; y < TOWN + 4; y++)
		for (let x = X0; x < X1; x++) {
			if (y < farRange(x) + 1) continue;
			const band = Math.floor((y - HORIZON) / 3 + fbm(x / 50, 2) * 2) % 2;
			set(x, y, 0.3 + band * 0.08, haze(Math.min(y, TOWN)));
		}
	for (let i = 0; i < 20; i++) {
		const y = Math.round(R(HORIZON + 4, TOWN - 4));
		const x = R(X0, X1);
		const len = Math.round(R(4, 14));
		for (let k = 0; k < len; k++) {
			set(x + k, y, 0.7, haze(y));
			if (k > 0 && k < len - 1) set(x + k, y - 1, 0.55, haze(y));
		}
	}
}

// A small cement plant on the left: kiln tower, chimneys, silos and a shed.
function plant() {
	const g = TOWN;
	HAZE = 0.3;
	treeLine(X0, 150, g + 1, 1, 3, 0.62);
	HAZE = 0.25;
	const cyl = (x, w, top, v) => {
		for (let i = 0; i < w; i++)
			fillRect(x + i, top, x + i + 1, g, v + (i === w - 1 ? 0.2 : i === 0 ? -0.05 : 0));
	};
	// Shed with a sawtooth roof.
	fillRect(90, g - 5, 118, g, 0.2);
	for (let x = 90; x < 118; x++) set(x, g - 6, (x - 90) % 4 < 2 ? 0.45 : 0.3);
	for (let x = 92; x < 117; x += 3) set(x, g - 3, 0.55);
	// Silos.
	cyl(74, 4, g - 12, 0.22);
	cyl(79, 4, g - 12, 0.22);
	cyl(84, 3, g - 9, 0.22);
	// Kiln tower, a dark lattice.
	fillRect(56, g - 18, 61, g, 0.55);
	for (let y = g - 17; y < g; y += 3) fillRect(57, y, 60, y + 1, 0.3);
	fillRect(55, g - 19, 62, g - 18, 0.6);
	// Chimneys.
	for (const [x, h] of [
		[40, 12],
		[45, 12],
		[50, 13],
		[66, 20],
		[71, 14],
	])
		fillRect(x, g - h, x + 1, g, 0.5);
	// Smoke rises from the tallest chimney.
	anchor(anchors.smoke, 66, g - 21);
	// Conveyor on the left.
	for (let i = 0; i < 14; i++) set(22 + i, g - 2 - Math.floor(i / 2), 0.5);
}

// The town sits on a gentle slope rising to the right.
const g0 = (x) => TOWN + 1 - (x - 150) * 0.03;

// Tiny houses scattered among trees, as the town looks from the hills.
function town() {
	HAZE = 0.3;
	treeLine(150, X1, g0, 1, 3, 0.62, 1.1);
	HAZE = 0.2;
	for (let i = 0; i < 60; i++) {
		const x = Math.round(R(152, X1 - 4));
		const y = Math.round(g0(x) - R(0, 6));
		const w = Math.round(R(2, 5));
		fillRect(x, y - 2, x + w, y, 0.04);
		fillRect(x + w - 1, y - 2, x + w, y, 0.22);
		fillRect(x, y - 3, x + w, y - 2, rnd() < 0.5 ? 0.5 : 0.36);
		// A window that can light up at night.
		if (w >= 3) anchor(anchors.windows, x + 1, y - 2);
	}
	HAZE = 0.15;
	treeLine(150, X1, (x) => g0(x) + 3, 2, 3, 0.62, 2.4);
}

// The quarry: a limestone cliff and the lake at its foot.
const WATER = 79;
const cliffTop = (x) => TOWN + 2 + (fbm(x / 8, 4) - 0.5) * 2;
function quarry() {
	// Scrubby ground on the left, which the cliff and lake then cover.
	HAZE = 0.08;
	fillBelow(
		X0,
		60,
		() => TOWN + 4,
		() => H,
		0.55,
	);
	HAZE = 0.12;
	fillBelow(
		14,
		186,
		cliffTop,
		(x) => WATER + 1 + (fbm(x / 9, 5) - 0.5) * 3,
		(x, y) => {
			const crack = hash(Math.floor(x / 2), 9) > 0.8 && hash(y >> 1, x) > 0.25 ? 0.22 : 0;
			const ledge = (y - TOWN) % 5 === 0 ? 0.1 : 0;
			return 0.12 + crack + ledge;
		},
	);
	for (let x = 14; x < 186; x++) set(x, cliffTop(x), hash(x, 3) > 0.4 ? 0.62 : 0.45);
	WATER_PX = 1;
	for (let y = WATER; y < H; y++) {
		const x0 = 20 + (y - WATER) * 0.6;
		const x1 = 178 - (y - WATER) * 1.5 + (fbm(y / 3, 6) - 0.5) * 4;
		for (let x = Math.round(x0); x < x1; x++) {
			// The cliff reflected near the bank, then deep water.
			let v = y < WATER + 4 ? 0.3 : 0.55;
			if (hash(Math.floor(x / 7) + y * 31, 2) > 0.88) v = 0.25;
			set(x, y, v);
		}
	}
	WATER_PX = 0;
}

// Thick scrub in front: rows of bushes that grow larger as they come closer.
function foreground() {
	HAZE = 0.08;
	fillBelow(
		170,
		X1,
		(x) => g0(x) + 4,
		() => H,
		0.55,
	);
	for (let row = 0; row < 6; row++) {
		const t = row / 5;
		HAZE = lerp(0.12, 0, t);
		const y = (x) => g0(x) + 7 + row * 5;
		treeLine(
			166 - row * 6,
			X1 + 4,
			y,
			2 + Math.round(t),
			3 + Math.round(t * 2),
			lerp(0.56, 0.68, t),
			1.1,
		);
	}
	// Scrub below the plain on the far left, beside the quarry.
	HAZE = 0.08;
	treeLine(X0, 16, TOWN + 9, 2, 3, 0.58, 1.1);
	HAZE = 0;
	const frame = (x) => H + 4 - 10 * Math.exp(-((x / 50) ** 2)) - 3 * fbm(x / 20, 9);
	treeLine(X0 - 4, 200, frame, 4, 7, 0.72, 1.1);
}

sky();
sierras();
fields();
plant();
town();
quarry();
foreground();

// For each canvas column, the first row that is not open sky; stars stay above.
const skyline = [];
for (let x = 0; x < W; x++) {
	let y = 0;
	while (y < CH && hz[y * W + x] >= 0.99) y++;
	skyline.push(y);
}

// Runs of water pixels still visible after the scrub, as [y, x0, x1).
const waterRuns = [];
for (let y = 0; y < CH; y++)
	for (let x = 0; x < W; x++) {
		if (!water[y * W + x]) continue;
		let e = x;
		while (e < W && water[y * W + e]) e++;
		waterRuns.push([y, x, e]);
		x = e;
	}
mkdirSync(new URL("../src/data/", import.meta.url), { recursive: true });
writeFileSync(
	new URL("../src/data/footer-landscape.json", import.meta.url),
	JSON.stringify({
		W,
		H: CH,
		NARROW,
		OX,
		EDGE,
		themes: THEMES,
		...anchors,
		water: waterRuns,
		skyline,
	}) + "\n",
);

// ---------------------------------------------------------------- output

// A light 4x4 ordered dither, only enough to break up hard band edges.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(
	(v) => (v + 0.5) / 16 - 0.5,
);

const dir = new URL("../public/footer/", import.meta.url);
mkdirSync(dir, { recursive: true });
const VARIANTS = [
	{ suffix: "", left: OX, width: NARROW },
	{ suffix: "-wide", left: 0, width: W },
];
for (const [name, { bg, black, white, steps }] of Object.entries(THEMES)) {
	// The greys this theme may use: the page background plus even steps.
	const greys = [bg];
	for (let i = 0; i < steps; i++)
		greys.push(black.map((c, k) => lerp(c, white[k], i / (steps - 1))));
	const span = Math.abs(white[0] - black[0]) / (steps - 1);
	for (const { suffix, left, width } of VARIANTS) {
		const buf = Buffer.alloc(width * CH * 3);
		for (let y = 0; y < CH; y++)
			for (let x = 0; x < width; x++) {
				const i = y * W + x + left;
				// Fade both side edges into the page, so the art sits in its column
				// like the posts do, without a hard box around it.
				const edge = 1 - smooth(0, EDGE, Math.min(x, width - 1 - x));
				const h = Math.max(hz[i], edge);
				let rgb = bg;
				if (h < 0.995) {
					const col = black.map((c, k) => lerp(c, white[k], 1 - px[i]));
					const mixed = col.map((c, k) => lerp(c, bg[k], h));
					const jitter = BAYER[(y % 4) * 4 + ((x + left) % 4)] * span * 0.6;
					rgb = greys.reduce((best, g) =>
						Math.abs(g[0] - mixed[0] - jitter) < Math.abs(best[0] - mixed[0] - jitter) ? g : best,
					);
				}
				for (let c = 0; c < 3; c++) buf[(y * width + x) * 3 + c] = Math.round(rgb[c]);
			}
		const file = new URL(`sierras-bayas-${name}${suffix}.png`, dir).pathname;
		const info = await sharp(buf, { raw: { width, height: CH, channels: 3 } })
			.png({ palette: true, colours: greys.length, dither: 0, compressionLevel: 9 })
			.toFile(file);
		console.log(
			`sierras-bayas-${name}${suffix}.png  ${width}x${CH}  ${(info.size / 1024).toFixed(1)} KB`,
		);
	}
}
