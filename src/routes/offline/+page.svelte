<script lang="ts">
	import lampOff from '$lib/assets/lamp-off.svg?raw';
	import { Button } from '$lib/components/ui/button';
</script>

<svelte:head>
	<title>You're offline</title>
</svelte:head>

<section class="mx-auto flex max-w-2xl flex-col items-start gap-5 py-6 lg:py-16">
	<span class="block size-28 text-muted-foreground" aria-hidden="true">
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- trusted, bundled SVG asset -->
		{@html lampOff}
	</span>
	<h1 class="font-display text-4xl font-semibold tracking-tight text-balance lg:text-5xl">
		You're offline
	</h1>
	<p class="max-w-prose text-lg text-pretty text-muted-foreground">
		Your diary will be here when you reconnect. Check your network connection and try again.
	</p>
	<Button href="/">Try again</Button>
</section>
