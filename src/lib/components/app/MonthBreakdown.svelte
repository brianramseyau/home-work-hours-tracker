<script lang="ts">
	import { monthLabel, monthsInFy } from '$lib/core/fy';
	import { formatHours } from '$lib/core/time';
	import { claimCentsByGroup } from '$lib/core/totals';

	let {
		startYear,
		byMonth,
		rateCentsPerHour
	}: {
		startYear: number;
		byMonth: { month: string; minutes: number }[];
		rateCentsPerHour: number | null;
	} = $props();

	const minutesByMonth = $derived(new Map(byMonth.map((row) => [row.month, row.minutes])));
	const maxMinutes = $derived(Math.max(1, ...byMonth.map((row) => row.minutes)));

	// Rounded once per month independently, the 12 figures can disagree with the year's own
	// rounded claim (AGENTS.md: round once, at the end) — claimCentsByGroup distributes the
	// rounding so the months always sum to exactly that year total.
	const months = $derived(monthsInFy(startYear));
	const claimsByMonth = $derived.by(() => {
		if (rateCentsPerHour === null) return null;
		const minutesInOrder = months.map((month) => minutesByMonth.get(month) ?? 0);
		const claims = claimCentsByGroup(minutesInOrder, rateCentsPerHour);
		return new Map(months.map((month, index) => [month, claims[index]]));
	});

	function formatDollars(cents: number): string {
		return `$${(cents / 100).toFixed(2)}`;
	}
</script>

<table class="w-full text-sm">
	<caption class="sr-only">Home hours and claim by month</caption>
	<thead>
		<tr class="text-left text-xs text-muted-foreground">
			<th scope="col" class="py-1 pr-2 font-normal">Month</th>
			<th scope="col" class="py-1 pr-2 font-normal">Home hours</th>
			<th scope="col" class="py-1 font-normal">Claim</th>
		</tr>
	</thead>
	<tbody>
		{#each monthsInFy(startYear) as month (month)}
			{@const minutes = minutesByMonth.get(month) ?? 0}
			<tr class="border-t">
				<th scope="row" class="py-1.5 pr-2 text-left font-normal">{monthLabel(month)}</th>
				<td class="py-1.5 pr-2">
					<div class="flex items-center gap-2">
						<span class="h-2 w-16 overflow-hidden rounded-full bg-muted">
							<span
								class="block h-full rounded-full bg-lamp"
								style={`width: ${(minutes / maxMinutes) * 100}%`}
							></span>
						</span>
						<span class="tabular">{`${formatHours(minutes)} h`}</span>
					</div>
				</td>
				<td class="py-1.5 tabular">
					{claimsByMonth !== null ? formatDollars(claimsByMonth.get(month)!) : '—'}
				</td>
			</tr>
		{/each}
	</tbody>
</table>
