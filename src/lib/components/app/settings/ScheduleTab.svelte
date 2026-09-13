<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import type { Schedule } from '$lib/core/schedule';
	import ScheduleEditor from './ScheduleEditor.svelte';

	interface OfficeOption {
		id: number;
		name: string;
	}
	interface ScheduleWithId extends Schedule {
		id: number;
	}

	let {
		schedules,
		offices,
		includeWeekends,
		today
	}: {
		schedules: ScheduleWithId[];
		offices: OfficeOption[];
		includeWeekends: boolean;
		today: string;
	} = $props();

	function modeLabel(schedule: ScheduleWithId): string {
		return schedule.cycleWeeks === 2 ? 'Alternating fortnight' : 'Every week';
	}
</script>

<div class="flex max-w-xl flex-col gap-8">
	<div>
		<h2 class="mb-3 font-display text-lg font-semibold">Schedule versions</h2>
		{#if schedules.length === 0}
			<p class="text-sm text-muted-foreground">No schedule set yet — add one below.</p>
		{:else}
			<div>
				{#each schedules as schedule (schedule.id)}
					<div class="flex items-center justify-between gap-4 border-b py-3 last:border-b-0">
						<div>
							<p class="font-medium tabular">{`From ${schedule.effectiveFrom}`}</p>
							<p class="text-sm text-muted-foreground">{modeLabel(schedule)}</p>
						</div>
						<form method="POST" action="?/deleteSchedule" use:enhance>
							<input type="hidden" name="id" value={schedule.id} />
							<input type="hidden" name="effectiveFrom" value={schedule.effectiveFrom} />
							<Button type="submit" variant="outline" size="sm">Delete</Button>
						</form>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<div>
		<h2 class="mb-3 font-display text-lg font-semibold">New schedule version</h2>
		<ScheduleEditor {offices} {includeWeekends} {today} />
	</div>
</div>
