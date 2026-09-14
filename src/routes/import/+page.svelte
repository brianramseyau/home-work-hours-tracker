<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Switch } from '$lib/components/ui/switch';
	import * as ToggleGroup from '$lib/components/ui/toggle-group';
	import { fyLabel } from '$lib/core/fy';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const preview = $derived(form && 'preview' in form ? (form.preview ?? null) : null);
	const uploadError = $derived(
		form && form.form === 'upload' && 'error' in form ? form.error : null
	);
	const commitError = $derived(
		form && form.form === 'commit' && 'error' in form ? form.error : null
	);
	const existingRateCentsPerHour = $derived(
		form && form.form === 'upload' ? form.existingRateCentsPerHour : null
	);

	let showIssuesOnly = $state(false);
	let replaceManualEdits = $state(false);
	// Only ever holds entries a user has actively changed away from the 'create' default — read
	// through `officeChoice[name] ?? 'create'` everywhere, so there's no need to pre-populate it.
	let officeChoice = $state<Record<string, string>>({});

	const defaultRateDollars = $derived(
		(((preview?.rateCentsPerHour ?? existingRateCentsPerHour ?? 70) as number) / 100).toFixed(2)
	);
</script>

<svelte:head>
	<title>Historical import</title>
</svelte:head>

<div class="mx-auto flex max-w-4xl flex-col gap-6">
	<div>
		<h1 class="font-display text-2xl font-semibold">Historical import</h1>
		<p class="mt-1 text-sm text-muted-foreground">
			Upload a legacy "Home Work Diary" spreadsheet, review how it maps onto this app, then commit
			it. Nothing is saved until you commit.
		</p>
	</div>

	{#if !preview}
		<section class="flex flex-col gap-3 rounded-lg border border-border p-5">
			<h2 class="font-display text-lg font-semibold">Step 1 — Upload</h2>
			<form
				method="POST"
				action="?/upload"
				enctype="multipart/form-data"
				use:enhance
				class="flex flex-col items-start gap-3"
			>
				<Label for="file">Legacy .xlsx file</Label>
				<input
					id="file"
					name="file"
					type="file"
					accept=".xlsx"
					required
					class="text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-secondary file:px-3 file:py-1.5"
				/>
				<Button type="submit">Upload and review</Button>
			</form>
			{#if uploadError}
				<p class="text-sm text-destructive">{uploadError}</p>
			{/if}
			{#if commitError}
				<p class="text-sm text-destructive">{commitError}</p>
			{/if}
		</section>
	{:else}
		{@const issueRowNumbers = new Set(preview.issues.map((issue) => issue.rowNumber))}
		{@const importableRows = preview.rows.filter((row) => !row.skip)}
		<section class="flex flex-col gap-4 rounded-lg border border-border p-5">
			<h2 class="font-display text-lg font-semibold">Step 2 — Review</h2>
			<p class="text-sm text-muted-foreground">
				{`Detected ${fyLabel(preview.fyStartYear)}, ${preview.rows.length} row${preview.rows.length === 1 ? '' : 's'}, ${preview.issues.length} issue${preview.issues.length === 1 ? '' : 's'}.`}
			</p>

			<div class="grid gap-4 rounded-md border border-border bg-secondary p-4 sm:grid-cols-2">
				<div>
					<p class="text-xs text-muted-foreground">Spreadsheet totals</p>
					<p class="font-display text-lg font-semibold tabular-nums">
						{preview.sheetTotals.hours !== null ? `${preview.sheetTotals.hours.toFixed(2)} h` : '—'}
						{preview.sheetTotals.claimCents !== null
							? ` / $${(preview.sheetTotals.claimCents / 100).toFixed(2)}`
							: ''}
					</p>
				</div>
				<div>
					<p class="text-xs text-muted-foreground">Recomputed by this app</p>
					<p class="font-display text-lg font-semibold tabular-nums">
						{preview.appTotals.hours.toFixed(2)} h
						{preview.appTotals.claimCents !== null
							? ` / $${(preview.appTotals.claimCents / 100).toFixed(2)}`
							: ''}
					</p>
				</div>
				{#if preview.mismatch}
					<p class="text-sm text-rosehip sm:col-span-2">
						These totals don't match — check the rows below (especially issue rows) before
						committing.
					</p>
				{/if}
			</div>

			<form method="POST" action="?/commit" use:enhance class="flex flex-col gap-4">
				<input type="hidden" name="preview" value={JSON.stringify(preview)} />

				<div class="flex flex-wrap items-end gap-4">
					<div class="flex flex-col gap-1">
						<Label for="rateDollars">{`Rate for ${fyLabel(preview.fyStartYear)} ($/hour)`}</Label>
						<Input
							id="rateDollars"
							name="rateDollars"
							type="number"
							step="0.01"
							min="0"
							value={defaultRateDollars}
							class="w-32"
						/>
					</div>
					<div class="flex items-center gap-2">
						<Switch
							id="replaceManualEdits"
							name="replaceManualEdits"
							bind:checked={replaceManualEdits}
						/>
						<Label for="replaceManualEdits">Replace my manual edits</Label>
					</div>
				</div>

				{#if preview.proposedOffices.length > 0}
					<div class="flex flex-col gap-3">
						<h3 class="text-sm font-medium">Proposed offices</h3>
						{#each preview.proposedOffices as name (name)}
							<div class="flex flex-wrap items-center gap-3">
								<span class="w-40 truncate text-sm">{name}</span>
								<input
									type="hidden"
									name={`office-${name}`}
									value={officeChoice[name] ?? 'create'}
								/>
								<ToggleGroup.Root
									type="single"
									value={officeChoice[name] ?? 'create'}
									onValueChange={(value) => {
										if (value) officeChoice = { ...officeChoice, [name]: value };
									}}
								>
									<ToggleGroup.Item value="create" size="sm">Create new office</ToggleGroup.Item>
									{#each data.offices as office (office.id)}
										<ToggleGroup.Item value={`map:${office.id}`} size="sm">
											{`Map to ${office.name}`}
										</ToggleGroup.Item>
									{/each}
									<ToggleGroup.Item value="ignore" size="sm">Ignore</ToggleGroup.Item>
								</ToggleGroup.Root>
							</div>
						{/each}
					</div>
				{/if}

				<div class="flex items-center gap-2">
					<input
						id="showIssuesOnly"
						type="checkbox"
						bind:checked={showIssuesOnly}
						class="size-4 rounded border-border"
					/>
					<Label for="showIssuesOnly">Show issues only</Label>
				</div>

				<div class="max-h-[28rem] overflow-auto rounded-md border border-border">
					<table class="w-full text-left text-sm">
						<thead class="sticky top-0 bg-secondary">
							<tr>
								<th class="px-2 py-1.5">Import</th>
								<th class="px-2 py-1.5">Date</th>
								<th class="px-2 py-1.5">Kind</th>
								<th class="px-2 py-1.5">Office</th>
								<th class="px-2 py-1.5">Start</th>
								<th class="px-2 py-1.5">End</th>
								<th class="px-2 py-1.5">Notes</th>
							</tr>
						</thead>
						<tbody>
							{#each importableRows as row (row.rowNumber)}
								{@const hasIssue = issueRowNumbers.has(row.rowNumber)}
								<tr class={hasIssue ? 'bg-rosehip/10' : ''} hidden={showIssuesOnly && !hasIssue}>
									<td class="px-2 py-1.5">
										<input
											type="checkbox"
											name={`include-${row.rowNumber}`}
											checked={!hasIssue}
											aria-label={`Import ${row.date}`}
											class="size-4 rounded border-border"
										/>
									</td>
									<td class="px-2 py-1.5 tabular-nums">{row.date}</td>
									<td class="px-2 py-1.5">{row.kind}</td>
									<td class="px-2 py-1.5">{row.officeName ?? ''}</td>
									<td class="px-2 py-1.5 tabular-nums">{row.start ?? ''}</td>
									<td class="px-2 py-1.5 tabular-nums">{row.end ?? ''}</td>
									<td class="px-2 py-1.5">{row.notes ?? ''}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				{#if preview.issues.length > 0}
					<div class="flex flex-col gap-1 rounded-md border border-rosehip/40 bg-rosehip/10 p-3">
						<h3 class="text-sm font-medium">Issues</h3>
						<ul class="flex flex-col gap-0.5 text-sm text-muted-foreground">
							{#each preview.issues as issue (`${issue.rowNumber}-${issue.reason}`)}
								<li>{`Row ${issue.rowNumber}: ${issue.reason}`}</li>
							{/each}
						</ul>
					</div>
				{/if}

				{#if commitError}
					<p class="text-sm text-destructive">{commitError}</p>
				{/if}

				<Button type="submit" class="self-start">
					{`Commit ${importableRows.length} row${importableRows.length === 1 ? '' : 's'}`}
				</Button>
			</form>
		</section>
	{/if}
</div>
