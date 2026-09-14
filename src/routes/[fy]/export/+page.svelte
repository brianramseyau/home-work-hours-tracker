<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import MonthBreakdown from '$lib/components/app/MonthBreakdown.svelte';
	import SummaryPanel from '$lib/components/app/SummaryPanel.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const rateCentsPerHour = $derived(data.rateCentsPerHour);
	const downloadHref = $derived(`/${data.fy.slug}/export/download`);
</script>

<svelte:head>
	<title>{`Export — ${data.fy.label}`}</title>
</svelte:head>

<div class="flex max-w-xl flex-col gap-6">
	<div>
		<h1 class="font-display text-2xl font-semibold">{`${data.fy.label} export`}</h1>
		<p class="mt-1 text-sm text-muted-foreground">
			A branded spreadsheet for your accountant, with a Summary sheet and a full Diary sheet of live
			formulas they can audit.
		</p>
	</div>

	{#if !data.fullName}
		<p class="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-muted-foreground">
			Your name isn't set, so the export will say "Name not set". Add it on the <a
				href="/settings"
				class="underline">General tab of Settings</a
			>.
		</p>
	{/if}

	{#if !data.finalised}
		<p class="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-muted-foreground">
			This year isn't finalised yet — you can still edit it, and the export will reflect any later
			changes.
		</p>
	{/if}

	<section class="flex flex-col gap-4 rounded-lg border border-border p-5">
		<SummaryPanel
			homeMinutes={data.summary.homeMinutes}
			claimCents={data.claimCents}
			{rateCentsPerHour}
		/>
		<MonthBreakdown
			startYear={data.fy.startYear}
			byMonth={data.summary.byMonth}
			{rateCentsPerHour}
		/>
	</section>

	<div class="flex flex-col items-start gap-2">
		<Button href={downloadHref} data-sveltekit-reload>Download spreadsheet</Button>
		<p class="text-sm text-muted-foreground">
			{`Includes a Summary sheet and a full Diary sheet for ${data.fy.label}.`}
		</p>
	</div>
</div>
