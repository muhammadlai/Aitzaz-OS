/* ==========================================================================
   LOSWRR Email Service
   Prepares a Gmail integration architecture.
   Live sending requires OAuth (never store tokens in plaintext) and
   always requires explicit user approval.
   ========================================================================== */
(function (global) {
  'use strict';

  function list() {
    return LStorage.get('emails', LDemo.emails);
  }
  function unread() {
    return list().filter(e => !e.read);
  }
  function search(q) {
    const ql = (q || '').toLowerCase();
    return list().filter(e =>
      (e.subject || '').toLowerCase().includes(ql) ||
      (e.from || '').toLowerCase().includes(ql) ||
      (e.snippet || '').toLowerCase().includes(ql)
    );
  }
  function markRead(id) {
    const arr = list();
    const e = arr.find(x => x.id === id);
    if (e) { e.read = true; LStorage.set('emails', arr); }
  }

  /* Draft generation */
  async function draft(opts) {
    opts = opts || {};
    const sys = 'You are LOSWRR Email Agent. Draft concise, professional emails. Address the recipient with respect, lead with value, and end with a clear single ask. Do not include placeholders that are not provided.';
    const user = 'Context: ' + (opts.context || 'cold outreach') + '\n' +
      'Recipient: ' + (opts.to || '') + ' (' + (opts.title || '') + ' at ' + (opts.company || '') + ')\n' +
      'Tone: ' + (opts.tone || 'warm, professional, brief') + '\n' +
      'Goal: ' + (opts.goal || 'book a 15-min call') + '\n\nDraft the email.';
    const r = await LProviders.respond([
      { role: 'system', content: sys },
      { role: 'user', content: user },
    ], { temperature: 0.6, max_tokens: 400 });
    if (r.mode === 'demo') {
      // Return a real, usable demo draft so the email agent has something to show
      return [
        'Subject: Quick idea for ' + (opts.company || 'your team'),
        '',
        'Hi ' + (opts.owner || (opts.title ? 'there' : '')) + ',',
        '',
        'I help ' + (opts.industry || 'home services') + ' companies like ' + (opts.company || 'yours') + ' fill the pipeline with qualified leads, not noise. In the last 12 months I have helped contractors in ' + (opts.location || 'TX') + ' double their booked estimates without doubling ad spend.',
        '',
        'Would a 15-minute call next week make sense to see if there is a fit?',
        '',
        'Best,',
        'Aitzaz',
        'LOSWRR AI OS',
      ].join('\n');
    }
    return r.text;
  }

  /* Send simulation — never actually sends without OAuth + user approval */
  async function send(opts) {
    if (!opts || !opts.to || !opts.subject || !opts.body) {
      return { ok: false, reason: 'Missing to/subject/body' };
    }
    if (!opts.approved) return { ok: false, reason: 'User approval required' };
    // Store as sent
    const sent = LStorage.get('emails-sent', []);
    sent.unshift({ id: 's_' + Date.now(), to: opts.to, subject: opts.subject, body: opts.body, sentAt: Date.now() });
    LStorage.set('emails-sent', sent);
    return { ok: true, queued: true, mode: 'demo' };
  }

  function sent() { return LStorage.get('emails-sent', []); }

  global.LEmail = { list, unread, search, markRead, draft, send, sent };
})(window);
