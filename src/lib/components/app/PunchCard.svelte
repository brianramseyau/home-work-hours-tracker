<script lang="ts">
	import TypeSwatch from './TypeSwatch.svelte';
	import { displayTypeLabel } from '$lib/core/dayType';
	import type { DiaryDay } from '$lib/core/diary';
	import { formatHours } from '$lib/core/time';

	let { weeks, onSelectDay }: { weeks: DiaryDay[][]; onSelectDay?: (date: string) => void } =
		$props();

	// The one orchestrated motion (DESIGN.md): cells fill in week order over ~600ms on first
	// load. `prefers-reduced-motion` is handled globally (layout.css collapses every animation
	// duration to near-zero), so this animation itself doesn't need its own media query.
	const cellIndex = $derived(new Map(weeks.flat().map((day, index) => [day.date, index])));
	const delayStep = $derived(600 / Math.max(cellIndex.size, 1));

	function describe(day: DiaryDay): string {
		const label = displayTypeLabel(day.displayType);
		return day.homeMinutes > 0
			? `${day.date}, ${label}, ${formatHours(day.homeMinutes)} h`
			: `${day.date}, ${label}`;
	}
</script>

<!-- Weeks stack vertically on mobile (each a horizontal row of weekdays) and lay out
     horizontally on desktop (each a vertical column) — see DESIGN.md → the FY punch card. -->
<div
	class="flex flex-col gap-1 lg:flex-row lg:overflow-x-auto lg:pb-2"
	role="grid"
	aria-label="Financial year punch card"
>
	{#each weeks as week (week[0].week)}
		<div class="flex gap-1 lg:flex-col" role="row">
			{#each week as day (day.date)}
				<div role="gridcell" class="flex">
					<button
						type="button"
						class="punch-cell size-3.5 rounded-[3px] outline-none focus-visible:ring-2 focus-visible:ring-ring lg:size-3"
						style={`animation-delay: ${cellIndex.get(day.date)! * delayStep}ms`}
						onclick={() => onSelectDay?.(day.date)}
						title={describe(day)}
						aria-label={describe(day)}
					>
						<TypeSwatch type={day.displayType} future={day.status === 'future'} class="size-full" />
					</button>
				</div>
			{/each}
		</div>
	{/each}
</div>

<style>
	@keyframes punch-fill {
		from {
			opacity: 0;
			transform: scale(0.5);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}
	.punch-cell {
		animation: punch-fill 200ms ease-out both;
	}
</style>
