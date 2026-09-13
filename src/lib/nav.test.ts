import { describe, expect, it } from 'vitest';
import { isActive, navItems } from './nav';

const [week, year, exportItem, settings] = navItems('fy27');

describe('navItems', () => {
	it('scopes diary sections to the financial year', () => {
		expect(navItems('fy27').map((i) => [i.label, i.href])).toEqual([
			['Week', '/fy27'],
			['Year', '/fy27/year'],
			['Export', '/fy27/export'],
			['Settings', '/settings']
		]);
	});
});

describe('isActive', () => {
	it('treats the home page and day deep links as Week', () => {
		expect(isActive('/', week)).toBe(true);
		expect(isActive('/fy27', week)).toBe(true);
		expect(isActive('/fy27/day/2026-09-14', week)).toBe(true);
		expect(isActive('/fy27/year', week)).toBe(false);
	});

	it('matches other sections by subtree', () => {
		expect(isActive('/fy27/year', year)).toBe(true);
		expect(isActive('/fy27/export', exportItem)).toBe(true);
		expect(isActive('/settings', settings)).toBe(true);
		expect(isActive('/settings/offices', settings)).toBe(true);
		expect(isActive('/settingsx', settings)).toBe(false);
		expect(isActive('/', year)).toBe(false);
	});
});
