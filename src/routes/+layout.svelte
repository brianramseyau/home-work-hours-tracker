<script lang="ts">
	import './layout.css';
	import { page } from '$app/state';
	import { ModeWatcher } from 'mode-watcher';
	import { toast } from 'svelte-sonner';
	import AppFooter from '$lib/components/app/AppFooter.svelte';
	import FySwitcher from '$lib/components/app/FySwitcher.svelte';
	import Logo from '$lib/components/app/Logo.svelte';
	import NavLinks from '$lib/components/app/NavLinks.svelte';
	import ThemeToggle from '$lib/components/app/ThemeToggle.svelte';
	import { Toaster } from '$lib/components/ui/sonner';
	import { APP_NAME, APP_SHORT_NAME } from '$lib/branding';
	import { navItems } from '$lib/nav';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const items = $derived(navItems(data.currentFy.slug));

	// A single quiet toast when auto-prefill materialises new days — no banner, no prompt. Most
	// navigations find nothing to fill (the watermark already reached today), so this stays
	// silent almost all the time; it only speaks up the first time the app is opened on a new day.
	$effect(() => {
		if (data.filled > 0) {
			toast.success(`Filled ${data.filled} day${data.filled === 1 ? '' : 's'} from your schedule`);
		}
	});
</script>

<svelte:head>
	<title>{`${APP_NAME}`}</title>
</svelte:head>

<ModeWatcher />
<Toaster />

<a
	href="#main"
	class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:ring-2 focus:ring-ring"
>
	Skip to content
</a>

<div class="min-h-dvh lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
	<aside class="sticky top-0 hidden h-dvh flex-col gap-8 border-r bg-sidebar px-5 py-6 lg:flex">
		<a href="/" class="flex items-center gap-3">
			<Logo class="size-11" />
			<span class="font-display text-lg leading-tight font-semibold"
				>Home Work<br />Hours Tracker</span
			>
		</a>
		<FySwitcher fy={data.currentFy} />
		<NavLinks {items} pathname={page.url.pathname} variant="rail" />
		<div class="mt-auto flex items-end justify-between gap-2">
			<AppFooter version={__APP_VERSION__} />
			<ThemeToggle />
		</div>
	</aside>

	<div class="flex min-h-dvh min-w-0 flex-col">
		<header
			class="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/90 px-4 backdrop-blur lg:hidden"
		>
			<a href="/" class="flex items-center gap-2" aria-label={`${APP_NAME} home`}>
				<Logo class="size-8" />
				<span class="font-display font-semibold">{APP_SHORT_NAME}</span>
			</a>
			<div class="ml-auto flex items-center gap-1">
				<FySwitcher fy={data.currentFy} compact />
				<ThemeToggle />
			</div>
		</header>

		<main id="main" class="flex-1 px-4 py-6 lg:px-12 lg:py-10">
			{@render children()}
		</main>

		<div class="px-4 pt-4 pb-24 lg:hidden">
			<AppFooter version={__APP_VERSION__} />
		</div>
	</div>

	<NavLinks {items} pathname={page.url.pathname} variant="tabs" />
</div>
