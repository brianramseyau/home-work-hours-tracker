<script lang="ts">
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import FileSpreadsheet from '@lucide/svelte/icons/file-spreadsheet';
	import LayoutGrid from '@lucide/svelte/icons/layout-grid';
	import Settings from '@lucide/svelte/icons/settings';
	import { isActive, type NavIcon, type NavItem } from '$lib/nav';

	let {
		items,
		pathname,
		variant
	}: { items: NavItem[]; pathname: string; variant: 'rail' | 'tabs' } = $props();

	const icons: Record<NavIcon, typeof CalendarDays> = {
		week: CalendarDays,
		year: LayoutGrid,
		export: FileSpreadsheet,
		settings: Settings
	};

	// Active state is styled from aria-current, so the accessible state and the visual one
	// can never disagree. Ink marks the active item: lamp-amber is reserved for Home hours.
	const styles = {
		rail: {
			nav: '',
			list: 'flex flex-col gap-1',
			link: 'relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground aria-[current=page]:bg-secondary aria-[current=page]:font-semibold aria-[current=page]:text-foreground'
		},
		tabs: {
			nav: 'fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden',
			list: 'grid grid-cols-4',
			link: 'relative flex flex-col items-center gap-1 py-2.5 text-xs font-medium text-muted-foreground after:absolute after:inset-x-7 after:top-0 after:h-0.5 after:rounded-full aria-[current=page]:text-foreground aria-[current=page]:after:bg-foreground'
		}
	};
</script>

<nav aria-label="Primary" class={styles[variant].nav}>
	<ul class={styles[variant].list}>
		{#each items as item (item.href)}
			{@const Icon = icons[item.icon]}
			<li>
				<a
					href={item.href}
					class={styles[variant].link}
					aria-current={isActive(pathname, item) ? 'page' : undefined}
				>
					<Icon class="size-5" aria-hidden="true" />
					<span>{item.label}</span>
				</a>
			</li>
		{/each}
	</ul>
</nav>
