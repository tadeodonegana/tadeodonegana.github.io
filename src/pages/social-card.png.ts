import { html } from "satori-html";
import { siteConfig } from "@/site-config";
import { OG_WIDTH, landscapeArt, ogColors, pngResponse, renderPng } from "../utils/ogImage";

// The social card for every page that is not a post (BaseHead falls back to
// /social-card.png). The name, what I do, and the footer's Sierras Bayas
// landscape across the bottom, the only picture that is on every page.

const siteHost = new URL(import.meta.env.SITE ?? "https://tadeodonegana.com/").host;

export async function GET() {
	const art = await landscapeArt(OG_WIDTH);
	const markup = html`<div
		tw="flex flex-col w-full h-full bg-[${ogColors.bg}] text-[${ogColors.body}]"
	>
		<div tw="flex flex-col flex-1 w-full px-16 justify-center">
			<h1 tw="m-0 text-6xl font-bold leading-tight text-[${ogColors.title}]">
				${siteConfig.author}
			</h1>
			<p tw="m-0 mt-6 text-2xl">AI Engineer. Member of Technical Staff at Taste Labs.</p>
			<p tw="m-0 mt-3 text-2xl text-[${ogColors.muted}]">${siteHost}</p>
		</div>
		<img src="${art.src}" width="${art.width}" height="${art.height}" />
	</div>`;
	return pngResponse(await renderPng(markup));
}
