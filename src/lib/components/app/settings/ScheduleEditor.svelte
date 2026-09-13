<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as ToggleGroup from '$lib/components/ui/toggle-group';
	import { mondayOf } from '$lib/core/date';
	import { firstFieldError } from '$lib/core/validation';

	interface OfficeOption {
		id: number;
		name: string;
	}

	type Mode = 'home' | 'office' | 'off';
	interface Cell {
		mode: Mode;
		officeId: number | null;
	}

	let {
		offices,
		includeWeekends,
		today
	}: { offices: OfficeOption[]; includeWeekends: boolean; today: string } = $props();

	const WEEKDAY_LABELS: { weekday: number; label: string }[] = [
		{ weekday: 1, label: 'Mon' },
		{ weekday: 2, label: 'Tue' },
		{ weekday: 3, label: 'Wed' },
		{ weekday: 4, label: 'Thu' },
		{ weekday: 5, label: 'Fri' },
		{ weekday: 6, label: 'Sat' },
		{ weekday: 7, label: 'Sun' }
	];

	let cycleWeeks = $state<'1' | '2'>('1');
	// Seeded once from the server's "today"; the date input then owns this draft state.
	let effectiveFrom = $state(untrack(() => today));

	const weekdays = $derived(includeWeekends ? WEEKDAY_LABELS : WEEKDAY_LABELS.slice(0, 5));
	const weekIndexes = $derived(cycleWeeks === '2' ? [0, 1] : [0]);

	function defaultCell(weekday: number): Cell {
		return { mode: weekday <= 5 ? 'home' : 'off', officeId: null };
	}

	let cells = $state<Record<string, Cell>>({});

	function cellKey(weekIndex: number, weekday: number): string {
		return `${weekIndex}-${weekday}`;
	}

	function cellFor(weekIndex: number, weekday: number): Cell {
		const key = cellKey(weekIndex, weekday);
		return cells[key] ?? defaultCell(weekday);
	}

	function setMode(weekIndex: number, weekday: number, mode: Mode) {
		// Only reached from a non-office mode (re-selecting an already-active toggle item is a
		// no-op), so the cell's own officeId is always null already — default to the first
		// office instead of carrying anything forward. The "Office" toggle is disabled whenever
		// there are no offices, so offices[0] exists on every real click; the fallback below is
		// belt-and-suspenders for a disabled native button somehow still firing (can't be
		// exercised through Playwright — a real `disabled` button doesn't dispatch a click event
		// even with `force: true`, confirmed empirically). `scheduleSchema` is the actual
		// enforcement against a crafted request that skips the UI entirely.
		cells[cellKey(weekIndex, weekday)] = {
			mode,
			/* v8 ignore next */
			officeId: mode === 'office' ? (offices[0]?.id ?? null) : null
		};
	}

	function setOffice(weekIndex: number, weekday: number, officeId: number) {
		cells[cellKey(weekIndex, weekday)] = { mode: 'office', officeId };
	}

	const daysJson = $derived(
		JSON.stringify(
			weekIndexes.flatMap((weekIndex) =>
				weekdays.map(({ weekday }) => ({ weekIndex, weekday, ...cellFor(weekIndex, weekday) }))
			)
		)
	);

	const anchorMonday = $derived(mondayOf(effectiveFrom || today));

	const error = $derived(
		page.form && (page.form as { form?: string }).form === 'schedule'
			? firstFieldError((page.form as { errors?: Record<string, string[] | undefined> }).errors)
			: null
	);
</script>

<!-- See GeneralTab.svelte: without this, SvelteKit's post-submit auto-reset would blank the
     bound effective-from date and cycle-length toggle back to nothing, rather than leaving the
     just-submitted schedule visible. -->
<form
	method="POST"
	action="?/schedule"
	use:enhance
	onreset={(event) => event.preventDefault()}
	class="flex flex-col gap-4"
>
	<div class="flex flex-wrap items-end gap-4">
		<div class="flex flex-col gap-1">
			<Label for="schedule-effective-from">Effective from</Label>
			<Input
				id="schedule-effective-from"
				name="effectiveFrom"
				type="date"
				bind:value={effectiveFrom}
			/>
		</div>
		<div class="flex flex-col gap-1">
			<span class="text-sm font-medium">Cycle length</span>
			<!-- onValueChange, not bind:value: re-clicking the active item is a bits-ui deselect
			     that would otherwise write an empty cycleWeeks (the mode/office groups below guard
			     the same way). -->
			<ToggleGroup.Root
				type="single"
				value={cycleWeeks}
				onValueChange={(value) => {
					if (value) cycleWeeks = value as '1' | '2';
				}}
				class="justify-start"
			>
				<ToggleGroup.Item value="1" aria-label="Every week">Every week</ToggleGroup.Item>
				<ToggleGroup.Item value="2" aria-label="Alternating fortnight">
					Alternating fortnight
				</ToggleGroup.Item>
			</ToggleGroup.Root>
		</div>
	</div>

	<div class="flex flex-col gap-3">
		{#each weekIndexes as weekIndex (weekIndex)}
			{#if cycleWeeks === '2'}
				<p class="text-sm font-medium">{weekIndex === 0 ? 'Week A' : 'Week B'}</p>
			{/if}
			<div class="flex flex-wrap gap-3">
				{#each weekdays as { weekday, label } (weekday)}
					{@const cell = cellFor(weekIndex, weekday)}
					<div class="flex flex-col gap-1.5">
						<span class="text-xs text-muted-foreground">{label}</span>
						<ToggleGroup.Root
							type="single"
							value={cell.mode}
							onValueChange={(value) => {
								if (value) setMode(weekIndex, weekday, value as Mode);
							}}
						>
							<ToggleGroup.Item value="home" aria-label={`${label} home`} size="sm">
								Home
							</ToggleGroup.Item>
							<ToggleGroup.Item
								value="office"
								aria-label={`${label} office`}
								disabled={offices.length === 0}
								size="sm"
							>
								Office
							</ToggleGroup.Item>
							<ToggleGroup.Item value="off" aria-label={`${label} off`} size="sm">
								Off
							</ToggleGroup.Item>
						</ToggleGroup.Root>
						{#if cell.mode === 'office'}
							<!-- A ToggleGroup, not a native <select>: a dynamic
							     <option value={expr}> picks up an unreachable compiler-inserted
							     null-coalescing branch that no rewrite of the expression avoids
							     — see AGENTS.md §5. This reuses the same widget as the mode
							     control above, which has no such issue. -->
							<!-- offices.length is never 0 and cell.officeId is never null here: the
							     "Office" toggle above is disabled whenever there are no offices, so
							     mode can only become 'office' when there's at least one to default
							     to (setMode). No placeholder branch is needed. -->
							<ToggleGroup.Root
								type="single"
								value={String(cell.officeId)}
								aria-label={`${label} office location`}
								onValueChange={(value) => {
									if (value) setOffice(weekIndex, weekday, Number(value));
								}}
							>
								{#each offices as office (office.id)}
									<ToggleGroup.Item value={String(office.id)} size="sm">
										{office.name}
									</ToggleGroup.Item>
								{/each}
							</ToggleGroup.Root>
						{/if}
					</div>
				{/each}
			</div>
		{/each}
	</div>

	<input type="hidden" name="cycleWeeks" value={cycleWeeks} />
	<input type="hidden" name="anchorMonday" value={anchorMonday} />
	<input type="hidden" name="days" value={daysJson} />

	{#if error}
		<p class="text-sm text-destructive" role="alert">{error}</p>
	{/if}

	<Button type="submit" class="self-start">Save schedule</Button>
</form>
