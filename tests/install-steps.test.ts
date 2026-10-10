// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';

/**
 * The install guide has two shapes: a one-tap path when a ready-made automation exists, and the
 * written steps when it doesn't. The written fallback is what everyone used before the templates
 * existed, so it has to keep working.
 */

const URL_PROP = 'https://countdown.myludus.me/api/wallpaper?exams=%5B%5D&tz=UTC';

async function mountWith(shortcut: string, macro: string) {
  vi.resetModules();
  vi.doMock('../src/lib/shortcut', () => ({ SHORTCUT_TEMPLATE_URL: shortcut, MACRO_TEMPLATE_URL: macro }));
  const InstallSteps = (await import('../src/components/InstallSteps.vue')).default;
  return mount(InstallSteps, { props: { url: URL_PROP } });
}

const toAndroid = async (w: Awaited<ReturnType<typeof mountWith>>) => {
  const tab = w.findAll('button').find((b) => b.text().includes('Android'))!;
  await tab.trigger('click');
};

beforeEach(() => vi.resetModules());

describe('with no ready-made automation configured', () => {
  it('iPhone falls back to the written Shortcut steps', async () => {
    const w = await mountWith('', '');
    const text = w.text();
    expect(text).toContain('Build the Shortcut');
    expect(text).toContain('Get Contents of URL');
    expect(text).toContain('Set Wallpaper Photo');
    expect(text).toContain('Show Preview');
    // the mistake that leaves a blank lock screen stays called out
    expect(text).toContain('leaves the screen looking blank');
    expect(w.find('a[href*="icloud.com"]').exists()).toBe(false);
  });

  it('Android falls back to the written MacroDroid steps', async () => {
    const w = await mountWith('', '');
    await toAndroid(w);
    const text = w.text();
    expect(text).toContain('Build the macro');
    expect(text).toContain('MacroDroid');
    expect(text).toContain('HTTP Request');
    expect(text).toContain('Set Wallpaper');
  });

  it('still tells both platforms to run it every morning', async () => {
    const w = await mountWith('', '');
    expect(w.text()).toContain('Make it run every morning');
    expect(w.text()).toContain('Time of Day');
    await toAndroid(w);
    expect(w.text()).toContain('Make it run every morning');
    expect(w.text()).toContain('Day/Time');
  });
});

describe('with a ready-made automation configured', () => {
  it('iPhone offers the Shortcut in one tap', async () => {
    const w = await mountWith('https://www.icloud.com/shortcuts/abc123', '');
    expect(w.text()).toContain('Add the ready-made Shortcut');
    expect(w.find('a[href="https://www.icloud.com/shortcuts/abc123"]').exists()).toBe(true);
    // the hand-built route is replaced, though the action is still named as the place to paste
    expect(w.text()).not.toContain('Build the Shortcut');
    expect(w.text()).not.toContain('add these two actions');
  });

  it('Android offers the macro, after installing the app the link needs', async () => {
    const w = await mountWith('', 'https://macrodroid.example/t/abc');
    await toAndroid(w);
    expect(w.find('a[href="https://macrodroid.example/t/abc"]').exists()).toBe(true);
    expect(w.text()).toContain('only opens inside it');
  });
});

describe('the by-hand route is gone', () => {
  it.each([['', ''], ['https://www.icloud.com/shortcuts/abc123', 'https://macrodroid.example/t/abc']])(
    'offers no way to set the wallpaper manually (shortcut=%s)', async (shortcut, macro) => {
      const w = await mountWith(shortcut, macro);
      await toAndroid(w);
      const text = w.text();
      for (const gone of ['Download image', 'Set as wallpaper', 'By hand', 'No extra app', 'nothing to schedule']) {
        expect(text).not.toContain(gone);
      }
    },
  );
});
