<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as ToggleGroup from '$lib/components/ui/toggle-group';
	import { firstFieldError } from '$lib/core/validation';

	let { today, finalised }: { today: string; finalised: boolean } = $props();

	let open = $state(false);
	let from = $state(untrack(() => today));
	let to = $state(untrack(() => today));
	let kind = $state<'leave' | 'sick'>('leave');
	let note = $state('');
	let openedWithForm = $state<unknown>(null);

	function openDialog() {
		openedWithForm = page.form;
		open = true;
	}

	const result = $derived.by(() => {
		const form = page.form as {
			form?: string;
			success?: boolean;
			errors?: Record<string, string[] | undefined>;
		} | null;
		return form && form.form === 'markRange' && form !== openedWithForm ? form : null;
	});
	const error = $derived(result ? firstFieldError(result.errors) : null);

	$effect(() => {
		if (result?.success) open = false;
	});
</script>

<Button variant="outline" onclick={openDialog} disabled={finalised}>Mark leave</Button>

<Dialog.Root bind:open>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Mark a range of days</Dialog.Title>
			<Dialog.Description>
				Every day in the range becomes leave or sick, past or future. Public holidays in the range
				are left alone.
			</Dialog.Description>
		</Dialog.Header>

		<form
			method="POST"
			action="?/markRange"
			use:enhance
			onreset={(event) => event.preventDefault()}
			class="flex flex-col gap-4"
		>
			<div class="flex flex-wrap gap-3">
				<div class="flex flex-col gap-1.5">
					<Label for="mark-range-from">From</Label>
					<Input id="mark-range-from" name="from" type="date" bind:value={from} />
				</div>
				<div class="flex flex-col gap-1.5">
					<Label for="mark-range-to">To</Label>
					<Input id="mark-range-to" name="to" type="date" bind:value={to} />
				</div>
			</div>

			<div class="flex flex-col gap-1.5">
				<span class="text-sm font-medium">Type</span>
				<ToggleGroup.Root
					type="single"
					value={kind}
					onValueChange={(value) => {
						if (value) kind = value as 'leave' | 'sick';
					}}
					class="justify-start"
				>
					<ToggleGroup.Item value="leave">Leave</ToggleGroup.Item>
					<ToggleGroup.Item value="sick">Sick</ToggleGroup.Item>
				</ToggleGroup.Root>
			</div>
			<input type="hidden" name="kind" value={kind} />

			<div class="flex flex-col gap-1.5">
				<Label for="mark-range-note">Note (optional)</Label>
				<Textarea id="mark-range-note" name="note" bind:value={note} rows={2} />
			</div>

			{#if error}
				<p class="text-sm text-destructive" role="alert">{error}</p>
			{/if}

			<Dialog.Footer>
				<Button type="button" variant="ghost" onclick={() => (open = false)}>Cancel</Button>
				<Button type="submit">Mark days</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
