import type { APIContext, GetStaticPaths } from "astro";
import { getEntryBySlug } from "astro:content";
import satori, { type SatoriOptions } from "satori";
import { html } from "satori-html";
import { Resvg } from "@resvg/resvg-js";
import { siteConfig } from "@/site-config";
import { getAllPosts, getFormattedDate } from "@/utils";

import RobotoMono from "@/assets/roboto-mono-regular.ttf";
import RobotoMonoBold from "@/assets/roboto-mono-700.ttf";

const ogOptions: SatoriOptions = {
	width: 1200,
	height: 630,
	// debug: true,
	fonts: [
		{
			name: "Roboto Mono",
			data: Buffer.from(RobotoMono),
			weight: 400,
			style: "normal",
		},
		{
			name: "Roboto Mono",
			data: Buffer.from(RobotoMonoBold),
			weight: 700,
			style: "normal",
		},
	],
};

// Mirrors the site's monochrome dark palette (src/styles/global.css `:root.dark`).
// Satori runs at build time without a DOM, so it can't resolve the CSS variables
// and these have to be kept in sync by hand.
const ogColors = {
	bg: "#1d1f20", // --theme-bg        210deg 6% 12%
	title: "#ededed", // --theme-accent-2  0deg 0% 93%
	body: "#c8c9cb", // --theme-text      220deg 3% 79%
	muted: "#878a92", // dimmer step, for date + domain
	divider: "#3a3c41", // subtle hairline
};

const siteHost = new URL(import.meta.env.SITE ?? "https://tadeodonegana.com/").host;

const markup = (title: string, pubDate: string) =>
	html`<div tw="flex flex-col w-full h-full bg-[${ogColors.bg}] text-[${ogColors.body}]">
		<div tw="flex flex-col flex-1 w-full px-16 justify-center">
			<p tw="text-xl mb-5 text-[${ogColors.muted}]">${pubDate}</p>
			<h1 tw="text-6xl font-bold leading-tight text-[${ogColors.title}]">${title}</h1>
		</div>
		<div
			tw="flex items-center justify-between w-full px-16 py-10 border-t border-[${ogColors.divider}] text-xl"
		>
			<div tw="flex items-center">
				<img src="${siteConfig.logoUrl}" alt="" tw="w-12 h-12 rounded-full mr-4" />
				<p tw="font-medium text-[${ogColors.body}]">${siteConfig.author}</p>
			</div>
			<p tw="text-[${ogColors.muted}]">${siteHost}</p>
		</div>
	</div>`;

export async function GET({ params: { slug } }: APIContext) {
	const post = await getEntryBySlug("post", slug!);
	const title = post?.data.title ?? siteConfig.title;
	const postDate = getFormattedDate(
		post?.data.updatedDate ?? post?.data.publishDate ?? Date.now(),
		{
			weekday: "long",
			month: "long",
		},
	);
	const svg = await satori(markup(title, postDate), ogOptions);
	const png = new Resvg(svg).render().asPng();
	return new Response(png, {
		headers: {
			"Content-Type": "image/png",
			"Cache-Control": "public, max-age=31536000, immutable",
		},
	});
}

export const getStaticPaths: GetStaticPaths = async () => {
	const posts = await getAllPosts();
	return posts.filter(({ data }) => !data.ogImage).map(({ slug }) => ({ params: { slug } }));
};
