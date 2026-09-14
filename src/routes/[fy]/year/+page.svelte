<script lang="ts">
	import { pushState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Legend from '$lib/components/app/Legend.svelte';
	import MonthBreakdown from '$lib/components/app/MonthBreakdown.svelte';
	import PunchCard from '$lib/components/app/PunchCard.svelte';
	import SummaryPanel from '$lib/components/app/SummaryPanel.svelte';
	import { displayTypeLabel, DISPLAY_TYPES } from '$lib/core/dayType';
	import { countsByDisplayType, groupDiaryDaysByWeek } from '$lib/core/diary';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const weeks = $derived(groupDiaryDaysByWeek(data.days));
	const counts = $derived(countsByDisplayType(data.days));
	const rateCentsPerHour = $derived(data.year?.rateCentsPerHour ?? null);

	function openDay(date: string) {
		pushState(resolve('/[fy]/day/[date]', { fy: data.fy.slug, date }), { dayDate: date });
	}
</script>

<svelte:head>
	<title>{`Year — ${data.fy.label}`}</title>
</svelte:head>

<div class="flex flex-col gap-8">
	<div class="flex flex-wrap items-start justify-between gap-6">
		<h1 class="font-display text-2xl font-semibold">{`${data.fy.label} year`}</h1>
		<SummaryPanel
			homeMinutes={data.summary.homeMinutes}
			claimCents={data.claimCents}
			{rateCentsPerHour}
		/>
	</div>

	<section class="flex flex-col gap-3">
		<PunchCard {weeks} onSelectDay={openDay} />
		<Legend />
	</section>

	<section class="grid gap-8 lg:grid-cols-2">
		<div>
			<h2 class="mb-3 font-display text-lg font-semibold">Monthly breakdown</h2>
			<MonthBreakdown
				startYear={data.fy.startYear}
				byMonth={data.summary.byMonth}
				{rateCentsPerHour}
			/>
		</div>
		<div>
			<h2 class="mb-3 font-display text-lg font-semibold">Days by type</h2>
			<dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
				{#each DISPLAY_TYPES as type (type)}
					<div>
						<dt class="text-muted-foreground">{displayTypeLabel(type)}</dt>
						<dd class="font-medium tabular">{counts[type]}</dd>
					</div>
				{/each}
			</dl>
		</div>
	</section>
</div>
