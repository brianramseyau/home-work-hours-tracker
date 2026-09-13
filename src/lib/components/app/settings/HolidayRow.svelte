<script lang="ts">
	import { enhance } from '$app/forms';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';

	interface HolidayData {
		id: number;
		name: string;
		source: 'bundled' | 'custom';
		disabled: boolean;
		displayDate: string;
	}

	let { holiday }: { holiday: HolidayData } = $props();

	function formatDate(iso: string): string {
		const [year, month, day] = iso.split('-').map(Number);
		return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			timeZone: 'UTC'
		});
	}
</script>

<div
	class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b py-3 last:border-b-0"
>
	<div class="flex items-baseline gap-3">
		<span class="text-sm text-muted-foreground tabular">{formatDate(holiday.displayDate)}</span>
		<span class={holiday.disabled ? 'text-muted-foreground line-through' : ''}>{holiday.name}</span>
		<Badge variant={holiday.source === 'bundled' ? 'secondary' : 'outline'}>
			{holiday.source === 'bundled' ? 'Bundled' : 'Custom'}
		</Badge>
	</div>
	<div class="flex gap-2">
		<form method="POST" action="?/holidayToggle" use:enhance>
			<input type="hidden" name="id" value={holiday.id} />
			<input type="hidden" name="disabled" value={holiday.disabled ? 'false' : 'true'} />
			<Button type="submit" variant="outline" size="sm">
				{holiday.disabled ? 'Enable' : 'Disable'}
			</Button>
		</form>
		{#if holiday.source === 'custom'}
			<form method="POST" action="?/holidayDelete" use:enhance>
				<input type="hidden" name="id" value={holiday.id} />
				<Button type="submit" variant="outline" size="sm">Delete</Button>
			</form>
		{/if}
	</div>
</div>
