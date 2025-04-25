import type { WebmentionsFeed, WebmentionsCache, WebmentionsChildren } from "@/types";

// --- Constants ---
const DOMAIN = import.meta.env.SITE;
const API_TOKEN = import.meta.env.WEBMENTION_API_KEY;
const CACHE_DIR = ".data";
const filePath = `${CACHE_DIR}/webmentions.json`;
const validWebmentionTypes = ["like-of", "mention-of", "in-reply-to"];
const hostName = new URL(DOMAIN).hostname;

// --- Pure Functions (Safe for Client/Server) ---

// Fetches webmentions from the API
async function fetchWebmentions(
	timeFrom: string | null,
	perPage = 1000,
): Promise<WebmentionsFeed | null> {
	if (!DOMAIN) {
		console.warn("No domain specified. Please set in astro.config.ts");
		return null;
	}

	if (!API_TOKEN) {
		// Only log warning during build, not in client
		if (import.meta.env.SSR) {
			console.warn("No webmention api token specified in .env");
		}
		return null;
	}

	let url = `https://webmention.io/api/mentions.jf2?domain=${hostName}&token=${API_TOKEN}&sort-dir=up&per-page=${perPage}`;
	if (timeFrom) url += `&since=${timeFrom}`;

	try {
		const res = await fetch(url);
		if (res.ok) {
			const data = (await res.json()) as WebmentionsFeed;
			// Filter raw data immediately after fetch
			data.children = filterWebmentions(data.children || []);
			return data;
		} else {
			console.error(`Failed to fetch webmentions: ${res.status} ${res.statusText}`);
			return null;
		}
	} catch (error) {
		console.error("Error fetching webmentions:", error);
		return null;
	}
}

// Merges cached entries [a] with fresh webmentions [b], using wm-id
function mergeWebmentions(
	cachedChildren: WebmentionsChildren[],
	freshChildren: WebmentionsChildren[],
): WebmentionsChildren[] {
	const uniqueMap = new Map<number, WebmentionsChildren>();
	[...cachedChildren, ...freshChildren].forEach((obj) => {
		if (obj["wm-id"]) {
			// Ensure wm-id exists
			uniqueMap.set(obj["wm-id"], obj);
		}
	});
	return Array.from(uniqueMap.values());
}

// Filters webmentions based on type and content presence
export function filterWebmentions(webmentions: WebmentionsChildren[]): WebmentionsChildren[] {
	return webmentions.filter((webmention) => {
		if (!validWebmentionTypes.includes(webmention["wm-property"])) return false;

		if (webmention["wm-property"] === "mention-of" || webmention["wm-property"] === "in-reply-to") {
			return !!webmention.content?.text; // Check for truthiness and non-empty string
		}
		return true; // Keep likes/other valid types
	});
}

// --- Server-Only Functions (Using Node.js 'fs') ---

// This function uses Node features and should only run on the server.
// We dynamically import 'fs' to reinforce this.
async function performCacheOperations(): Promise<WebmentionsCache> {
	if (!import.meta.env.SSR) {
		// Should ideally never happen if called correctly, but acts as a safeguard
		console.error("Cache operations called in non-SSR environment!");
		return { lastFetched: null, children: [] };
	}

	// Dynamically import 'fs' only when needed on the server
	const fs = await import("node:fs");
	const path = await import("node:path"); // Use path for robust joining

	const cacheFilePath = path.join(CACHE_DIR, "webmentions.json"); // Use path.join

	// Read from cache
	let cachedData: WebmentionsCache = { lastFetched: null, children: [] };
	if (fs.existsSync(cacheFilePath)) {
		try {
			const data = fs.readFileSync(cacheFilePath, "utf-8");
			cachedData = JSON.parse(data);
			// Ensure children is always an array
			cachedData.children = cachedData.children || [];
		} catch (e) {
			console.error("Error reading or parsing webmention cache:", e);
			// Reset cache if corrupted
			cachedData = { lastFetched: null, children: [] };
		}
	}

	// Fetch new mentions
	const freshMentions = await fetchWebmentions(cachedData.lastFetched);

	// Merge and Write back to cache if new mentions were fetched
	if (freshMentions) {
		const mergedChildren = mergeWebmentions(cachedData.children, freshMentions.children);
		const newData: WebmentionsCache = {
			lastFetched: new Date().toISOString(),
			children: mergedChildren,
		};

		try {
			// Ensure cache directory exists
			if (!fs.existsSync(CACHE_DIR)) {
				fs.mkdirSync(CACHE_DIR, { recursive: true }); // Use recursive option
			}
			// Write data to cache json file
			fs.writeFileSync(cacheFilePath, JSON.stringify(newData, null, 2)); // Use writeFileSync for simplicity here
			// console.log(`Webmentions saved to ${cacheFilePath}`); // Less verbose logging
			return newData; // Return the updated data
		} catch (e) {
			console.error("Error writing webmention cache:", e);
			// Fallback to returning old cache + new mentions if write fails
			return { lastFetched: cachedData.lastFetched, children: mergedChildren };
		}
	}

	// If fetch failed or returned null, return the existing cached data
	return cachedData;
}

// --- Main Exported Function ---

// Use a simple in-memory cache *during the build* to avoid re-running logic for every page
let buildTimeCache: WebmentionsCache | null = null;

export async function getWebmentionsForUrl(url: string): Promise<WebmentionsChildren[]> {
	// Only perform cache operations during SSR (build time)
	if (import.meta.env.SSR && !buildTimeCache) {
		buildTimeCache = await performCacheOperations();
	}

	// Use build-time cache if available, otherwise return empty (or handle client-side if needed)
	const allMentions = buildTimeCache?.children || [];

	// Filter mentions for the specific target URL
	return allMentions.filter((entry) => entry["wm-target"] === url);
}

// Clear build-time cache if needed (e.g., for testing or specific scenarios)
export function clearBuildTimeCache() {
	buildTimeCache = null;
}
