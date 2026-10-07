import { describe, expect, it } from 'vitest';
import { assertValidVarsSchema, assertVariablesMatch, compileSource } from './templates.js';

const MJML = '<mjml><mj-body><mj-section><mj-column><mj-text>Hi {{first_name}}</mj-text></mj-column></mj-section></mj-body></mjml>';

describe('compileSource', () => {
  it('compiles MJML to HTML and keeps the variables', async () => {
    const html = await compileSource('mjml', MJML);
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('Hi {{first_name}}');
  });

  it('uses HTML and React output as given', async () => {
    expect(await compileSource('html', '<p>{{x}}</p>')).toBe('<p>{{x}}</p>');
    expect(await compileSource('react', '<div>{{x}}</div>')).toBe('<div>{{x}}</div>');
  });

  it('rejects invalid MJML with 400 and no server path in the message', async () => {
    const error = await compileSource('mjml', '<mjml><mj-body><mj-foo/></mj-body></mjml>').catch((e) => e);
    expect(error).toMatchObject({ status: 400, type: 'invalid_template' });
    expect(error.detail).toContain('mj-foo');
    expect(error.detail).not.toMatch(/\/(home|media|opt|app)\//);
  });

  it('rejects a body that is not a valid Handlebars template', async () => {
    await expect(compileSource('html', '<p>{{#if x}}unclosed</p>')).rejects.toMatchObject({ status: 400 });
  });
});

describe('vars_schema', () => {
  const version = {
    id: 'v1',
    varsSchema: { type: 'object', required: ['first_name'], properties: { first_name: { type: 'string' } } },
  } as Parameters<typeof assertVariablesMatch>[0];

  it('refuses a schema that is not JSON Schema', () => {
    expect(() => assertValidVarsSchema({ type: 'not-a-type' })).toThrowError(expect.objectContaining({ status: 400 }));
  });

  it('answers 422 when variables do not match', () => {
    expect(() => assertVariablesMatch(version, {})).toThrowError(
      expect.objectContaining({ status: 422, type: 'template_variables_invalid' }),
    );
    expect(() => assertVariablesMatch(version, { first_name: 'Anna' })).not.toThrow();
  });
});
