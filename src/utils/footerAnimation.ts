// Animates the pixel-art footer on a canvas laid over the static image, on the
// same pixel grid and in the same greys: drifting clouds, smoke from the
// chimney, blinking antenna tips, glints on the lake and the odd pair of birds.
// Positions and palette come from scripts/footer-landscape.mjs.
//
// Motion is stepped at a low frame rate, like the art. Nothing runs while the
// footer is off screen or the tab is hidden, and with reduced motion only the
// clouds are drawn, standing still.
import art from "../data/footer-landscape.json";

type Theme = (typeof art.themes)["light"];
type ThemeName = keyof typeof art.themes;

const FPS = 12;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (a: number, b: number, x: number) => {
	const t = clamp((x - a) / (b - a));
	return t * t * (3 - 2 * t);
};

// Darkness d (0 white, 1 black) and haze h (1 = page background), snapped to
// the theme's greys exactly as the generator does, so drawn pixels match.
function makeColour(theme: Theme) {
	const greys = [theme.bg];
	for (let i = 0; i < theme.steps; i++)
		greys.push(theme.black.map((c, k) => lerp(c, theme.white[k]!, i / (theme.steps - 1))));
	const cache = new Map<string, string | null>();
	return (d: number, h: number): string | null => {
		const key = `${Math.round(d * 50)}:${Math.round(h * 50)}`;
		let hit = cache.get(key);
		if (hit !== undefined) return hit;
		if (h >= 0.995) hit = null;
		else {
			const mixed = theme.black[0]! + (theme.white[0]! - theme.black[0]!) * (1 - d);
			const v = lerp(mixed, theme.bg[0]!, h);
			const g = greys.reduce((best, g) =>
				Math.abs(g[0]! - v) < Math.abs(best[0]! - v) ? g : best,
			);
			// The background grey means "nothing to draw".
			hit = g === theme.bg ? null : `rgb(${g.map(Math.round).join(",")})`;
		}
		cache.set(key, hit);
		return hit;
	};
}

interface Smoke {
	born: number;
	seed: number;
}
interface Glint {
	born: number;
	y: number;
	x: number;
	len: number;
	life: number;
}

export function initFooterAnimation(root: HTMLElement) {
	const canvas = root.querySelector("canvas");
	const ctx = canvas?.getContext("2d");
	if (!canvas || !ctx) return;

	const reduce = matchMedia("(prefers-reduced-motion: reduce)");
	const xl = matchMedia("(min-width: 1280px)");
	const wideAllowed = root.dataset.wide === "true";

	let left = art.OX;
	let width = art.NARROW;
	const colours: Record<ThemeName, ReturnType<typeof makeColour>> = {
		light: makeColour(art.themes.light),
		dark: makeColour(art.themes.dark),
	};
	let theme: ThemeName = "light";

	const readTheme = () => {
		theme = document.documentElement.classList.contains("dark") ? "dark" : "light";
	};
	const layout = () => {
		const wide = wideAllowed && xl.matches;
		left = wide ? 0 : art.OX;
		width = wide ? art.W : art.NARROW;
		canvas.width = width;
		canvas.height = art.H;
	};

	// Plot one pixel given in full-canvas coordinates, with the side-edge fade.
	const plot = (x: number, y: number, d: number, h: number) => {
		const lx = Math.round(x) - left;
		const ly = Math.round(y);
		if (lx < 0 || lx >= width || ly < 0 || ly >= art.H) return;
		const edge = 1 - smooth(0, art.EDGE, Math.min(lx, width - 1 - lx));
		const c = colours[theme](d, Math.max(h, edge));
		if (!c) return;
		ctx.fillStyle = c;
		ctx.fillRect(lx, ly, 1, 1);
	};

	// ---------------------------------------------------------------- layers

	const span = art.W + 120;
	const drawClouds = (t: number) => {
		art.clouds.forEach((c, i) => {
			// About one pixel every two seconds, wrapping across the whole sky.
			const drift = (t / 2000) * (i ? 0.8 : 1);
			const cx = ((((c.x + drift + 60) % span) + span) % span) - 60;
			for (let row = 0; row < 2; row++) {
				const half = Math.round(((c.w / 2) * (1 - row * 0.4)) / 2) * 2;
				for (let x = -half; x < half; x++) plot(cx + x, c.y - row, 0.2, 0.86 - row * 0.03);
			}
		});
	};

	const smoke: Smoke[] = [];
	let nextPuff = 0;
	const SMOKE_LIFE = 7000;
	const drawSmoke = (t: number) => {
		if (t >= nextPuff) {
			smoke.push({ born: t, seed: Math.random() * 10 });
			nextPuff = t + 650 + Math.random() * 500;
		}
		const src = art.smoke[0]!;
		for (let i = smoke.length - 1; i >= 0; i--) {
			const p = smoke[i]!;
			const age = (t - p.born) / 1000;
			if (age * 1000 > SMOKE_LIFE) {
				smoke.splice(i, 1);
				continue;
			}
			const life = (age * 1000) / SMOKE_LIFE;
			// Rises, then leans into a wind from the left.
			const x = src.x + age * age * 0.45 + Math.sin(age * 1.3 + p.seed) * 0.8;
			const y = src.y - age * 2.4;
			const h = lerp(0.12, 0.95, Math.pow(life, 0.7));
			const d = 0.45;
			plot(x, y, d, h);
			if (age > 1.2) plot(x + 1, y, d, h + 0.04);
			if (age > 2.6) {
				plot(x, y - 1, d, h + 0.06);
				plot(x - 1, y, d, h + 0.08);
			}
		}
	};

	const drawAntennas = (t: number) => {
		art.antennas.forEach((a, i) => {
			const phase = (t + i * 1100) % 3200;
			if (phase > 420) return;
			// A light reads as the strongest contrast against the page.
			const d = theme === "dark" ? 0 : 1;
			plot(a.x, a.y, d, 0.05);
			if (phase < 180) {
				plot(a.x - 1, a.y, d, 0.65);
				plot(a.x + 1, a.y, d, 0.65);
				plot(a.x, a.y - 1, d, 0.65);
			}
		});
	};

	const glints: Glint[] = [];
	let nextGlint = 0;
	const drawGlints = (t: number) => {
		if (t >= nextGlint && glints.length < 5 && art.water.length) {
			const [y, x0, x1] = art.water[Math.floor(Math.random() * art.water.length)]!;
			const visible = Math.max(x0, left + 6);
			const end = Math.min(x1, left + width - 6);
			if (end - visible > 4) {
				const len = 2 + Math.floor(Math.random() * 3);
				const x = visible + Math.floor(Math.random() * (end - visible - len));
				glints.push({ born: t, y, x, len, life: 1800 + Math.random() * 1400 });
			}
			nextGlint = t + 350 + Math.random() * 700;
		}
		for (let i = glints.length - 1; i >= 0; i--) {
			const g = glints[i]!;
			const p = (t - g.born) / g.life;
			if (p >= 1) {
				glints.splice(i, 1);
				continue;
			}
			// Swells and fades in a few stepped greys.
			const h = lerp(0.85, 0.08, Math.sin(Math.PI * p));
			for (let k = 0; k < g.len; k++)
				plot(g.x + k, g.y, 0.1, h + (k === 0 || k === g.len - 1 ? 0.15 : 0));
		}
	};

	let bird: { born: number; y: number } | null = null;
	let nextBird = 4000 + Math.random() * 6000;
	const drawBirds = (t: number) => {
		if (!bird && t >= nextBird) bird = { born: t, y: 18 + Math.floor(Math.random() * 12) };
		if (!bird) return;
		const age = (t - bird.born) / 1000;
		const x = left - 8 + age * 7;
		if (x > left + width + 8) {
			bird = null;
			nextBird = t + 14000 + Math.random() * 14000;
			return;
		}
		const y = bird.y + Math.round(Math.sin(age * 0.9) * 1.5);
		const up = Math.floor(age * 4) % 2 === 0;
		// Dark silhouettes on a light sky, light ones on a dark sky.
		const d = theme === "dark" ? 0.25 : 0.65;
		for (const [ox, oy] of [
			[0, 0],
			[-6, 2],
		] as const) {
			const bx = x + ox;
			const by = y + oy;
			plot(bx, by, d, 0.3);
			plot(bx - 1, by - (up ? 1 : 0), d, 0.3);
			plot(bx + 1, by - (up ? 1 : 0), d, 0.3);
		}
	};

	// ---------------------------------------------------------------- loop

	let running = false;
	let visible = false;
	let raf = 0;
	let last = 0;
	const start = performance.now();

	const frame = (now: number) => {
		raf = requestAnimationFrame(frame);
		if (now - last < 1000 / FPS) return;
		last = now;
		const t = now - start;
		ctx.clearRect(0, 0, width, art.H);
		drawClouds(t);
		drawSmoke(t);
		drawAntennas(t);
		drawGlints(t);
		drawBirds(t);
	};

	const still = () => {
		ctx.clearRect(0, 0, width, art.H);
		drawClouds(0);
	};

	const update = () => {
		const should = visible && !document.hidden && !reduce.matches;
		if (should && !running) {
			running = true;
			raf = requestAnimationFrame(frame);
		} else if (!should && running) {
			running = false;
			cancelAnimationFrame(raf);
		}
		if (!running) still();
	};

	readTheme();
	layout();
	still();

	new MutationObserver(() => {
		readTheme();
		if (!running) still();
	}).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
	xl.addEventListener("change", () => {
		layout();
		if (!running) still();
	});
	reduce.addEventListener("change", update);
	document.addEventListener("visibilitychange", update);

	// Reveal once on first sight, and only animate while on screen.
	root.dataset.reveal = "pending";
	new IntersectionObserver(
		(entries) => {
			for (const e of entries) {
				visible = e.isIntersecting;
				if (visible) root.dataset.reveal = "shown";
			}
			update();
		},
		{ threshold: 0.15 },
	).observe(root);
}
