<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Switch } from '$lib/components/ui/switch';
	import { blockMinutes, formatHours, validateBlock } from '$lib/core/time';

	interface SettingsData {
		fullName: string | null;
		holidayRegion: string;
		standardStart: string;
		standardEnd: string;
		standardBreakMinutes: number;
		includeWeekends: boolean;
	}

	let { settings }: { settings: SettingsData } = $props();

	// Seeded once from the loaded settings; the form then owns this draft state until submitted.
	let standardStart = $state(untrack(() => settings.standardStart));
	let standardEnd = $state(untrack(() => settings.standardEnd));
	let standardBreakMinutes = $state(untrack(() => settings.standardBreakMinutes));
	let includeWeekends = $state(untrack(() => settings.includeWeekends));

	// A number input's bound value is always a real number (an empty field binds to 0), so
	// there's no not-a-number case to guard here — only a genuinely invalid time span.
	const preview = $derived.by(() => {
		if (!standardStart || !standardEnd) return null;
		const block = { start: standardStart, end: standardEnd, breakMinutes: standardBreakMinutes };
		return validateBlock(block) === null ? formatHours(blockMinutes(block)) : null;
	});
</script>

<form
	method="POST"
	action="?/general"
	use:enhance
	onreset={(event) => event.preventDefault()}
	class="flex max-w-md flex-col gap-5"
>
	<!-- SvelteKit's default enhance behaviour resets the form after a successful submit, which
	     would wipe these bound fields back to blank (the browser's own post-reset default for a
	     JS-bound value, not the settings just saved) rather than leaving the just-saved values
	     showing. This is a persistent "current settings" form, not a "create another" one, so
	     the reset is never wanted here. -->
	<div class="flex flex-col gap-1.5">
		<Label for="fullName">Name</Label>
		<Input id="fullName" name="fullName" value={settings.fullName ?? ''} placeholder="John Doe" />
		<p class="text-xs text-muted-foreground">Shown on the accountant export. Optional.</p>
	</div>

	<div class="flex flex-col gap-1.5">
		<Label for="holidayRegion">Holiday region</Label>
		<!-- A plain, uncontrolled select: the browser owns which option is selected, so there's
		     no Svelte-side sync logic (and no reactivity needed — nothing else reads this value
		     before the form submits). The 8 AU states are a fixed list, spelled out rather than
		     looped: a templated `<option value={…}>` picks up an unreachable, compiler-inserted
		     null-coalescing branch that a static value attribute doesn't. -->
		<select
			id="holidayRegion"
			name="holidayRegion"
			class="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
		>
			<option value="AU-ACT" selected={settings.holidayRegion === 'AU-ACT'}>
				Australian Capital Territory
			</option>
			<option value="AU-NSW" selected={settings.holidayRegion === 'AU-NSW'}>New South Wales</option>
			<option value="AU-NT" selected={settings.holidayRegion === 'AU-NT'}>Northern Territory</option
			>
			<option value="AU-QLD" selected={settings.holidayRegion === 'AU-QLD'}>Queensland</option>
			<option value="AU-SA" selected={settings.holidayRegion === 'AU-SA'}>South Australia</option>
			<option value="AU-TAS" selected={settings.holidayRegion === 'AU-TAS'}>Tasmania</option>
			<option value="AU-VIC" selected={settings.holidayRegion === 'AU-VIC'}>Victoria</option>
			<option value="AU-WA" selected={settings.holidayRegion === 'AU-WA'}>Western Australia</option>
		</select>
	</div>

	<fieldset class="flex flex-col gap-1.5">
		<legend class="text-sm font-medium">Standard hours</legend>
		<div class="flex flex-wrap items-end gap-3">
			<div class="flex flex-col gap-1.5">
				<Label for="standardStart">Start</Label>
				<Input id="standardStart" name="standardStart" type="time" bind:value={standardStart} />
			</div>
			<div class="flex flex-col gap-1.5">
				<Label for="standardEnd">End</Label>
				<Input id="standardEnd" name="standardEnd" type="time" bind:value={standardEnd} />
			</div>
			<div class="flex flex-col gap-1.5">
				<Label for="standardBreakMinutes">Break (min)</Label>
				<Input
					id="standardBreakMinutes"
					name="standardBreakMinutes"
					type="number"
					min="0"
					class="w-24"
					bind:value={standardBreakMinutes}
				/>
			</div>
		</div>
		<p class="text-sm text-muted-foreground">
			{#if preview}
				{`= ${preview} h per day`}
			{:else}
				Enter a valid start, end and break to see the daily total.
			{/if}
		</p>
	</fieldset>

	<div class="flex items-center gap-3">
		<Switch id="includeWeekends" name="includeWeekends" bind:checked={includeWeekends} />
		<Label for="includeWeekends">Include weekends</Label>
	</div>

	<Button type="submit" class="self-start">Save general settings</Button>
</form>
