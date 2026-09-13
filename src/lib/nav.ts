// Primary navigation: the mobile bottom tabs and the desktop rail share this list.

export type NavIcon = 'week' | 'year' | 'export' | 'settings';

export interface NavItem {
	href: string;
	label: string;
	icon: NavIcon;
}

export function navItems(fySlug: string): NavItem[] {
	return [
		{ href: `/${fySlug}`, label: 'Week', icon: 'week' },
		{ href: `/${fySlug}/year`, label: 'Year', icon: 'year' },
		{ href: `/${fySlug}/export`, label: 'Export', icon: 'export' },
		{ href: '/settings', label: 'Settings', icon: 'settings' }
	];
}

/**
 * Whether `item` is the current section. Week owns the home page and day deep links;
 * every other item owns its own subtree.
 */
export function isActive(pathname: string, item: NavItem): boolean {
	if (item.icon === 'week') {
		return pathname === '/' || pathname === item.href || pathname.startsWith(`${item.href}/day/`);
	}
	return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
