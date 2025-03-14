import type { SiteConfig } from "@/types";

export const siteConfig: SiteConfig = {
	// Used as both a meta property (src/components/BaseHead.astro L:31 + L:49) & the generated satori png (src/pages/og-image/[slug].png.ts)
	author: "Tadeo Donegana Braunschweig",
	// Meta property used to construct the meta title property, found in src/components/BaseHead.astro L:11
	title: "Tadeo Donegana Braunschweig - Software Engineer",
	// Meta property used as the default description meta property
	description:
		"I am Tadeo Donegana Braunschweig, a software engineer currently working at Lemon Cash. " +
		"I am also pursuing a bachelor's degree in AI at the University of Palermo. " +
		"Here, I like to talk about artificial intelligence and engineering in general.",
	// HTML lang property, found in src/layouts/Base.astro L:18
	lang: "en-US",
	// Meta property, found in src/components/BaseHead.astro L:42
	ogLocale: "en_US",
	logoUrl: "https://avatars.githubusercontent.com/u/75747222?v=4",
	// Date.prototype.toLocaleDateString() parameters, found in src/utils/date.ts.
	date: {
		locale: "en-US",
		options: {
			day: "numeric",
			month: "short",
			year: "numeric",
		},
	},
	webmentions: {
		link: "",
	},
};

// Used to generate links in both the Header & Footer.
export const menuLinks: Array<{ title: string; path: string }> = [
	{
		title: "Home",
		path: "/",
	},
	{
		title: "About",
		path: "/about/",
	},
	{
		title: "Blog",
		path: "/posts/",
	},
];
