// Normalize a generated cover onto the site's exact two-tone palette.
//
// Gemini returns a JPEG whose "charcoal" drifts a few points off target and whose
// compression noise bloats the file. This snaps the two tones to the site's real
// palette values and re-encodes as PNG, which is the right format for flat art.
//
// Usage:  NODE_PATH=<repo>/node_modules node normalize-cover.cjs in.jpg out.png

const sharp = require("sharp");
const fs = require("fs");

const BG = [29, 31, 32]; // #1d1f20 — --theme-bg
const FG = [237, 237, 237]; // #ededed — --theme-accent-2

const [inp, out] = process.argv.slice(2);
if (!inp || !out) {
	console.error("usage: normalize-cover.cjs <input> <output.png>");
	process.exit(1);
}

(async () => {
	const { data, info } = await sharp(inp).greyscale().raw().toBuffer({ resolveWithObject: true });
	const n = info.width * info.height;

	// The art is two-tone, so the histogram has two clear modes: background and marks.
	// Clamping just inside each mode flattens compression noise without eating the
	// antialiased edge that gives the stroke its hand-drawn quality.
	const hist = new Array(256).fill(0);
	for (let i = 0; i < n; i++) hist[data[i]]++;
	const darkPeak = hist.slice(0, 128).indexOf(Math.max(...hist.slice(0, 128)));
	const lightPeak = 128 + hist.slice(128).indexOf(Math.max(...hist.slice(128)));
	const bp = darkPeak + 8;
	const wp = lightPeak - 8;

	if (wp - bp < 40) {
		console.error(
			`  WARNING: tones too close (dark=${darkPeak} light=${lightPeak}) — ` +
				`image may not be two-tone. Skipping normalisation.`,
		);
		fs.copyFileSync(inp, out);
		return;
	}

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

	const before = (fs.statSync(inp).size / 1024 / 1024).toFixed(1);
	const after = (fs.statSync(out).size / 1024).toFixed(0);
	console.log(`    normalised: ${info.width}x${info.height} · ${after}KB (from ${before}MB)`);
})();
