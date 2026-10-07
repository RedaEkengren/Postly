import { describe, expect, it } from 'vitest';
import { assertTemplateParses, renderTemplate } from './templates.js';

describe('renderTemplate', () => {
  it('fills variables into subject and body', () => {
    const r = renderTemplate({ subject: 'Welcome, {{first_name}}', html: '<p>Hi {{first_name}}</p>' }, { first_name: 'Anna' });
    expect(r.subject).toBe('Welcome, Anna');
    expect(r.html).toBe('<p>Hi Anna</p>');
    expect(r.text).toBe('Hi Anna');
  });

  it('escapes HTML in the body but not in the subject', () => {
    const r = renderTemplate({ subject: 'Order for {{name}}', html: '<p>{{name}}</p>' }, { name: 'Tom & <Jerry>' });
    expect(r.html).toBe('<p>Tom &amp; &lt;Jerry&gt;</p>');
    expect(r.subject).toBe('Order for Tom & <Jerry>');
  });

  it('keeps a subject on one line', () => {
    expect(renderTemplate({ subject: '{{s}}', html: '' }, { s: 'a\r\nBcc: evil@example.com' }).subject).toBe(
      'a Bcc: evil@example.com',
    );
  });

  it('leaves unknown variables empty', () => {
    expect(renderTemplate({ subject: 'Hi {{nobody}}!', html: '' }).subject).toBe('Hi !');
  });

  it('renders links into the text part', () => {
    const r = renderTemplate({ subject: 's', html: '<a href="{{url}}">Activate</a>' }, { url: 'https://x.se/a' });
    expect(r.text).toBe('Activate [https://x.se/a]');
  });
});

describe('assertTemplateParses', () => {
  it('throws on a broken template', () => {
    expect(() => assertTemplateParses('{{#if x}}unclosed')).toThrow();
    expect(() => assertTemplateParses('<p>{{ok}}</p>')).not.toThrow();
  });
});
