import { describe, expect, it } from 'vitest';
import { PROTOCOL_VERSION, isExtensionMessage, isWebviewMessage } from '../src/messages';

const envelope = (fields: Record<string, unknown>): Record<string, unknown> => ({
  v: PROTOCOL_VERSION,
  ...fields,
});

describe('isExtensionMessage', () => {
  it('accepts every message type the extension sends', () => {
    expect(
      isExtensionMessage(envelope({ type: 'snapshot', sessionId: 's', snapshot: {}, depth: 20 })),
    ).toBe(true);
    expect(
      isExtensionMessage(envelope({ type: 'history', sessionId: 's', entries: [{}, {}] })),
    ).toBe(true);
    expect(isExtensionMessage(envelope({ type: 'sessionEnd', sessionId: 's' }))).toBe(true);
    expect(isExtensionMessage(envelope({ type: 'error', sessionId: null, message: 'boom' }))).toBe(
      true,
    );
    expect(isExtensionMessage(envelope({ type: 'view', file: null, state: null }))).toBe(true);
    expect(
      isExtensionMessage(
        envelope({ type: 'locale', language: 'pt-br', bundle: { Pause: 'Pausa' } }),
      ),
    ).toBe(true);
  });

  it('accepts a locale message without a bundle, as English arrives after postMessage', () => {
    expect(isExtensionMessage(envelope({ type: 'locale', language: 'en' }))).toBe(true);
    expect(
      isExtensionMessage(envelope({ type: 'locale', language: 'en', bundle: undefined })),
    ).toBe(true);
  });

  it('rejects a locale message without a language or with a bundle that is not an object', () => {
    expect(isExtensionMessage(envelope({ type: 'locale' }))).toBe(false);
    expect(isExtensionMessage(envelope({ type: 'locale', language: 7 }))).toBe(false);
    expect(isExtensionMessage(envelope({ type: 'locale', language: 'en', bundle: 'x' }))).toBe(
      false,
    );
    expect(isExtensionMessage(envelope({ type: 'locale', language: 'en', bundle: null }))).toBe(
      false,
    );
  });

  it('rejects a different protocol version', () => {
    expect(isExtensionMessage({ v: 2, type: 'sessionEnd', sessionId: 's' })).toBe(false);
    expect(isExtensionMessage({ type: 'sessionEnd', sessionId: 's' })).toBe(false);
  });

  it('rejects unknown types and values that are not objects', () => {
    expect(isExtensionMessage(envelope({ type: 'theme', language: 'en' }))).toBe(false);
    expect(isExtensionMessage(envelope({ type: 'ready' }))).toBe(false);
    expect(isExtensionMessage(null)).toBe(false);
    expect(isExtensionMessage('{"v":1}')).toBe(false);
    expect(isExtensionMessage([PROTOCOL_VERSION])).toBe(false);
  });

  it('treats an absent optional field and an undefined one alike', () => {
    expect(isExtensionMessage(envelope({ type: 'view', file: 'a.c' }))).toBe(true);
    expect(isExtensionMessage(envelope({ type: 'view', file: 'a.c', state: undefined }))).toBe(
      true,
    );
    expect(
      isExtensionMessage(envelope({ type: 'sessionEnd', sessionId: 's', id: undefined })),
    ).toBe(true);
  });

  it('rejects an id that is not a string', () => {
    expect(isExtensionMessage(envelope({ type: 'sessionEnd', sessionId: 's', id: 7 }))).toBe(false);
  });

  it('checks the envelope fields but not the snapshot payload', () => {
    expect(
      isExtensionMessage(
        envelope({ type: 'snapshot', sessionId: 's', snapshot: { nodes: 'x' }, depth: 1 }),
      ),
    ).toBe(true);
    expect(
      isExtensionMessage(envelope({ type: 'snapshot', sessionId: 's', snapshot: {}, depth: '1' })),
    ).toBe(false);
    expect(
      isExtensionMessage(envelope({ type: 'history', sessionId: 's', entries: [{}, 3] })),
    ).toBe(false);
    expect(isExtensionMessage(envelope({ type: 'error', sessionId: 4, message: 'boom' }))).toBe(
      false,
    );
  });
});

describe('isWebviewMessage', () => {
  it('accepts ready, annotate and saveView', () => {
    expect(isWebviewMessage(envelope({ type: 'ready' }))).toBe(true);
    expect(isWebviewMessage(envelope({ type: 'annotate', annotation: 'v@n' }))).toBe(true);
    expect(isWebviewMessage(envelope({ type: 'saveView', file: 'main.c', state: {} }))).toBe(true);
  });

  it('rejects empty annotations and views without a file or a state object', () => {
    expect(isWebviewMessage(envelope({ type: 'annotate', annotation: '' }))).toBe(false);
    expect(isWebviewMessage(envelope({ type: 'saveView', file: '', state: {} }))).toBe(false);
    expect(isWebviewMessage(envelope({ type: 'saveView', file: 'main.c', state: null }))).toBe(
      false,
    );
  });

  it('rejects messages that only the extension sends', () => {
    expect(isWebviewMessage(envelope({ type: 'sessionEnd', sessionId: 's' }))).toBe(false);
  });
});
