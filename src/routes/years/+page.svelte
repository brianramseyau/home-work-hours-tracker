<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import YearRow from '$lib/components/app/YearRow.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Financial years</title>
</svelte:head>

<div class="mx-auto max-w-2xl">
	<h1 class="font-display text-2xl font-semibold">Financial years</h1>
	<p class="mt-1 text-sm text-muted-foreground">
		Each year has its own ATO fixed rate. Finalise a year once its figures are locked in.
	</p>

	{#if data.years.length === 0}
		<p class="mt-8 text-sm text-muted-foreground">No financial years yet.</p>
	{:else}
		<div class="mt-6">
			{#each data.years as year (year.startYear)}
				<YearRow {year} />
			{/each}
		</div>
	{/if}

	<form method="POST" action="?/create" use:enhance class="mt-6">
		<Button type="submit" variant="outline">{`Add ${data.nextFy.label}`}</Button>
	</form>
</div>
