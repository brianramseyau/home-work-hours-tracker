<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { firstFieldError } from '$lib/core/validation';
	import { formatHours } from '$lib/core/time';

	interface YearRowData {
		startYear: number;
		rateCentsPerHour: number;
		rateNote: string | null;
		finalisedAt: string | null;
		fy: { label: string; range: string };
		homeMinutes: number;
		claimCents: number;
	}

	let { year }: { year: YearRowData } = $props();

	let editing = $state(false);
	let finaliseDialogOpen = $state(false);

	function formatDollars(cents: number): string {
		return `$${(cents / 100).toFixed(2)}`;
	}

	// This row's own outcome from `?/updateRate`, scoped by startYear since `page.form` is
	// shared by every YearRow on the page.
	const result = $derived.by(() => {
		const form = page.form as {
			form?: string;
			startYear?: number;
			success?: boolean;
			errors?: Record<string, string[] | undefined>;
		} | null;
		return form && form.form === 'updateRate' && form.startYear === year.startYear ? form : null;
	});
	const error = $derived(result ? firstFieldError(result.errors) : null);

	// Closed from the actual result, not optimistically on click: a validation failure (an
	// invalid or blank rate, or a finalised year) needs to keep the form open so the error above
	// is visible and the user's edit isn't silently discarded.
	$effect(() => {
		if (result?.success) editing = false;
	});
</script>

<div class="flex flex-col gap-3 border-b py-5 last:border-b-0">
	<div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
		<div>
			<h2 class="font-display text-xl font-semibold">{year.fy.label}</h2>
			<p class="text-sm text-muted-foreground">{year.fy.range}</p>
		</div>
		{#if year.finalisedAt}
			<Badge variant="secondary">Finalised</Badge>
		{/if}
	</div>

	<dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
		<div>
			<dt class="text-muted-foreground">Rate</dt>
			<dd class="font-medium tabular">{`${formatDollars(year.rateCentsPerHour)}/hr`}</dd>
		</div>
		<div>
			<dt class="text-muted-foreground">Home hours</dt>
			<dd class="font-medium tabular">{`${formatHours(year.homeMinutes)} h`}</dd>
		</div>
		<div>
			<dt class="text-muted-foreground">Claim so far</dt>
			<dd class="font-medium tabular">{formatDollars(year.claimCents)}</dd>
		</div>
		{#if year.rateNote}
			<div>
				<dt class="text-muted-foreground">Note</dt>
				<dd>{year.rateNote}</dd>
			</div>
		{/if}
	</dl>

	{#if editing}
		<form method="POST" action="?/updateRate" use:enhance class="flex flex-wrap items-end gap-3">
			<input type="hidden" name="startYear" value={year.startYear} />
			<div class="flex flex-col gap-1">
				<Label for={`rate-${year.startYear}`}>Rate ($/hr)</Label>
				<Input
					id={`rate-${year.startYear}`}
					name="rateDollars"
					inputmode="decimal"
					value={(year.rateCentsPerHour / 100).toFixed(2)}
					class="w-24"
				/>
			</div>
			<div class="flex flex-col gap-1">
				<Label for={`note-${year.startYear}`}>Note</Label>
				<Input
					id={`note-${year.startYear}`}
					name="rateNote"
					value={year.rateNote ?? ''}
					placeholder="ATO fixed rate method"
					class="w-56"
				/>
			</div>
			<Button type="submit" size="sm">Save rate</Button>
			<Button type="button" variant="ghost" size="sm" onclick={() => (editing = false)}>
				Cancel
			</Button>
			{#if error}
				<p class="w-full text-sm text-destructive" role="alert">{error}</p>
			{/if}
		</form>
	{:else}
		<div class="flex flex-wrap gap-2">
			<Button variant="outline" size="sm" onclick={() => (editing = true)}>Edit rate</Button>
			<Dialog.Root bind:open={finaliseDialogOpen}>
				<Dialog.Trigger>
					{#snippet child({ props })}
						<Button {...props} variant="outline" size="sm">
							{year.finalisedAt ? 'Unfinalise' : 'Finalise'}
						</Button>
					{/snippet}
				</Dialog.Trigger>
				<Dialog.Content>
					<Dialog.Header>
						<Dialog.Title>
							{year.finalisedAt ? `Unfinalise ${year.fy.label}?` : `Finalise ${year.fy.label}?`}
						</Dialog.Title>
						<Dialog.Description>
							{year.finalisedAt
								? 'Auto-fill and edits will resume for this year.'
								: 'Auto-fill and edits stop for this year — its days stay exactly as they are now.'}
						</Dialog.Description>
					</Dialog.Header>
					<Dialog.Footer>
						<Button variant="ghost" onclick={() => (finaliseDialogOpen = false)}>Cancel</Button>
						<form
							method="POST"
							action={year.finalisedAt ? '?/unfinalise' : '?/finalise'}
							use:enhance
						>
							<input type="hidden" name="startYear" value={year.startYear} />
							<Button
								type="submit"
								variant={year.finalisedAt ? 'default' : 'destructive'}
								onclick={() => (finaliseDialogOpen = false)}
							>
								{year.finalisedAt ? 'Unfinalise' : 'Finalise'}
							</Button>
						</form>
					</Dialog.Footer>
				</Dialog.Content>
			</Dialog.Root>
		</div>
	{/if}
</div>
