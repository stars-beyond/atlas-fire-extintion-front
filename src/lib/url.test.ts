// safeHref decides which addresses coming from the API may go into an href.
import { describe, expect, it } from 'vitest'
import { psiUrl, safeHref } from './url'

describe('safeHref', () => {
  it.each([
    'https://psi.nasa.gov/x', 'http://example.org/a?b=1#c', 'HTTPS://EXAMPLE.ORG', 'HtTp://example.org',
  ])('lets http(s) through unchanged: %s', (u) => { expect(safeHref(u)).toBe(u) })

  it.each([
    '/investigations/PSI-25', 'docs/report.pdf', './a', '../a', '#cite-3', '?q=1', '//cdn.example.org/x.js',
    'a/b:c',            // a colon after the first slash is not a scheme
    '1:2',              // a scheme cannot start with a digit
  ])('lets a relative address through unchanged: %s', (u) => { expect(safeHref(u)).toBe(u) })

  it.each([
    'javascript:alert(1)', 'JavaScript:alert(1)', 'JAVASCRIPT:alert(1)', 'javascript://example.org/%0aalert(1)',
    'data:text/html,<script>alert(1)</script>', 'DATA:text/html;base64,PHNjcmlwdD4=',
    'vbscript:msgbox(1)', 'blob:https://example.org/uuid', 'file:///etc/passwd', 'mailto:someone@example.org',
    'ftp://example.org/x', 'intent://scan/#Intent;end', 'x-custom+scheme.1:payload',
  ])('blocks every other scheme: %s', (u) => { expect(safeHref(u)).toBeUndefined() })

  // Browsers drop tabs and line breaks inside the scheme and leading spaces/control characters before it,
  // so "java\tscript:" still runs as javascript:.
  it.each([
    ['tab inside the scheme', 'java\tscript:alert(1)'],
    ['line feed inside the scheme', 'java\nscript:alert(1)'],
    ['carriage return inside the scheme', 'java\rscript:alert(1)'],
    ['several controls inside the scheme', 'j\ta\nv\ra\tscript:alert(1)'],
    ['leading spaces', '   javascript:alert(1)'],
    ['leading tab and line feed', '\t\njavascript:alert(1)'],
    ['leading control characters', '\u0000\u0001\u001fjavascript:alert(1)'],
    ['spaces inside the scheme', 'java script:alert(1)'],
    ['whitespace before the colon', 'javascript\t:alert(1)'],
    ['data: with a tab', 'da\tta:text/html,x'],
  ])('blocks a disguised scheme: %s', (_name, u) => { expect(safeHref(u)).toBeUndefined() })

  it('lets an http(s) address with stray whitespace through as it was given', () => {
    expect(safeHref(' https://example.org/a b')).toBe(' https://example.org/a b')
    expect(safeHref('ht\ttps://example.org')).toBe('ht\ttps://example.org')
  })

  it.each([
    ['undefined', undefined], ['null', null], ['a number', 42], ['an object', { href: 'https://example.org' }],
    ['an array', ['https://example.org']], ['a boolean', true],
    ['an object whose toString returns a URL', { toString: () => 'https://example.org' }],
  ])('returns undefined for something that is not a string: %s', (_name, u) => { expect(safeHref(u)).toBeUndefined() })

  it.each([['empty', ''], ['spaces only', '   '], ['control characters only', '\t\n\u0000']])(
    'returns undefined for a string with nothing in it: %s', (_name, u) => { expect(safeHref(u)).toBeUndefined() })
})

describe('psiUrl', () => {
  it('builds the address of an investigation in the PSI repository', () => {
    expect(psiUrl('PSI-25')).toBe('https://psi.nasa.gov/physci/repo/data/investigations/PSI-25')
    expect(safeHref(psiUrl('PSI-25'))).toBe(psiUrl('PSI-25'))
  })
})
