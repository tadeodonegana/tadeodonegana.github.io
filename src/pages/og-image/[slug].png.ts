import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { APIContext, GetStaticPaths } from "astro";
import { getEntryBySlug } from "astro:content";
import { html } from "satori-html";
import { siteConfig } from "@/site-config";
import { getAllPosts, getFormattedDate } from "@/utils";
import { coverArt, ogColors, pngResponse, renderPng } from "../../utils/ogImage";

const siteHost = new URL(import.meta.env.SITE ?? "https://tadeodonegana.com/").host;

type Art = Awaited<ReturnType<typeof coverArt>>;

// The cover's source file, from the post's frontmatter (coverImage.src is
// relative to the post). The parsed data only has the processed image URL,
// which in a build points at a hashed copy rather than the file on disk.
async function coverFile(postId: string) {
	const file = join(process.cwd(), "src/content/post", postId);
	const match = (await readFile(file, "utf8")).match(
		/^coverImage:\s*\n(?:[ \t]+.*\n)*?[ \t]+src:\s*["']?([^"'\n]+)["']?/m,
	);
	return match ? join(dirname(file), match[1]!.trim()) : null;
}

// The post's own cover drawing on top, as on the post page, then the title.
// The footer is the name and the domain: the name is the mark, so no avatar.
//
// satori-html escapes interpolated strings as text, so markup can't be spliced
// in conditionally; a post without a cover hides the art row instead, and
// gets a 1px transparent placeholder so the img still has a source.
const NO_ART: Art = {
	src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
	width: 1,
	height: 1,
};

const markup = (title: string, pubDate: string, art: Art | null) =>
	html`<div tw="flex flex-col w-full h-full bg-[${ogColors.bg}] text-[${ogColors.body}]">
		<div tw="${art ? "flex" : "hidden"} w-full h-[300px] items-center justify-center pt-10">
			<img
				src="${(art ?? NO_ART).src}"
				width="${(art ?? NO_ART).width}"
				height="${(art ?? NO_ART).height}"
			/>
		</div>
		<div tw="flex flex-col flex-1 w-full px-16 justify-center">
			<p tw="text-xl mb-4 text-[${ogColors.muted}]">${pubDate}</p>
			<h1 tw="m-0 ${art ? "text-5xl" : "text-6xl"} font-bold leading-tight text-[${ogColors.title}]">
				${title}
			</h1>
		</div>
		<div
			tw="flex items-center justify-between w-full px-16 py-8 border-t border-[${ogColors.divider}] text-xl"
		>
			<p tw="m-0 font-bold text-[${ogColors.title}]">${siteConfig.author}</p>
			<p tw="m-0 text-[${ogColors.muted}]">${siteHost}</p>
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
	const coverPath = post ? await coverFile(post.id) : null;
	const art = coverPath ? await coverArt(coverPath, 760, 220) : null;
	return pngResponse(await renderPng(markup(title, postDate, art)));
}

export const getStaticPaths: GetStaticPaths = async () => {
	const posts = await getAllPosts();
	return posts.filter(({ data }) => !data.ogImage).map(({ slug }) => ({ params: { slug } }));
};
