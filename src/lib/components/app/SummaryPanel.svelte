<script lang="ts">
	import { formatHours } from '$lib/core/time';

	let {
		homeMinutes,
		claimCents,
		rateCentsPerHour
	}: { homeMinutes: number; claimCents: number | null; rateCentsPerHour: number | null } = $props();

	function formatDollars(cents: number): string {
		return `$${(cents / 100).toFixed(2)}`;
	}
</script>

<div class="flex flex-col gap-0.5">
	<p class="font-display text-3xl leading-none font-semibold tabular lg:text-4xl">
		{`${formatHours(homeMinutes)} h at home`}
	</p>
	{#if claimCents !== null && rateCentsPerHour !== null}
		<p class="text-sm text-muted-foreground tabular">
			{`${formatDollars(claimCents)} at ${formatDollars(rateCentsPerHour)}/hr`}
		</p>
	{:else}
		<p class="text-sm text-muted-foreground">Set this year's rate in Years to see the claim.</p>
	{/if}
</div>
