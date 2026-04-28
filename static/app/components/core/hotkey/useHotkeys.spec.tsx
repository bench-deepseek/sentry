import {renderHook} from 'sentry-test/reactTestingLibrary';

import {useHotkeys} from '@sentry/scraps/hotkey';

// eslint-disable-next-line boundaries/dependencies
import {getKeyCode} from './keyMappings';
jest.mock('@react-aria/utils', () => ({
  ...jest.requireActual('@react-aria/utils'),
  isMac: jest.fn(() => false),
}));

const {isMac} = jest.requireMock<{isMac: jest.Mock}>('@react-aria/utils');

describe('useHotkeys', () => {
  let events: Record<string, (evt: EventListenerOrEventListenerObject) => void> = {};

  function makeKeyEventFixture(keyCode: any, options: any) {
    return {
      keyCode: getKeyCode(keyCode),
      preventDefault: jest.fn(),
      ...options,
    };
  }

  beforeEach(() => {
    events = {};

    document.addEventListener = jest.fn((event: string, callback: () => any) => {
      events[event] = callback;
    });

    document.removeEventListener = jest.fn(event => {
      delete events[event];
    });
  });

  it('handles a simple match', () => {
    const callback = jest.fn();

    renderHook(p => useHotkeys(p), {
      initialProps: [{match: 'ctrl+s', callback}],
    });

    expect(events.keydown).toBeDefined();
    expect(callback).not.toHaveBeenCalled();

    const evt = makeKeyEventFixture('s', {ctrlKey: true});
    events.keydown!(evt);

    expect(evt.preventDefault).toHaveBeenCalled();
    expect(callback).toHaveBeenCalled();
  });

  it('handles multiple matches', () => {
    const callback = jest.fn();

    renderHook(p => useHotkeys(p), {
      initialProps: [{match: ['ctrl+s', 'command+m'], callback}],
    });

    expect(events.keydown).toBeDefined();
    expect(callback).not.toHaveBeenCalled();

    events.keydown!(makeKeyEventFixture('s', {ctrlKey: true}));

    expect(callback).toHaveBeenCalled();
    callback.mockClear();

    events.keydown!(makeKeyEventFixture('m', {metaKey: true}));

    expect(callback).toHaveBeenCalled();
  });

  it('handles a complex match', () => {
    const callback = jest.fn();

    renderHook(p => useHotkeys(p), {
      initialProps: [{match: ['command+ctrl+alt+shift+x'], callback}],
    });

    expect(events.keydown).toBeDefined();
    expect(callback).not.toHaveBeenCalled();

    events.keydown!(
      makeKeyEventFixture('x', {
        altKey: true,
        metaKey: true,
        shiftKey: true,
        ctrlKey: true,
      })
    );

    expect(callback).toHaveBeenCalled();
  });

  it('does not match when extra modifiers are pressed', () => {
    const callback = jest.fn();

    renderHook(p => useHotkeys(p), {
      initialProps: [{match: ['command+shift+x'], callback}],
    });

    expect(events.keydown).toBeDefined();
    expect(callback).not.toHaveBeenCalled();

    events.keydown!(
      makeKeyEventFixture('x', {
        altKey: true,
        metaKey: true,
        shiftKey: true,
        ctrlKey: true,
      })
    );

    expect(callback).not.toHaveBeenCalled();
  });

  it('updates with rerender', () => {
    const callback = jest.fn();

    const {rerender} = renderHook(p => useHotkeys([{match: p.match, callback}]), {
      initialProps: {match: 'ctrl+s'},
    });

    expect(events.keydown).toBeDefined();
    expect(callback).not.toHaveBeenCalled();

    events.keydown!(makeKeyEventFixture('s', {ctrlKey: true}));

    expect(callback).toHaveBeenCalled();
    callback.mockClear();

    rerender({match: 'command+m'});

    events.keydown!(makeKeyEventFixture('s', {ctrlKey: true}));
    expect(callback).not.toHaveBeenCalled();

    events.keydown!(makeKeyEventFixture('m', {metaKey: true}));
    expect(callback).toHaveBeenCalled();
  });

  it('skips input and textarea', () => {
    const callback = jest.fn();

    renderHook(p => useHotkeys(p), {
      initialProps: [{match: ['/'], callback}],
    });

    events.keydown!(makeKeyEventFixture('/', {target: document.createElement('input')}));

    expect(callback).not.toHaveBeenCalled();
  });

  it('does not skips input and textarea with includesInputs', () => {
    const callback = jest.fn();

    renderHook(p => useHotkeys(p), {
      initialProps: [{match: ['/'], callback, includeInputs: true}],
    });

    events.keydown!(makeKeyEventFixture('/', {target: document.createElement('input')}));

    expect(callback).toHaveBeenCalled();
  });

  it('skips preventDefault', () => {
    const callback = jest.fn();

    renderHook(p => useHotkeys(p), {
      initialProps: [{match: 'ctrl+s', callback, skipPreventDefault: true}],
    });

    const evt = makeKeyEventFixture('s', {ctrlKey: true});
    events.keydown!(evt);

    expect(evt.preventDefault).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalled();
  });

  describe('mod modifier', () => {
    afterEach(() => {
      isMac.mockReturnValue(false);
    });

    it('matches command on macOS', () => {
      isMac.mockReturnValue(true);
      const callback = jest.fn();

      renderHook(p => useHotkeys(p), {
        initialProps: [{match: 'mod+k', callback}],
      });

      events.keydown!(makeKeyEventFixture('k', {metaKey: true}));
      expect(callback).toHaveBeenCalledTimes(1);

      events.keydown!(makeKeyEventFixture('k', {ctrlKey: true}));
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('matches control on non-mac platforms', () => {
      isMac.mockReturnValue(false);
      const callback = jest.fn();

      renderHook(p => useHotkeys(p), {
        initialProps: [{match: 'mod+k', callback}],
      });

      events.keydown!(makeKeyEventFixture('k', {ctrlKey: true}));
      expect(callback).toHaveBeenCalledTimes(1);

      events.keydown!(makeKeyEventFixture('k', {metaKey: true}));
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('rejects extra non-mod modifiers', () => {
      // mod+k on Mac canonicalizes to command+k; pressing command+ctrl+k
      // should NOT fire because ctrl is an unused modifier.
      isMac.mockReturnValue(true);
      const callback = jest.fn();

      renderHook(p => useHotkeys(p), {
        initialProps: [{match: 'mod+k', callback}],
      });

      events.keydown!(makeKeyEventFixture('k', {metaKey: true, ctrlKey: true}));
      expect(callback).not.toHaveBeenCalled();
    });
  });
});
