<script lang="ts">
	import { page } from '$app/state';
	import lampOff from '$lib/assets/lamp-off.svg?raw';
	import { Button } from '$lib/components/ui/button';

	const notFound = $derived(page.status === 404);
	const heading = $derived(notFound ? 'This page is off the clock' : 'Something went wrong');
	const detail = $derived(
		notFound
			? `There's nothing at ${page.url.pathname}. The link may be wrong, or the page has moved.`
			: (page.error?.message ?? 'An unexpected error stopped this page from loading.')
	);
</script>

<svelte:head>
	<title>{`${heading}`}</title>
</svelte:head>

<section class="mx-auto flex max-w-2xl flex-col items-start gap-5 py-6 lg:py-16">
	<span class="block size-28 text-muted-foreground" aria-hidden="true">
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- trusted, bundled SVG asset -->
		{@html lampOff}
	</span>
	<p class="text-sm font-medium text-muted-foreground">
		Error <span data-numeric>{page.status}</span>
	</p>
	<h1 class="font-display text-4xl font-semibold tracking-tight text-balance lg:text-5xl">
		{heading}
	</h1>
	<p class="max-w-prose text-lg text-pretty text-muted-foreground">{detail}</p>
	<Button href="/">Back to your diary</Button>
</section>
