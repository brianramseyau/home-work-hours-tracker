<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { firstFieldError } from '$lib/core/validation';

	interface OfficeData {
		id: number;
		name: string;
		address: string | null;
		archivedAt: string | null;
	}

	let { office }: { office: OfficeData } = $props();

	let editing = $state(false);

	// This row's own outcome from `?/officeUpdate`, scoped by id since `page.form` is shared by
	// every OfficeRow on the page.
	const result = $derived.by(() => {
		const form = page.form as {
			form?: string;
			id?: number;
			success?: boolean;
			errors?: Record<string, string[] | undefined>;
		} | null;
		return form && form.form === 'officeUpdate' && form.id === office.id ? form : null;
	});
	const error = $derived(result ? firstFieldError(result.errors) : null);

	// Closed from the actual result, not optimistically on click: a validation failure (a blank
	// or duplicate name) needs to keep the form open so the error above is visible and the
	// user's edit isn't silently discarded.
	$effect(() => {
		if (result?.success) editing = false;
	});
</script>

<div class="flex flex-col gap-2 border-b py-4 last:border-b-0">
	{#if editing}
		<form method="POST" action="?/officeUpdate" use:enhance class="flex flex-wrap items-end gap-3">
			<input type="hidden" name="id" value={office.id} />
			<div class="flex flex-col gap-1">
				<Label for={`office-name-${office.id}`}>Name</Label>
				<Input id={`office-name-${office.id}`} name="name" value={office.name} class="w-56" />
			</div>
			<div class="flex flex-col gap-1">
				<Label for={`office-address-${office.id}`}>Address</Label>
				<Input
					id={`office-address-${office.id}`}
					name="address"
					value={office.address ?? ''}
					class="w-64"
				/>
			</div>
			<Button type="submit" size="sm">Save office</Button>
			<Button type="button" variant="ghost" size="sm" onclick={() => (editing = false)}>
				Cancel
			</Button>
			{#if error}
				<p class="w-full text-sm text-destructive" role="alert">{error}</p>
			{/if}
		</form>
	{:else}
		<div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
			<div>
				<p class="font-medium">
					<span>{office.name}</span>
					{#if office.archivedAt}
						<Badge variant="secondary" class="ml-2">Archived</Badge>
					{/if}
				</p>
				{#if office.address}
					<p class="text-sm text-muted-foreground">{office.address}</p>
				{/if}
			</div>
			<div class="flex gap-2">
				<Button variant="outline" size="sm" onclick={() => (editing = true)}>Rename</Button>
				{#if office.archivedAt}
					<form method="POST" action="?/officeUnarchive" use:enhance>
						<input type="hidden" name="id" value={office.id} />
						<Button type="submit" variant="outline" size="sm">Unarchive</Button>
					</form>
				{:else}
					<form method="POST" action="?/officeArchive" use:enhance>
						<input type="hidden" name="id" value={office.id} />
						<Button type="submit" variant="outline" size="sm">Archive</Button>
					</form>
				{/if}
			</div>
		</div>
	{/if}
</div>
