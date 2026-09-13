<script lang="ts">
	import Logo from '$lib/components/app/Logo.svelte';
	import { Button } from '$lib/components/ui/button';
	import type { PageProps } from './$types';

	// Phase 01 welcome. Phase 04 replaces this with a redirect to the current year's diary.
	let { data }: PageProps = $props();
</script>

<section class="mx-auto flex max-w-2xl flex-col items-start gap-6 py-6 lg:py-16">
	<Logo class="size-20 lg:size-24" />
	<h1 class="font-display text-4xl font-semibold tracking-tight text-balance lg:text-6xl">
		Your hours at home, kept for tax time
	</h1>
	<p class="max-w-prose text-lg text-pretty text-muted-foreground">
		{`Set your standard hours and the days you usually work from home, and ${data.currentFy.label} fills itself in. Change any day when plans change.`}
	</p>
	<Button href="/years" size="lg">{`Set up ${data.currentFy.label}`}</Button>
</section>
