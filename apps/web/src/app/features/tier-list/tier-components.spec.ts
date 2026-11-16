import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { FilterChip, FilterBar, EmptyState } from './tier-components';
import { EMPTY_FILTER } from './filter';

describe('controlled catalog components', () => {
  afterEach(() => TestBed.resetTestingModule());
  it('chip announces selection and honors native disabled', async () => {
    const f = TestBed.createComponent(FilterChip);
    f.componentRef.setInput('label', 'Rayo');
    f.componentRef.setInput('selected', true);
    let changes = 0;
    f.componentInstance.selectionToggle.subscribe(() => changes++);
    await f.whenStable();
    const button: HTMLButtonElement = f.nativeElement.querySelector('button');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    button.click();
    expect(changes).toBe(1);
    f.componentRef.setInput('disabled', true);
    await f.whenStable();
    button.click();
    expect(changes).toBe(1);
  });
  it('filter groups emit new state without mutating parent input, search and reset work', async () => {
    const f = TestBed.createComponent(FilterBar);
    const state = Object.freeze({ ...EMPTY_FILTER, damageTypes: Object.freeze(['rayo']) });
    f.componentRef.setInput('value', state);
    f.componentRef.setInput('groups', [
      {
        key: 'damageTypes',
        label: 'Daño',
        options: [
          { value: 'rayo', label: 'Rayo' },
          { value: 'fuego', label: 'Fuego' },
        ],
      },
    ]);
    const emitted: unknown[] = [];
    f.componentInstance.valueChange.subscribe((v) => emitted.push(v));
    await f.whenStable();
    const buttons: HTMLButtonElement[] = [...f.nativeElement.querySelectorAll('button')];
    buttons.find((b) => b.textContent?.trim() === 'Fuego')!.click();
    expect(emitted[0]).toEqual({ ...state, damageTypes: ['rayo', 'fuego'] });
    expect(state.damageTypes).toEqual(['rayo']);
    const input: HTMLInputElement = f.nativeElement.querySelector('input');
    input.value = 'Chamán';
    input.dispatchEvent(new Event('input'));
    expect(emitted[1]).toEqual({ ...state, text: 'Chamán' });
    buttons.find((b) => b.textContent?.trim() === 'Clear filters')!.click();
    expect(emitted[2]).toEqual(EMPTY_FILTER);
    expect(f.nativeElement.querySelector('legend').textContent).toBe('Daño');
    expect(input.labels?.length).toBe(1);
  });
  it('empty state provides a real recovery action', async () => {
    const f = TestBed.createComponent(EmptyState);
    let resets = 0;
    f.componentInstance.filtersReset.subscribe(() => resets++);
    await f.whenStable();
    expect(f.nativeElement.textContent).toContain('No results');
    f.nativeElement.querySelector('button').click();
    expect(resets).toBe(1);
  });
});
