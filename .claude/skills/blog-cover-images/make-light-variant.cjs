// Produce the light-mode variant of a cover by swapping the two tones.
//
// The art is flat two-tone, so the light version is a deterministic recolour of
// the dark one — same stroke, same wobble, same composition, tones exchanged.
// No second generation needed, and the two variants are guaranteed to be the
// same drawing so toggling the theme doesn't change the artwork.
//
// Usage:  node make-light-variant.cjs dark.png light.png

const path = require("path");
const fs = require("fs");

const repo = path.resolve(__dirname, "../../..");
const sharp = require(path.join(repo, "node_modules", "sharp"));

// Light mode, from :root in src/styles/global.css
const BG = [250, 250, 250]; // #fafafa — --theme-bg       0deg 0% 98%
const FG = [18, 18, 18]; //   #121212 — --theme-accent-2  0deg 0% 7%

const [inp, out] = process.argv.slice(2);
if (!inp || !out) {
	console.error("usage: node make-light-variant.cjs <dark.png> <light.png>");
	process.exit(1);
}

(async () => {
	const { data, info } = await sharp(inp).greyscale().raw().toBuffer({ resolveWithObject: true });
	const n = info.width * info.height;

	// The input is already normalised, so its background sits at 0 and its marks at
	// 255. t=0 means background, t=1 means mark — the same mapping as the dark
	// variant, just pointed at the light palette.
	const hist = new Array(256).fill(0);
	for (let i = 0; i < n; i++) hist[data[i]]++;
	const darkPeak = hist.slice(0, 128).indexOf(Math.max(...hist.slice(0, 128)));
	const lightPeak = 128 + hist.slice(128).indexOf(Math.max(...hist.slice(128)));

	if (lightPeak - darkPeak < 40) {
		console.error(`  ERROR: input does not look two-tone (peaks ${darkPeak}/${lightPeak}).`);
		process.exit(1);
	}

	const bp = darkPeak + 8;
	const wp = lightPeak - 8;

	const rgb = Buffer.allocUnsafe(n * 3);
	for (let i = 0; i < n; i++) {
		let t = (data[i] - bp) / (wp - bp);
		t = t < 0 ? 0 : t > 1 ? 1 : t;
		rgb[i * 3] = Math.round(BG[0] + (FG[0] - BG[0]) * t);
		rgb[i * 3 + 1] = Math.round(BG[1] + (FG[1] - BG[1]) * t);
		rgb[i * 3 + 2] = Math.round(BG[2] + (FG[2] - BG[2]) * t);
	}

	await sharp(rgb, { raw: { width: info.width, height: info.height, channels: 3 } })
		.png({ compressionLevel: 9 })
		.toFile(out);

	const kb = (fs.statSync(out).size / 1024).toFixed(0);
	console.log(`    light variant: ${info.width}x${info.height} · ${kb}KB · bg #fafafa marks #121212`);
})();
