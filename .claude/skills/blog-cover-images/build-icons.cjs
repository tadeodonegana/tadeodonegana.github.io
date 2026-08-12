// Derive the whole favicon / PWA icon set from the monochrome portrait.
//
//   node build-icons.cjs src/assets/portrait.png
//
// Writes into public/. Icons must be square, so the portrait is cropped to its
// head — the shoulders read as noise below ~32px and only shrink the face.

const path = require("path");
const fs = require("fs");

const repo = path.resolve(__dirname, "../../..");
const sharp = require(path.join(repo, "node_modules", "sharp"));

const SRC = process.argv[2];
const PUBLIC = path.join(repo, "public");

if (!SRC || !fs.existsSync(SRC)) {
	console.error("usage: node build-icons.cjs <portrait.png>");
	process.exit(1);
}

// name -> pixel size. Every entry is referenced from BaseHead.astro or
// manifest.webmanifest; keep them in sync if you add one.
const PNGS = {
	"favicon-16x16.png": 16,
	"favicon-32x32.png": 32,
	"apple-touch-icon.png": 180,
	"192x192.png": 192,
	"android-chrome-192x192.png": 192,
	"512x512.png": 512,
	"android-chrome-512x512.png": 512,
	"icon.png": 512,
};

const ICO_SIZES = [16, 32, 48];

/** Pack PNG buffers into a multi-size .ico. */
function buildIco(entries) {
	const header = Buffer.alloc(6);
	header.writeUInt16LE(0, 0); // reserved
	header.writeUInt16LE(1, 2); // type 1 = icon
	header.writeUInt16LE(entries.length, 4);

	const dir = Buffer.alloc(16 * entries.length);
	let offset = 6 + dir.length;

	entries.forEach(({ size, data }, i) => {
		const at = i * 16;
		dir[at] = size >= 256 ? 0 : size; // width  (0 means 256)
		dir[at + 1] = size >= 256 ? 0 : size; // height
		dir[at + 2] = 0; // palette count
		dir[at + 3] = 0; // reserved
		dir.writeUInt16LE(1, at + 4); // colour planes
		dir.writeUInt16LE(32, at + 6); // bits per pixel
		dir.writeUInt32LE(data.length, at + 8);
		dir.writeUInt32LE(offset, at + 12);
		offset += data.length;
	});

	return Buffer.concat([header, dir, ...entries.map((e) => e.data)]);
}

(async () => {
	// Locate the ink, then find the neck: the head is the cluster above the row
	// where the silhouette is narrowest before the shoulders flare out again.
	const { data, info } = await sharp(SRC).greyscale().raw().toBuffer({ resolveWithObject: true });
	const rowExtent = [];
	for (let y = 0; y < info.height; y++) {
		let lo = Infinity;
		let hi = -1;
		for (let x = 0; x < info.width; x++) {
			if (data[y * info.width + x] > 128) {
				if (x < lo) lo = x;
				if (x > hi) hi = x;
			}
		}
		rowExtent.push(hi < 0 ? 0 : hi - lo);
	}

	const inked = rowExtent.map((w, y) => [y, w]).filter(([, w]) => w > 0);
	const top = inked[0][0];
	const bottom = inked[inked.length - 1][0];

	// Walk down from the widest row (mid-head) looking for the first LOCAL minimum:
	// the silhouette narrows into the neck, then flares out again at the shoulders.
	// Taking the global minimum instead would land on the bottom edge of the
	// shoulders and defeat the whole point of cropping.
	const widest = inked.reduce((a, b) => (b[1] > a[1] ? b : a));
	const below = inked.filter(([y]) => y > widest[0]);
	let neck = bottom;
	let narrowest = Infinity;
	for (const [y, w] of below) {
		if (w < narrowest) {
			narrowest = w;
			neck = y;
		} else if (w > narrowest * 1.25) {
			break; // flaring back out — the neck is behind us
		}
	}

	let minX = Infinity;
	let maxX = -1;
	for (let y = top; y <= neck; y++) {
		for (let x = 0; x < info.width; x++) {
			if (data[y * info.width + x] > 128) {
				if (x < minX) minX = x;
				if (x > maxX) maxX = x;
			}
		}
	}

	const cx = Math.round((minX + maxX) / 2);
	const cy = Math.round((top + neck) / 2);
	const side = Math.round(Math.max(maxX - minX, neck - top) * 1.1);
	const left = Math.max(0, Math.min(info.width - side, Math.round(cx - side / 2)));
	const topCrop = Math.max(0, Math.min(info.height - side, Math.round(cy - side / 2)));

	console.log(`source ${info.width}x${info.height}`);
	console.log(`head   y ${top}..${neck}  x ${minX}..${maxX}`);
	console.log(`crop   ${side}x${side} at ${left},${topCrop}`);

	const square = await sharp(SRC)
		.extract({ left, top: topCrop, width: side, height: side })
		.toBuffer();

	for (const [name, size] of Object.entries(PNGS)) {
		const out = path.join(PUBLIC, name);
		await sharp(square).resize(size, size, { kernel: "lanczos3" }).png({ compressionLevel: 9 }).toFile(out);
		console.log(`  ${name.padEnd(30)} ${size}x${size}  ${(fs.statSync(out).size / 1024).toFixed(1)}KB`);
	}

	const icoEntries = [];
	for (const size of ICO_SIZES) {
		icoEntries.push({
			size,
			data: await sharp(square).resize(size, size, { kernel: "lanczos3" }).png({ compressionLevel: 9 }).toBuffer(),
		});
	}
	const ico = path.join(PUBLIC, "favicon.ico");
	fs.writeFileSync(ico, buildIco(icoEntries));
	console.log(`  ${"favicon.ico".padEnd(30)} ${ICO_SIZES.join("/")}  ${(fs.statSync(ico).size / 1024).toFixed(1)}KB`);
})();
