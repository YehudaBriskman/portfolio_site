import type { BasicTemplateParams } from '../types/index.js';

export function renderBasicTemplate(p: BasicTemplateParams) {
  const safe = (s?: string) =>
    (s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.5">
      ${p.title ? `<h2>${safe(p.title)}</h2>` : ''}
      <p style="white-space:pre-wrap">${safe(p.body)}</p>
      ${p.ctaHref ? `<p><a href="${safe(p.ctaHref)}" style="display:inline-block;padding:10px 16px;border:1px solid #ccc;border-radius:8px;text-decoration:none">${safe(p.ctaText || 'Open')}</a></p>` : ''}
      <hr/><small style="color:#666">If you didn’t expect this email, you can ignore it.</small>
    </div>
  `.trim();

  const text = `${p.title ? p.title + '\n\n' : ''}${p.body}\n` +
               (p.ctaHref ? `\n${p.ctaText || 'Open'}: ${p.ctaHref}\n` : '');
  return { html, text };
}
