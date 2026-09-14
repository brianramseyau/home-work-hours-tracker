<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import * as ToggleGroup from '$lib/components/ui/toggle-group';
	import { Textarea } from '$lib/components/ui/textarea';
	import type { DisplayType, HomeBlock } from '$lib/core/dayType';
	import { firstFieldError } from '$lib/core/validation';

	export interface DayEditorDay {
		date: string;
		displayType: DisplayType;
		officeId: number | null;
		notes: string | null;
		blocks: HomeBlock[];
	}

	interface OfficeOption {
		id: number;
		name: string;
	}

	let {
		day,
		offices,
		standard,
		finalised,
		onSaved
	}: {
		day: DayEditorDay;
		offices: OfficeOption[];
		standard: HomeBlock;
		finalised: boolean;
		onSaved?: () => void;
	} = $props();

	const KIND_OPTIONS: { value: DisplayType; label: string }[] = [
		{ value: 'home', label: 'Home' },
		{ value: 'office', label: 'Office' },
		{ value: 'split', label: 'Split' },
		{ value: 'leave', label: 'Leave' },
		{ value: 'sick', label: 'Sick' },
		{ value: 'public_holiday', label: 'Holiday' },
		{ value: 'off', label: 'Off' }
	];

	let uiKind = $state(untrack(() => day.displayType));
	let officeId = $state(untrack(() => day.officeId));
	let notes = $state(untrack(() => day.notes ?? ''));
	let blocks = $state<{ start: string; end: string; breakMinutes: number | null }[]>(
		untrack(() => (day.blocks.length > 0 ? day.blocks.map((block) => ({ ...block })) : []))
	);
	// Snapshots page.form when this editor opens, so a result left over from a previous save on
	// this same date doesn't render as this fresh attempt's own outcome until it actually changes.
	const openedWithForm = untrack(() => page.form);

	// Re-seeds local state whenever the `day` prop itself changes — not just on mount. Without
	// this, the deep-link page (which has no `onSaved` and doesn't remount the editor on a
	// same-date result) kept showing stale type/notes/blocks after "Reset to schedule" or "Clear
	// day" reloaded `data.day`, even though the action had genuinely applied.
	$effect(() => {
		uiKind = day.displayType;
		officeId = day.officeId;
		notes = day.notes ?? '';
		blocks = day.blocks.length > 0 ? day.blocks.map((block) => ({ ...block })) : [];
	});

	const showsBlocks = $derived(uiKind === 'home' || uiKind === 'split');
	const showsOffice = $derived(uiKind === 'office' || uiKind === 'split');

	function setKind(next: DisplayType) {
		uiKind = next;
		// offices[0] always exists here: the Office and Split toggle items are disabled whenever
		// offices.length === 0 (a disabled native button doesn't dispatch a click event even via
		// Playwright's force:true, confirmed in ScheduleEditor's own equivalent picker), so a real
		// click can only ever reach this branch with at least one office to default to.
		if ((next === 'office' || next === 'split') && officeId === null) {
			officeId = offices[0].id;
		}
		if ((next === 'home' || next === 'split') && blocks.length === 0) {
			blocks = [{ ...standard }];
		}
	}

	function addBlock() {
		blocks = [
			...blocks,
			{ start: standard.start, end: standard.end, breakMinutes: standard.breakMinutes }
		];
	}

	function removeBlock(index: number) {
		blocks = blocks.filter((_, i) => i !== index);
	}

	const payloadKind = $derived(
		uiKind === 'home' || uiKind === 'office' || uiKind === 'split' ? 'work' : uiKind
	);
	const payloadOfficeId = $derived(showsOffice ? officeId : null);
	const payloadBlocks = $derived(showsBlocks ? blocks : []);
	const blocksJson = $derived(JSON.stringify(payloadBlocks));

	const result = $derived.by(() => {
		const form = page.form as {
			form?: string;
			date?: string;
			success?: boolean;
			errors?: Record<string, string[] | undefined>;
		} | null;
		return form && form.form === 'day' && form.date === day.date && form !== openedWithForm
			? form
			: null;
	});
	const error = $derived(result ? firstFieldError(result.errors) : null);

	$effect(() => {
		if (result?.success) onSaved?.();
	});
</script>

<div class="flex flex-col gap-5">
	<fieldset class="flex flex-col gap-2" disabled={finalised}>
		<legend class="text-sm font-medium">Type</legend>
		<ToggleGroup.Root
			type="single"
			value={uiKind}
			onValueChange={(value) => {
				if (value) setKind(value as DisplayType);
			}}
			class="flex-wrap justify-start"
		>
			{#each KIND_OPTIONS as option (option.value)}
				<ToggleGroup.Item
					value={option.value}
					disabled={(option.value === 'office' || option.value === 'split') && offices.length === 0}
					size="sm"
				>
					{option.label}
				</ToggleGroup.Item>
			{/each}
		</ToggleGroup.Root>
	</fieldset>

	{#if showsOffice}
		<fieldset class="flex flex-col gap-2" disabled={finalised}>
			<legend class="text-sm font-medium">Office</legend>
			<ToggleGroup.Root
				type="single"
				value={String(officeId)}
				onValueChange={(value) => {
					if (value) officeId = Number(value);
				}}
				class="flex-wrap justify-start"
			>
				{#each offices as office (office.id)}
					<ToggleGroup.Item value={String(office.id)} size="sm">{office.name}</ToggleGroup.Item>
				{/each}
			</ToggleGroup.Root>
		</fieldset>
	{/if}

	{#if showsBlocks}
		<fieldset class="flex flex-col gap-3" disabled={finalised}>
			<legend class="text-sm font-medium">Time blocks</legend>
			{#each blocks as block, index (index)}
				<div class="flex flex-wrap items-end gap-2">
					<div class="flex flex-col gap-1">
						<Label for={`block-start-${index}`}>Start</Label>
						<input
							id={`block-start-${index}`}
							type="time"
							bind:value={block.start}
							class="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm tabular outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
						/>
					</div>
					<div class="flex flex-col gap-1">
						<Label for={`block-end-${index}`}>End</Label>
						<input
							id={`block-end-${index}`}
							type="time"
							bind:value={block.end}
							class="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm tabular outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
						/>
					</div>
					<div class="flex flex-col gap-1">
						<Label for={`block-break-${index}`}>Break (min)</Label>
						<input
							id={`block-break-${index}`}
							type="number"
							min="0"
							bind:value={block.breakMinutes}
							class="h-8 w-20 rounded-lg border border-input bg-transparent px-2.5 text-sm tabular outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
						/>
					</div>
					{#if blocks.length > 1}
						<Button type="button" variant="ghost" size="sm" onclick={() => removeBlock(index)}>
							Remove
						</Button>
					{/if}
				</div>
			{/each}
			<Button type="button" variant="outline" size="sm" class="self-start" onclick={addBlock}>
				Add block
			</Button>
		</fieldset>
	{/if}

	<form
		method="POST"
		action="?/saveDay"
		use:enhance
		onreset={(event) => event.preventDefault()}
		class="flex flex-col gap-3"
	>
		<input type="hidden" name="date" value={day.date} />
		<input type="hidden" name="kind" value={payloadKind} />
		<input type="hidden" name="officeId" value={payloadOfficeId ?? ''} />
		<input type="hidden" name="blocks" value={blocksJson} />
		<div class="flex flex-col gap-1.5">
			<Label for="day-notes">Notes</Label>
			<Textarea id="day-notes" name="notes" bind:value={notes} disabled={finalised} rows={2} />
		</div>

		{#if error}
			<p class="text-sm text-destructive" role="alert">{error}</p>
		{/if}

		<div class="flex flex-wrap gap-2">
			<Button type="submit" disabled={finalised}>Save day</Button>
		</div>
	</form>

	<div class="flex flex-wrap gap-2 border-t pt-4">
		<form method="POST" action="?/resetDay" use:enhance>
			<input type="hidden" name="date" value={day.date} />
			<Button type="submit" variant="outline" size="sm" disabled={finalised}>
				Reset to schedule
			</Button>
		</form>
		<form method="POST" action="?/clearDay" use:enhance>
			<input type="hidden" name="date" value={day.date} />
			<Button type="submit" variant="ghost" size="sm" disabled={finalised}>Clear day</Button>
		</form>
	</div>

	{#if finalised}
		<p class="text-sm text-muted-foreground">
			This financial year is finalised. <a href="/years" class="underline">Unfinalise it</a> to make changes.
		</p>
	{/if}
</div>
