// Verify a normalised cover image before installing it.
//
// Usage:  node verify.cjs out/<slug>.png [more.png ...]
// Exits non-zero if any image fails a check.

const path = require("path");
const fs = require("fs");

// sharp lives in the repo's node_modules; resolve it from here so the script works
// regardless of the caller's cwd.
const repo = path.resolve(__dirname, "../../..");
const sharp = require(path.join(repo, "node_modules", "sharp"));

// Expected background per variant. A `-light` suffix means the light-mode recolour.
const BG_DARK = "#1d1f20"; // --theme-bg, :root.dark
const BG_LIGHT = "#fafafa"; // --theme-bg, :root
const expectedBg = (f) => (/-light\.png$/i.test(f) ? BG_LIGHT : BG_DARK);

const files = process.argv.slice(2);

if (!files.length) {
	console.error("usage: node verify.cjs <image.png> [...]");
	process.exit(1);
}

(async () => {
	let failed = false;

	for (const f of files) {
		const problems = [];
		const meta = await sharp(f).metadata();
		const { data, info } = await sharp(f).raw().toBuffer({ resolveWithObject: true });

		const at = (x, y) => {
			const i = (y * info.width + x) * info.channels;
			return "#" + [...data.slice(i, i + 3)].map((v) => v.toString(16).padStart(2, "0")).join("");
		};
		const corners = {
			"top-left": at(5, 5),
			"top-right": at(info.width - 6, 5),
			"bottom-left": at(5, info.height - 6),
			"bottom-right": at(info.width - 6, info.height - 6),
		};

		if (meta.format !== "png") problems.push(`format is ${meta.format}, expected png`);

		const ratio = meta.width / meta.height;
		if (Math.abs(ratio - 16 / 9) > 0.02) problems.push(`aspect ratio ${ratio.toFixed(3)}, expected 16:9`);

		const bg = expectedBg(f);
		for (const [name, hex] of Object.entries(corners)) {
			if (hex !== bg) problems.push(`${name} corner is ${hex}, expected ${bg}`);
		}

		const kb = fs.statSync(f).size / 1024;
		if (kb > 400) problems.push(`${kb.toFixed(0)}KB is large for flat two-tone art — did it normalise?`);

		const label = path.basename(f);
		if (problems.length) {
			failed = true;
			console.log(`FAIL  ${label}`);
			for (const p of problems) console.log(`        ${p}`);
		} else {
			console.log(`ok    ${label}  ${meta.format} ${meta.width}x${meta.height} ${kb.toFixed(0)}KB  corners ${bg}`);
		}
	}

	if (failed) {
		console.log("\nRemember: these checks cannot tell you whether the image is any good. Look at it.");
		process.exit(1);
	}
})();
