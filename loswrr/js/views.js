/* ==========================================================================
   LOSWRR Views
   Each view is a renderer that returns an HTMLElement or replaces content.
   Designed for clarity, premium feel, and real working actions.
   ========================================================================== */
(function (global) {
  'use strict';

  const views = {};
  const el = (tag, opts, children) => {
    const e = document.createElement(tag);
    if (opts) {
      if (opts.cls) e.className = opts.cls;
      if (opts.id) e.id = opts.id;
      if (opts.html != null) e.innerHTML = opts.html;
      if (opts.text != null) e.textContent = opts.text;
      if (opts.attrs) for (const k in opts.attrs) e.setAttribute(k, opts.attrs[k]);
      if (opts.style) Object.assign(e.style, opts.style);
      if (opts.on) for (const ev in opts.on) e.addEventListener(ev, opts.on[ev]);
    }
    if (children) for (const c of children) {
      if (c == null) continue;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return e;
  };
  const icon = (name) => {
    const ICONS = {
      command: 'M3 12h4l3-9 4 18 3-9h4',
      chat: 'M21 12a8 8 0 11-3.5-6.6L21 4l-1 4.6A8 8 0 0121 12z',
      voice: 'M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v3',
      agents: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
      computer: 'M3 4h18v12H3zM8 20h8M12 16v4',
      browser: 'M12 2a10 10 0 100 20 10 10 0 000-20zM2 12h20M12 2a16 16 0 010 20M12 2a16 16 0 000 20',
      job: 'M3 7h18v13H3zM8 7V5a2 2 0 012-2h4a2 2 0 012 2v2',
      lead: 'M3 12l4-4 4 4 8-8',
      crm: 'M3 5h18M3 12h18M3 19h18',
      memory: 'M12 2a10 10 0 100 20c5 0 9-4 9-9 0-2-1-4-3-5 1-3-1-6-5-6-2 0-4 1-5 3-3 0-5 2-5 5 0 5 4 9 9 12z',
      tasks: 'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11',
      research: 'M21 21l-4.35-4.35M11 19a8 8 0 110-16 8 8 0 010 16z',
      email: 'M3 7l9 6 9-6M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2z',
      files: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6',
      automation: 'M12 6v6l4 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      activity: 'M3 12h4l3-9 4 18 3-9h4',
      settings: 'M12 1l3 4 5-1-1 5 4 3-4 3 1 5-5-1-3 4-3-4-5 1 1-5-4-3 4-3-1-5 5 1zM12 8a4 4 0 100 8 4 4 0 000-8z',
    };
    const path = ICONS[name] || ICONS.command;
    return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="' + path + '"/></svg>';
  };
  const ago = (ts) => {
    const d = Date.now() - ts;
    if (d < 60000) return Math.round(d / 1000) + 's ago';
    if (d < 3600000) return Math.round(d / 60000) + 'm ago';
    if (d < 86400000) return Math.round(d / 3600000) + 'h ago';
    return new Date(ts).toLocaleDateString();
  };

  /* ============== COMMAND CENTER ============== */
  views.command = function () {
    const root = el('div', { cls: 'view' });
    root.appendChild(el('div', { cls: 'view-header' }, [
      el('div', null, [
        el('h1', { cls: 'view-title', text: 'Command Center' }),
        el('p', { cls: 'view-sub', text: 'Good evening, Sir Aitzaz. Your LOSWRR AI OS is online.' }),
      ]),
      el('div', { cls: 'view-actions' }, [
        el('button', { cls: 'btn btn-primary', on: { click: () => LApp.go('voice') } }, [
          el('span', { html: icon('voice') }),
          document.createTextNode('Talk to LOSWRR'),
        ]),
      ]),
    ]));

    // Stats row
    const stats = el('div', { cls: 'grid grid-4' });
    const mkStat = (label, value, sub) => {
      const c = el('div', { cls: 'card stat' });
      c.appendChild(el('div', { cls: 'stat-label', text: label }));
      c.appendChild(el('div', { cls: 'stat-value', text: String(value) }));
      if (sub) c.appendChild(el('div', { cls: 'stat-sub', text: sub }));
      return c;
    };
    const jobCount = L_JobHunterAgent.all().length;
    const leadCount = L_CrmAgent.all().length;
    const taskCount = LAutomation.listTasks().filter(t => t.status !== 'DONE').length;
    const memCount = 0; // will async update
    LMemory.list().then(m => {
      const v = stats.querySelector('[data-stat="memory"] .stat-value');
      if (v) v.textContent = m.length;
    });
    stats.appendChild(mkStat('Saved Jobs', jobCount, 'Hunter status'));
    stats.appendChild(mkStat('Pipeline Leads', leadCount, 'CRM status'));
    stats.appendChild(mkStat('Open Tasks', taskCount, 'Today'));
    stats.appendChild(mkStat('Memory Items', '—', 'Loading…'));
    stats.querySelector('[data-stat="memory"]') && stats.querySelector('[data-stat="memory"]').setAttribute('data-stat', 'memory');
    // Mark for async update
    stats.lastElementChild.setAttribute('data-stat', 'memory');
    root.appendChild(stats);

    // Quick actions
    const quick = el('div', { cls: 'card' });
    quick.appendChild(el('h2', { cls: 'section-title', text: 'Quick actions' }));
    const quickRow = el('div', { cls: 'grid grid-3' });
    const quickAction = (label, sub, go) => {
      const b = el('button', { cls: 'item-card', style: { textAlign: 'left', cursor: 'pointer' } });
      b.appendChild(el('div', { cls: 'item-title', text: label }));
      b.appendChild(el('div', { cls: 'item-company', text: sub }));
      b.addEventListener('click', () => LApp.go(go));
      return b;
    };
    quickRow.appendChild(quickAction('Find remote jobs', 'Customer support > $800', 'jobs'));
    quickRow.appendChild(quickAction('Hunt roofing leads', 'Texas, 10 results', 'leads'));
    quickRow.appendChild(quickAction('Open CRM', 'Pipeline + history', 'crm'));
    quickRow.appendChild(quickAction('Memory viewer', 'Recall, edit, export', 'memory'));
    quickRow.appendChild(quickAction('Schedule automation', 'Daily job search', 'automation'));
    quickRow.appendChild(quickAction('Research brief', 'Web → summarize', 'research'));
    quick.appendChild(quickRow);
    root.appendChild(quick);

    // Live agents
    const agentsCard = el('div', { cls: 'card' });
    agentsCard.appendChild(el('h2', { cls: 'section-title', text: 'Live agents' }));
    const agentsGrid = el('div', { cls: 'grid grid-3', id: 'cmd-agents-grid' });
    LOrchestrator.allAgents().slice(0, 9).forEach(a => {
      const c = renderAgentCard(a);
      agentsGrid.appendChild(c);
    });
    agentsCard.appendChild(agentsGrid);
    const more = el('button', { cls: 'btn btn-ghost btn-sm', text: 'See all agents →', on: { click: () => LApp.go('agents') } });
    agentsCard.appendChild(more);
    root.appendChild(agentsCard);

    // Recent activity
    const recent = el('div', { cls: 'card' });
    recent.appendChild(el('h2', { cls: 'section-title', text: 'Recent activity' }));
    const list = LStorage.get('activity', []).slice(0, 6);
    if (list.length === 0) {
      recent.appendChild(el('div', { cls: 'empty' }, [
        el('div', { cls: 'empty-icon', text: '✨' }),
        el('div', { cls: 'empty-title', text: 'No activity yet' }),
        el('div', { cls: 'empty-msg', text: 'Try saying "find remote jobs" to get started.' }),
      ]));
    } else {
      for (const a of list) {
        const row = el('div', { cls: 'card-row' }, [
          el('div', null, [
            el('strong', { text: a.actor + ' ' }),
            el('span', { cls: 'card-sub', text: a.verb + ' ' }),
            el('span', { text: a.target }),
          ]),
          el('span', { cls: 'card-sub', text: ago(a.ts) }),
        ]);
        recent.appendChild(row);
      }
    }
    root.appendChild(recent);

    // Live workflow
    const wfCard = el('div', { cls: 'card' });
    wfCard.appendChild(el('h2', { cls: 'section-title', text: 'Live workflow' }));
    const wfBox = el('div', { cls: 'workflow', id: 'cmd-workflow' });
    wfBox.appendChild(el('div', { cls: 'empty' }, [
      el('div', { cls: 'empty-icon', text: '🎯' }),
      el('div', { cls: 'empty-title', text: 'No active workflow' }),
      el('div', { cls: 'empty-msg', text: 'Issue a command and the CEO will orchestrate the agents here in real time.' }),
    ]));
    wfCard.appendChild(wfBox);
    root.appendChild(wfCard);

    return root;
  };

  function renderAgentCard(a) {
    const c = el('div', { cls: 'agent-card', attrs: { 'data-agent': a.id } });
    c.style.setProperty('--agent-color', a.color || 'var(--accent)');
    c.appendChild(el('div', { cls: 'agent-head' }, [
      el('div', { cls: 'agent-icon', text: a.icon }),
      el('div', null, [
        el('div', { cls: 'agent-name', text: a.name }),
        el('div', { cls: 'agent-role', text: a.role }),
      ]),
    ]));
    c.appendChild(el('div', { cls: 'agent-task', text: a.currentTask || '—' }));
    const prog = el('div', { cls: 'agent-progress' }, [
      el('div', { cls: 'agent-progress-bar', style: { width: (a.progress || 0) + '%' } }),
    ]);
    c.appendChild(prog);
    c.appendChild(el('div', { cls: 'agent-meta' }, [
      el('span', null, [el('span', { cls: 'agent-status-dot ' + a.status }), document.createTextNode(a.status)]),
      el('span', { text: ago(a.lastResult?.ts || Date.now()) }),
    ]));
    return c;
  }
  views.renderAgentCard = renderAgentCard;

  /* ============== AI CHAT ============== */
  views.chat = function () {
    const root = el('div', { cls: 'view' });
    root.appendChild(el('div', { cls: 'view-header' }, [
      el('div', null, [
        el('h1', { cls: 'view-title', text: 'AI Chat' }),
        el('p', { cls: 'view-sub', text: 'Direct conversation with LOSWRR CEO.' }),
      ]),
    ]));
    const card = el('div', { cls: 'card', style: { padding: 0, overflow: 'hidden' } });
    const thread = el('div', { cls: 'chat-thread', id: 'chat-thread' });
    const history = LStorage.get('chat-history', []);
    if (!history.length) {
      thread.appendChild(renderChatBubble('assistant', 'Good evening, Sir Aitzaz. How can I help?'));
    } else {
      for (const m of history) thread.appendChild(renderChatBubble(m.role, m.text));
    }
    card.appendChild(thread);
    const bar = el('div', { cls: 'chat-input-bar' });
    const input = el('input', { type: 'text', placeholder: 'Type a message, Sir Aitzaz…' });
    const send = el('button', { cls: 'btn btn-primary', text: 'Send' });
    const submit = async () => {
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      thread.appendChild(renderChatBubble('user', text));
      thread.scrollTop = thread.scrollHeight;
      const r = await LOrchestrator.run(text, { source: 'chat' });
      const resp = (r && r.response) || (r && r.error) || 'No response.';
      thread.appendChild(renderChatBubble('assistant', resp));
      thread.scrollTop = thread.scrollHeight;
      const h = LStorage.get('chat-history', []);
      h.push({ role: 'user', text, ts: Date.now() });
      h.push({ role: 'assistant', text: resp, ts: Date.now() });
      LStorage.set('chat-history', h.slice(-100));
      if (LVoice.state.voiceState !== 'SPEAKING') LVoice.speak(resp);
    };
    send.addEventListener('click', submit);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    bar.appendChild(input);
    bar.appendChild(send);
    card.appendChild(bar);
    root.appendChild(card);
    setTimeout(() => { thread.scrollTop = thread.scrollHeight; }, 0);
    return root;
  };
  function renderChatBubble(role, text) {
    const wrap = el('div', { cls: 'chat-msg ' + (role === 'user' ? 'user' : 'ceo') });
    wrap.appendChild(el('div', { cls: 'chat-avatar', text: role === 'user' ? 'A' : 'L' }));
    wrap.appendChild(el('div', { cls: 'chat-bubble', text }));
    return wrap;
  }

  /* ============== VOICE ============== */
  views.voice = function () {
    const root = el('div', { cls: 'view' });
    root.appendChild(el('div', { cls: 'view-header' }, [
      el('div', null, [
        el('h1', { cls: 'view-title', text: 'Voice' }),
        el('p', { cls: 'view-sub', text: 'Wake word, push-to-talk, speaker verification, TTS.' }),
      ]),
    ]));
    if (!LVoice.isSRSupported()) {
      root.appendChild(el('div', { cls: 'demo-banner', text: 'Voice recognition is not available in this browser. LOSWRR still works in text mode.' }));
    }

    const card = el('div', { cls: 'card' });
    const ring = el('div', { cls: 'voice-hud', id: 'voice-page-hud' });
    ring.appendChild(el('div', { cls: 'voice-hud-ring' }, [
      el('div', { cls: 'voice-hud-pulse' }),
      el('div', { cls: 'voice-hud-core', html: '<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>' }),
    ]));
    ring.appendChild(el('div', { cls: 'voice-hud-text', text: LVoice.state.voiceState }));
    ring.appendChild(el('div', { cls: 'voice-hud-transcript', id: 'voice-page-transcript', text: 'Click a control below to begin.' }));
    card.appendChild(ring);

    const controls = el('div', { cls: 'grid grid-3', style: { marginTop: '20px' } });
    const ctl = (label, sub, onclick) => {
      const b = el('button', { cls: 'card', style: { textAlign: 'left', cursor: 'pointer' } });
      b.appendChild(el('div', { cls: 'card-title', text: label }));
      b.appendChild(el('div', { cls: 'card-sub', text: sub }));
      b.addEventListener('click', onclick);
      return b;
    };
    controls.appendChild(ctl('🎙 Push to talk', 'Hold the button to speak', () => LVoice.startPTT()));
    controls.appendChild(ctl('🔁 Toggle wake word', LVoice.state.isWakeWordEnabled ? 'Wake word is ON' : 'Wake word is OFF', async () => {
      if (LVoice.state.isWakeWordEnabled) { LVoice.stopWakeLoop(); LVoice.state.isWakeWordEnabled = false; }
      else { LVoice.state.isWakeWordEnabled = true; LVoice.startWakeLoop(); }
      LStorage.set('voice-wake-enabled', LVoice.state.isWakeWordEnabled);
      LApp.toast('info', 'Voice', LVoice.state.isWakeWordEnabled ? 'Wake word enabled.' : 'Wake word disabled.');
    }));
    controls.appendChild(ctl('🔊 Test TTS', 'Speak a sample sentence', () => LVoice.speak('Systems online. Good evening, Sir Aitzaz.')));
    controls.appendChild(ctl('🎚 Mute / unmute TTS', LVoice.state.isMuted ? 'Currently muted' : 'Currently audible', () => {
      const m = LVoice.toggleMute();
      LStorage.set('voice-muted', m);
      LApp.toast('info', 'Voice', m ? 'Muted.' : 'Audible.');
    }));
    controls.appendChild(ctl('⏹ Stop speaking', 'Cancel current TTS', () => LVoice.stopSpeaking()));
    controls.appendChild(ctl('🧬 Enroll speaker', 'Train voice fingerprint (3s)', async () => {
      try {
        await LVoice.enrollSpeaker();
        LApp.toast('ok', 'Voice', 'Speaker profile saved.');
      } catch (e) { LApp.toast('err', 'Voice', 'Microphone unavailable: ' + e.message); }
    }));
    controls.appendChild(ctl('🔍 Verify speaker', 'Match against enrolled profile', async () => {
      try {
        const r = await LVoice.verifySpeaker();
        if (r.reason === 'no-profile') LApp.toast('warn', 'Voice', 'No profile yet. Enroll first.');
        else LApp.toast(r.verified ? 'ok' : 'warn', 'Voice', r.verified ? 'Verified.' : ('Not verified (score ' + r.score.toFixed(2) + ').'));
      } catch (e) { LApp.toast('err', 'Voice', e.message); }
    }));
    controls.appendChild(ctl('🌐 Change language', 'en-US by default', () => LApp.toast('info', 'Voice', 'Multilingual support is in development.')));
    card.appendChild(controls);

    const transcriptCard = el('div', { cls: 'card' });
    transcriptCard.appendChild(el('h2', { cls: 'section-title', text: 'Recent transcripts' }));
    const tList = LStorage.get('transcripts', []).slice(0, 20);
    if (!tList.length) transcriptCard.appendChild(el('div', { cls: 'empty' }, [
      el('div', { cls: 'empty-icon', text: '🗣' }),
      el('div', { cls: 'empty-title', text: 'No transcripts yet' }),
      el('div', { cls: 'empty-msg', text: 'Speak or type to begin capturing transcripts.' }),
    ]));
    else for (const t of tList) {
      const row = el('div', { cls: 'card-row' }, [
        el('span', { text: t.text }),
        el('span', { cls: 'card-sub', text: ago(t.ts) }),
      ]);
      transcriptCard.appendChild(row);
    }
    root.appendChild(card);
    root.appendChild(transcriptCard);
    return root;
  };

  /* ============== AGENTS ============== */
  views.agents = function () {
    const root = el('div', { cls: 'view' });
    root.appendChild(el('div', { cls: 'view-header' }, [
      el('div', null, [
        el('h1', { cls: 'view-title', text: 'Agents' }),
        el('p', { cls: 'view-sub', text: 'CEO and 13 specialist agents. Click any to inspect.' }),
      ]),
    ]));
    const grid = el('div', { cls: 'grid grid-3', id: 'agents-grid' });
    LOrchestrator.allAgents().forEach(a => grid.appendChild(renderAgentCard(a)));
    root.appendChild(grid);
    return root;
  };

  /* ============== COMPUTER ============== */
  views.computer = function () {
    const root = el('div', { cls: 'view' });
    root.appendChild(el('div', { cls: 'view-header' }, [
      el('div', null, [
        el('h1', { cls: 'view-title', text: 'Computer' }),
        el('p', { cls: 'view-sub', text: 'Local computer control via Desktop Bridge (optional).' }),
      ]),
    ]));
    if (!LBridge.state.connected) {
      root.appendChild(el('div', { cls: 'demo-banner', text: 'Desktop Bridge not connected. The web app still works without it.' }));
    }
    const card = el('div', { cls: 'card' });
    card.appendChild(el('h2', { cls: 'section-title', text: 'Bridge connection' }));
    const formGrid = el('div', { cls: 'form-grid' });
    const epInput = el('input', { type: 'text', value: LBridge.state.endpoint || 'http://127.0.0.1:7878' });
    const connectBtn = el('button', { cls: 'btn btn-primary', text: 'Connect' });
    const disconnectBtn = el('button', { cls: 'btn', text: 'Disconnect' });
    const statusBadge = el('div', { cls: 'pill' }, [
      el('span', { cls: 'pill-dot' }),
      el('span', { cls: 'pill-text', text: LBridge.state.connected ? 'Connected' : 'Not connected' }),
    ]);
    if (LBridge.state.connected) statusBadge.classList.add('ok');
    const connect = async () => {
      LBridge.setEndpoint(epInput.value);
      const ok = await LBridge.connect();
      LApp.toast(ok ? 'ok' : 'err', 'Bridge', ok ? 'Connected to Desktop Bridge.' : 'Could not connect.');
      LApp.refreshTopbar();
      LApp.refreshView();
    };
    connectBtn.addEventListener('click', connect);
    disconnectBtn.addEventListener('click', () => { LBridge.disconnect(); LApp.toast('info', 'Bridge', 'Disconnected.'); LApp.refreshTopbar(); LApp.refreshView(); });
    formGrid.appendChild(el('div', { cls: 'form-row' }, [el('label', { text: 'Endpoint URL' }), epInput]));
    formGrid.appendChild(el('div', { cls: 'form-row' }, [el('label', { text: 'Status' }), statusBadge]));
    card.appendChild(formGrid);
    card.appendChild(el('div', { cls: 'card-actions' }, [connectBtn, disconnectBtn]));
    card.appendChild(el('p', { cls: 'card-sub', style: { marginTop: '10px' }, text: 'Run "loswrr-bridge" on Linux/ChromeOS to expose a local Unix-socket/HTTP bridge with the permissions below.' }));
    root.appendChild(card);

    // Permissions
    const permCard = el('div', { cls: 'card' });
    permCard.appendChild(el('h2', { cls: 'section-title', text: 'Permissions' }));
    const pl = el('div', { cls: 'perm-list' });
    for (const k of Object.keys(LBridge.state.permissions)) {
      const row = el('div', { cls: 'perm-item' });
      row.appendChild(el('div', null, [
        el('div', { text: k.replace(/_/g, ' ').toLowerCase() }),
        el('div', { cls: 'card-sub', text: describePermission(k) }),
      ]));
      const tog = el('button', { cls: 'toggle' + (LBridge.state.permissions[k] ? ' on' : '') });
      tog.addEventListener('click', () => {
        LBridge.setPermission(k, !LBridge.state.permissions[k]);
        tog.classList.toggle('on');
      });
      row.appendChild(tog);
      pl.appendChild(row);
    }
    permCard.appendChild(pl);
    root.appendChild(permCard);

    // Approved folders
    const folders = el('div', { cls: 'card' });
    folders.appendChild(el('h2', { cls: 'section-title', text: 'Approved folders' }));
    const fIn = el('input', { type: 'text', placeholder: '/home/aitzaz/Documents' });
    const addBtn = el('button', { cls: 'btn', text: 'Add' });
    addBtn.addEventListener('click', () => { if (fIn.value) { LBridge.addFolder(fIn.value); LApp.refreshView(); } });
    folders.appendChild(el('div', { cls: 'form-row' }, [fIn, addBtn]));
    for (const p of LBridge.state.approvedFolders) {
      const r = el('div', { cls: 'card-row' }, [
        el('span', { text: p }),
        el('button', { cls: 'btn btn-sm', text: 'Revoke', on: { click: () => { LBridge.removeFolder(p); LApp.refreshView(); } } }),
      ]);
      folders.appendChild(r);
    }
    root.appendChild(folders);
    return root;
  };
  function describePermission(k) {
    return ({
      READ_FILES: 'Read files inside approved folders',
      WRITE_FILES: 'Create or modify files inside approved folders',
      RUN_COMMANDS: 'Run shell commands (always prompts for approval)',
      SCREENSHOT: 'Capture the screen',
      CLIPBOARD: 'Read or write the clipboard',
      BROWSER_CONTROL: 'Drive the local browser (always prompts for approval)',
      NOTIFICATIONS: 'Send desktop notifications',
    })[k] || '';
  }

  /* ============== BROWSER ============== */
  views.browser = function () {
    const root = el('div', { cls: 'view' });
    root.appendChild(el('div', { cls: 'view-header' }, [
      el('div', null, [
        el('h1', { cls: 'view-title', text: 'Browser' }),
        el('p', { cls: 'view-sub', text: 'Search the web, open pages, and let the Browser Agent act within policy.' }),
      ]),
    ]));
    const card = el('div', { cls: 'card' });
    const form = el('div', { cls: 'form-row' });
    form.appendChild(el('label', { text: 'Open URL or search' }));
    const row = el('div', { style: { display: 'flex', gap: '8px' } });
    const inp = el('input', { type: 'text', placeholder: 'https://… or search query' });
    const go = el('button', { cls: 'btn btn-primary', text: 'Go' });
    row.appendChild(inp);
    row.appendChild(go);
    form.appendChild(row);
    card.appendChild(form);
    root.appendChild(card);

    const frameCard = el('div', { cls: 'card' });
    frameCard.appendChild(el('h2', { cls: 'section-title', text: 'Live view' }));
    const iframe = el('iframe', { attrs: { src: 'about:blank', sandbox: 'allow-scripts allow-forms allow-popups', style: 'width:100%;height:480px;border:0;background:#0a0f1c;border-radius:12px;' } });
    frameCard.appendChild(iframe);
    frameCard.appendChild(el('p', { cls: 'card-sub', style: { marginTop: '8px' }, text: 'Many sites block iframe embedding (X-Frame-Options). If the frame is blank, the site refuses to be embedded. Open the URL in a new tab instead.' }));
    const openNew = el('button', { cls: 'btn btn-ghost btn-sm', text: 'Open in new tab', on: { click: () => { if (iframe.src && iframe.src !== 'about:blank') window.open(iframe.src, '_blank', 'noopener'); } } });
    frameCard.appendChild(openNew);
    root.appendChild(frameCard);

    const submit = async () => {
      const text = inp.value.trim();
      if (!text) return;
      const url = /^https?:\/\//i.test(text) ? text : LBrowser.searchUrl(text);
      const r = await LBrowser.open(url, { approved: true });
      if (r.requiresApproval) {
        const ok = await LApp.confirm('Open ' + url + '?');
        if (ok) { iframe.src = url; }
      } else {
        iframe.src = url;
        LApp.toast('ok', 'Browser', 'Opened ' + url);
        LApp.emit('activity', { actor: 'Browser', verb: 'opened', target: url });
      }
    };
    go.addEventListener('click', submit);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    return root;
  };

  /* ============== JOB HUNTER ============== */
  views.jobs = function () {
    const root = el('div', { cls: 'view' });
    root.appendChild(el('div', { cls: 'view-header' }, [
      el('div', null, [
        el('h1', { cls: 'view-title', text: 'Job Hunter' }),
        el('p', { cls: 'view-sub', text: 'Search, score, save, and apply to jobs that fit your profile.' }),
      ]),
      el('div', { cls: 'view-actions' }, [
        el('button', { cls: 'btn btn-ghost', text: 'Refresh', on: { click: () => LApp.refreshView() } }),
        el('button', { cls: 'btn btn-primary', text: 'Hunt', on: { click: () => LApp.runCommand('Find remote customer support jobs paying more than $800') } }),
      ]),
    ]));
    if (!LStorage.get('jobs', []).length) {
      root.appendChild(el('div', { cls: 'demo-banner', text: 'No saved jobs yet. Click "Hunt" to run a search. Results are demo data until a live job API is connected.' }));
    }
    const jobs = L_JobHunterAgent.all();
    const grid = el('div', { cls: 'grid grid-auto' });
    if (!jobs.length) {
      grid.appendChild(el('div', { cls: 'empty' }, [
        el('div', { cls: 'empty-icon', text: '💼' }),
        el('div', { cls: 'empty-title', text: 'No jobs saved' }),
        el('div', { cls: 'empty-msg', text: 'Try: "find remote jobs", "save the best five", or "draft a cover letter".' }),
      ]));
    } else {
      for (const j of jobs) {
        const c = el('div', { cls: 'item-card' });
        c.appendChild(el('div', { cls: 'item-head' }, [
          el('div', null, [
            el('div', { cls: 'item-title', text: j.position }),
            el('div', { cls: 'item-company', text: j.company + ' · ' + j.location }),
          ]),
          el('span', { cls: 'tag ' + (j.status === 'NEW' ? 'info' : (j.status === 'MATCHED' ? 'ok' : 'secondary')), text: j.status }),
        ]));
        c.appendChild(el('div', { cls: 'card-sub', text: j.description }));
        c.appendChild(el('div', { cls: 'item-meta' }, [
          el('span', { text: '💰 ' + (j.salary || '—') }),
          el('span', { text: '⏱ ' + (j.type || '—') }),
        ]));
        if (j.skills) c.appendChild(el('div', { cls: 'item-meta' }, j.skills.map(s => el('span', { cls: 'tag neutral', text: s }))));
        const scoreBar = el('div', { cls: 'score-bar' }, [el('div', { cls: 'score-bar-fill', style: { width: (j.matchScore || 0) + '%' } })]);
        c.appendChild(scoreBar);
        c.appendChild(el('div', { cls: 'score-text' }, [
          el('span', { text: 'Match' }),
          el('span', { text: (j.matchScore || 0) + '%' }),
        ]));
        c.appendChild(el('div', { cls: 'item-foot' }, [
          el('button', { cls: 'btn btn-sm', text: 'View', on: { click: () => LApp.openUrl(j.url) } }),
          el('button', { cls: 'btn btn-sm btn-primary', text: 'Cover letter', on: { click: () => LApp.runCommand('Generate cover letter for ' + j.position + ' at ' + j.company) } }),
          el('button', { cls: 'btn btn-sm', text: 'Mark applied', on: { click: () => { j.status = 'APPLIED'; L_JobHunterAgent.save(jobs.map(x => x.id === j.id ? j : x)); LApp.refreshView(); LApp.toast('ok', 'Jobs', 'Marked as APPLIED.'); } } }),
        ]));
        grid.appendChild(c);
      }
    }
    root.appendChild(grid);
    return root;
  };

  /* ============== LEAD HUNTER ============== */
  views.leads = function () {
    const root = el('div', { cls: 'view' });
    root.appendChild(el('div', { cls: 'view-header' }, [
      el('div', null, [
        el('h1', { cls: 'view-title', text: 'Lead Hunter' }),
        el('p', { cls: 'view-sub', text: 'Find, qualify, and score business leads.' }),
      ]),
      el('div', { cls: 'view-actions' }, [
        el('button', { cls: 'btn btn-primary', text: 'Hunt Texas roofing', on: { click: () => LApp.runCommand('Find 10 roofing companies in Texas and prepare outreach') } }),
      ]),
    ]));
    if (!L_CrmAgent.all().length) {
      root.appendChild(el('div', { cls: 'demo-banner', text: 'No leads in the CRM yet. Click "Hunt Texas roofing" to populate demo data.' }));
    }
    const leads = L_CrmAgent.all();
    const grid = el('div', { cls: 'grid grid-auto' });
    for (const l of leads) {
      const c = el('div', { cls: 'item-card' });
      c.appendChild(el('div', { cls: 'item-head' }, [
        el('div', null, [
          el('div', { cls: 'item-title', text: l.company }),
          el('div', { cls: 'item-company', text: l.owner + ' · ' + l.title }),
        ]),
        el('span', { cls: 'tag ' + statusToClass(l.status), text: l.status }),
      ]));
      c.appendChild(el('div', { cls: 'card-sub', text: l.notes || '—' }));
      c.appendChild(el('div', { cls: 'item-meta' }, [
        el('span', { text: '📍 ' + l.location }),
        el('span', { text: '🏷 ' + l.industry }),
        el('span', { text: '✉ ' + (l.email || '—') }),
        el('span', { text: '☎ ' + (l.phone || '—') }),
      ]));
      const sb = el('div', { cls: 'score-bar' }, [el('div', { cls: 'score-bar-fill', style: { width: (l.leadScore || 0) + '%' } })]);
      c.appendChild(sb);
      c.appendChild(el('div', { cls: 'score-text' }, [
        el('span', { text: 'Score' }),
        el('span', { text: (l.leadScore || 0) }),
      ]));
      c.appendChild(el('div', { cls: 'item-foot' }, [
        el('button', { cls: 'btn btn-sm', text: 'CRM', on: { click: () => LApp.go('crm') } }),
        el('button', { cls: 'btn btn-sm btn-primary', text: 'Draft outreach', on: { click: () => LApp.runCommand('Draft outreach email for ' + l.company) } }),
      ]));
      grid.appendChild(c);
    }
    root.appendChild(grid);
    return root;
  };
  function statusToClass(s) {
    if (s === 'NEW' || s === 'QUALIFIED') return 'info';
    if (s === 'CONTACTED' || s === 'FOLLOW-UP') return 'warn';
    if (s === 'INTERESTED' || s === 'CLOSED') return 'ok';
    if (s === 'LOST') return 'err';
    return 'secondary';
  }

  /* ============== CRM ============== */
  views.crm = function () {
    const root = el('div', { cls: 'view' });
    root.appendChild(el('div', { cls: 'view-header' }, [
      el('div', null, [
        el('h1', { cls: 'view-title', text: 'CRM' }),
        el('p', { cls: 'view-sub', text: 'Pipeline, statuses, notes, follow-ups.' }),
      ]),
    ]));
    const card = el('div', { cls: 'card', style: { padding: 0 } });
    const wrap = el('div', { cls: 'table-wrap' });
    const t = el('table', { cls: 'table' });
    t.innerHTML = '<thead><tr><th>Company</th><th>Owner</th><th>Industry</th><th>Location</th><th>Score</th><th>Status</th><th>Updated</th><th></th></tr></thead>';
    const tb = el('tbody');
    for (const l of L_CrmAgent.all()) {
      const tr = el('tr');
      tr.innerHTML = '<td><strong>' + esc(l.company) + '</strong></td><td>' + esc(l.owner) + '</td><td>' + esc(l.industry) + '</td><td>' + esc(l.location) + '</td><td>' + (l.leadScore || 0) + '</td><td><span class="tag ' + statusToClass(l.status) + '">' + esc(l.status) + '</span></td><td>' + (l.updated ? ago(l.updated) : '—') + '</td>';
      const td = el('td');
      const select = el('select', null, ['NEW', 'QUALIFIED', 'CONTACTED', 'FOLLOW-UP', 'INTERESTED', 'CLOSED', 'LOST'].map(s => {
        const o = el('option', { text: s, attrs: { value: s } });
        if (s === l.status) o.selected = true;
        return o;
      }));
      select.addEventListener('change', () => {
        l.status = select.value;
        L_CrmAgent.upsert(l);
        L_CrmAgent.addHistory(l.id, { type: 'status-change', from: l.status, to: select.value });
        LApp.toast('ok', 'CRM', 'Status updated.');
      });
      td.appendChild(select);
      tr.appendChild(td);
      tb.appendChild(tr);
    }
    t.appendChild(tb);
    wrap.appendChild(t);
    card.appendChild(wrap);
    root.appendChild(card);
    return root;
  };
  function esc(s) { return String(s == null ? '' : s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c])); }

  /* ============== MEMORY ============== */
  views.memory = function () {
    const root = el('div', { cls: 'view' });
    root.appendChild(el('div', { cls: 'view-header' }, [
      el('div', null, [
        el('h1', { cls: 'view-title', text: 'Memory' }),
        el('p', { cls: 'view-sub', text: 'Structured long-term memory across 10 categories.' }),
      ]),
      el('div', { cls: 'view-actions' }, [
        el('button', { cls: 'btn btn-ghost', text: 'Export JSON', on: { click: exportMemory } }),
      ]),
    ]));
    const card = el('div', { cls: 'card' });
    card.appendChild(el('h2', { cls: 'section-title', text: 'Filter' }));
    const chips = el('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } });
    const allCat = el('button', { cls: 'cat-chip active', text: 'All', attrs: { 'data-cat': 'all' } });
    chips.appendChild(allCat);
    LMemory.CATEGORIES.forEach(c => {
      const b = el('button', { cls: 'cat-chip', text: c, attrs: { 'data-cat': c } });
      b.addEventListener('click', () => {
        document.querySelectorAll('.cat-chip').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        renderList(b.dataset.cat);
      });
      chips.appendChild(b);
    });
    allCat.addEventListener('click', () => {
      document.querySelectorAll('.cat-chip').forEach(x => x.classList.remove('active'));
      allCat.classList.add('active');
      renderList('all');
    });
    card.appendChild(chips);
    const search = el('input', { type: 'text', placeholder: 'Search memory…' });
    card.appendChild(search);
    const listCard = el('div', { cls: 'card', id: 'memory-list' });
    function renderList(cat) {
      const q = search.value.trim();
      LMemory.list({ category: cat === 'all' ? null : cat }).then(items => {
        const filtered = q ? items.filter(x => (x.text || '').toLowerCase().includes(q.toLowerCase())) : items;
        listCard.innerHTML = '';
        if (!filtered.length) {
          listCard.appendChild(el('div', { cls: 'empty' }, [
            el('div', { cls: 'empty-icon', text: '🧠' }),
            el('div', { cls: 'empty-title', text: 'No memories here' }),
            el('div', { cls: 'empty-msg', text: 'Try saying "remember that my target market is US roofing companies".' }),
          ]));
          return;
        }
        for (const m of filtered) {
          const row = el('div', { cls: 'card' });
          row.appendChild(el('div', { cls: 'card-row' }, [
            el('div', null, [
              el('span', { cls: 'tag info', text: m.category }),
              ' ',
              el('span', { text: m.text }),
            ]),
            el('span', { cls: 'card-sub', text: ago(m.created) }),
          ]));
          const acts = el('div', { cls: 'card-actions' });
          acts.appendChild(el('button', { cls: 'btn btn-sm', text: 'Edit', on: { click: () => editMemory(m) } }));
          acts.appendChild(el('button', { cls: 'btn btn-sm btn-danger', text: 'Delete', on: { click: async () => { await LMemory.remove(m.id); LApp.toast('info', 'Memory', 'Deleted.'); LApp.refreshView(); } } }));
          row.appendChild(acts);
          listCard.appendChild(row);
        }
      });
    }
    search.addEventListener('input', () => {
      const active = document.querySelector('.cat-chip.active');
      renderList(active ? active.dataset.cat : 'all');
    });
    root.appendChild(card);
    root.appendChild(listCard);
    renderList('all');
    return root;

    function editMemory(m) {
      const newText = prompt('Edit memory:', m.text);
      if (newText && newText !== m.text) {
        LMemory.update(m.id, { text: newText });
        LApp.toast('ok', 'Memory', 'Updated.');
        LApp.refreshView();
      }
    }
    async function exportMemory() {
      const data = await LMemory.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'loswrr-memory-' + Date.now() + '.json';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  /* ============== TASKS ============== */
  views.tasks = function () {
    const root = el('div', { cls: 'view' });
    root.appendChild(el('div', { cls: 'view-header' }, [
      el('div', null, [
        el('h1', { cls: 'view-title', text: 'Tasks' }),
        el('p', { cls: 'view-sub', text: 'Natural-language tasks and follow-ups.' }),
      ]),
      el('div', { cls: 'view-actions' }, [
        el('button', { cls: 'btn btn-primary', text: 'New task', on: { click: () => addTask() } }),
      ]),
    ]));
    const list = LAutomation.listTasks();
    if (!list.length) {
      root.appendChild(el('div', { cls: 'demo-banner', text: 'No tasks yet. Try: "remind me tomorrow at 10 AM to follow up with John".' }));
    }
    const card = el('div', { cls: 'card', style: { padding: 0 } });
    const wrap = el('div', { cls: 'table-wrap' });
    const t = el('table', { cls: 'table' });
    t.innerHTML = '<thead><tr><th>Task</th><th>Priority</th><th>Date</th><th>Time</th><th>Status</th><th></th></tr></thead>';
    const tb = el('tbody');
    for (const task of list) {
      const tr = el('tr');
      tr.innerHTML = '<td><strong>' + esc(task.title) + '</strong></td><td>' + esc(task.priority) + '</td><td>' + esc(task.date || '—') + '</td><td>' + esc(task.time || '—') + '</td><td><span class="tag ' + (task.status === 'DONE' ? 'ok' : (task.status === 'IN PROGRESS' ? 'warn' : 'info')) + '">' + esc(task.status) + '</span></td>';
      const td = el('td');
      const cycle = el('button', { cls: 'btn btn-sm', text: task.status === 'DONE' ? 'Reopen' : 'Done' });
      cycle.addEventListener('click', () => {
        LAutomation.update(task.id, { status: task.status === 'DONE' ? 'TODO' : 'DONE' });
        LApp.toast('ok', 'Tasks', 'Updated.');
        LApp.refreshView();
      });
      const del = el('button', { cls: 'btn btn-sm btn-danger', text: 'Delete' });
      del.addEventListener('click', () => { LAutomation.remove(task.id); LApp.refreshView(); });
      td.appendChild(cycle); td.appendChild(del);
      tr.appendChild(td);
      tb.appendChild(tr);
    }
    t.appendChild(tb);
    wrap.appendChild(t);
    card.appendChild(wrap);
    root.appendChild(card);
    return root;
    function addTask() {
      const text = prompt('Describe the task (e.g. "tomorrow at 10am follow up with John"):');
      if (!text) return;
      const parsed = LAutomation.parseDateTime(text);
      LAutomation.create({ title: parsed.title, date: parsed.date, time: parsed.time, status: 'TODO' });
      LApp.toast('ok', 'Tasks', 'Created.');
      LApp.refreshView();
    }
  };

  /* ============== RESEARCH ============== */
  views.research = function () {
    const root = el('div', { cls: 'view' });
    root.appendChild(el('div', { cls: 'view-header' }, [
      el('div', null, [
        el('h1', { cls: 'view-title', text: 'Research' }),
        el('p', { cls: 'view-sub', text: 'Web research with extract → verify → compare → summarize.' }),
      ]),
    ]));
    const card = el('div', { cls: 'card' });
    const row = el('div', { style: { display: 'flex', gap: '8px' } });
    const inp = el('input', { type: 'text', placeholder: 'Research query…' });
    const go = el('button', { cls: 'btn btn-primary', text: 'Research' });
    row.appendChild(inp); row.appendChild(go);
    card.appendChild(row);
    root.appendChild(card);
    const listCard = el('div', { cls: 'card' });
    listCard.appendChild(el('h2', { cls: 'section-title', text: 'Past research' }));
    const all = LResearch.list();
    if (!all.length) {
      listCard.appendChild(el('div', { cls: 'empty' }, [
        el('div', { cls: 'empty-icon', text: '🔍' }),
        el('div', { cls: 'empty-title', text: 'No research yet' }),
        el('div', { cls: 'empty-msg', text: 'Try: "research competitor pricing for SaaS helpdesk tools".' }),
      ]));
    } else for (const r of all) {
      const c = el('div', { cls: 'card' });
      c.appendChild(el('div', { cls: 'card-title', text: r.query }));
      c.appendChild(el('div', { cls: 'card-sub', text: (r.source || '') + ' · ' + ago(r.created) }));
      c.appendChild(el('div', { style: { marginTop: '8px' }, text: r.summary || '' }));
      const ul = el('ul', { style: { paddingLeft: '18px', color: 'var(--text-1)', fontSize: '13px' } });
      for (const s of (r.results || []).slice(0, 5)) {
        ul.appendChild(el('li', null, [
          el('a', { text: s.title, attrs: { href: s.url, target: '_blank', rel: 'noopener' } }),
          el('span', { cls: 'card-sub', text: ' — ' + (s.snippet || '').slice(0, 120) }),
        ]));
      }
      c.appendChild(ul);
      listCard.appendChild(c);
    }
    root.appendChild(listCard);
    const submit = async () => {
      const q = inp.value.trim();
      if (!q) return;
      go.disabled = true; go.textContent = 'Researching…';
      try {
        await LResearch.research(q);
        LApp.toast('ok', 'Research', 'Done.');
        LApp.refreshView();
      } catch (e) {
        LApp.toast('err', 'Research', e.message);
      } finally {
        go.disabled = false; go.textContent = 'Research';
      }
    };
    go.addEventListener('click', submit);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    return root;
  };

  /* ============== EMAIL ============== */
  views.email = function () {
    const root = el('div', { cls: 'view' });
    root.appendChild(el('div', { cls: 'view-header' }, [
      el('div', null, [
        el('h1', { cls: 'view-title', text: 'Email' }),
        el('p', { cls: 'view-sub', text: 'Gmail integration (OAuth required for live data). Drafts and approvals live here.' }),
      ]),
    ]));
    root.appendChild(el('div', { cls: 'demo-banner', text: 'No Gmail account connected. Demo inbox shown. Sending requires approval and OAuth.' }));
    const listCard = el('div', { cls: 'card' });
    listCard.appendChild(el('h2', { cls: 'section-title', text: 'Inbox' }));
    const list = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } });
    for (const e of LEmail.list()) {
      const r = el('div', { cls: 'card-row' });
      r.innerHTML = '<div><strong>' + (e.read ? '' : '● ') + esc(e.from) + '</strong><div class="card-sub">' + esc(e.subject) + '</div></div><div class="card-sub">' + ago(e.date) + '</div>';
      r.style.cursor = 'pointer';
      r.addEventListener('click', () => { LEmail.markRead(e.id); LApp.toast('ok', 'Email', 'Opened (read).'); LApp.refreshView(); });
      list.appendChild(r);
    }
    listCard.appendChild(list);
    root.appendChild(listCard);

    const drafts = LStorage.get('email-drafts', []);
    const draftCard = el('div', { cls: 'card' });
    draftCard.appendChild(el('h2', { cls: 'section-title', text: 'Drafts' }));
    if (!drafts.length) draftCard.appendChild(el('div', { cls: 'empty' }, [el('div', { cls: 'empty-icon', text: '✉️' }), el('div', { cls: 'empty-title', text: 'No drafts' })]));
    else for (const d of drafts) {
      const c = el('div', { cls: 'card' });
      c.appendChild(el('div', { cls: 'card-title', text: d.subject || '(no subject)' }));
      c.appendChild(el('div', { cls: 'card-sub', text: 'To: ' + (d.to || '—') + ' · ' + ago(d.created) }));
      c.appendChild(el('div', { style: { whiteSpace: 'pre-wrap', marginTop: '8px' }, text: d.body || '' }));
      c.appendChild(el('div', { cls: 'card-actions' }, [
        el('button', { cls: 'btn btn-sm', text: 'Edit', on: { click: () => { const v = prompt('Edit draft:', d.body); if (v != null) { d.body = v; LStorage.set('email-drafts', drafts.map(x => x.id === d.id ? d : x)); LApp.toast('ok', 'Email', 'Updated.'); LApp.refreshView(); } } } }),
        el('button', { cls: 'btn btn-sm btn-danger', text: 'Delete', on: { click: () => { LStorage.set('email-drafts', drafts.filter(x => x.id !== d.id)); LApp.refreshView(); } } }),
        el('button', { cls: 'btn btn-sm btn-primary', text: 'Send (with approval)', on: { click: async () => { const ok = await LApp.confirm('Send this email?'); if (ok) { LEmail.send({ to: d.to, subject: d.subject, body: d.body, approved: true }); LApp.toast('ok', 'Email', 'Queued.'); } } } }),
      ]));
      draftCard.appendChild(c);
    }
    root.appendChild(draftCard);
    return root;
  };

  /* ============== FILES ============== */
  views.files = function () {
    const root = el('div', { cls: 'view' });
    root.appendChild(el('div', { cls: 'view-header' }, [
      el('div', null, [
        el('h1', { cls: 'view-title', text: 'Files' }),
        el('p', { cls: 'view-sub', text: 'PDF, DOCX, TXT, CSV, JSON, images.' }),
      ]),
    ]));
    const card = el('div', { cls: 'card' });
    const fileIn = el('input', { type: 'file', attrs: { multiple: '' } });
    card.appendChild(fileIn);
    const list = el('div', { id: 'files-list' });
    const list2 = LFiles.list();
    if (!list2.length) list.appendChild(el('div', { cls: 'empty' }, [el('div', { cls: 'empty-icon', text: '📄' }), el('div', { cls: 'empty-title', text: 'No files yet' })]));
    else for (const f of list2) {
      const c = el('div', { cls: 'card' });
      c.appendChild(el('div', { cls: 'card-title', text: f.name + ' (' + f.kind + ')' }));
      c.appendChild(el('div', { cls: 'card-sub', text: ago(f.uploaded) + (f.size ? ' · ' + Math.round(f.size / 1024) + ' KB' : '') }));
      if (f.summary) c.appendChild(el('div', { style: { marginTop: '8px' }, text: f.summary }));
      c.appendChild(el('div', { cls: 'card-actions' }, [
        el('button', { cls: 'btn btn-sm', text: 'Summarize', on: { click: async () => { const s = await LFiles.summarize({ kind: f.kind, text: f.text }); f.summary = s; LFiles.add(f); LApp.toast('ok', 'Files', 'Summarized.'); LApp.refreshView(); } } }),
        el('button', { cls: 'btn btn-sm btn-danger', text: 'Delete', on: { click: () => { LFiles.remove(f.id); LApp.refreshView(); } } }),
      ]));
      list.appendChild(c);
    }
    card.appendChild(list);
    root.appendChild(card);
    fileIn.addEventListener('change', async () => {
      for (const f of fileIn.files) {
        const parsed = await LFiles.parse(f);
        const summary = await LFiles.summarize(parsed);
        LFiles.add({ name: f.name, kind: parsed.kind, size: f.size, summary, text: parsed.text });
      }
      LApp.toast('ok', 'Files', 'Uploaded.');
      LApp.refreshView();
    });
    return root;
  };

  /* ============== AUTOMATION ============== */
  views.automation = function () {
    const root = el('div', { cls: 'view' });
    root.appendChild(el('div', { cls: 'view-header' }, [
      el('div', null, [
        el('h1', { cls: 'view-title', text: 'Automation' }),
        el('p', { cls: 'view-sub', text: 'Schedule recurring workflows. Background execution requires the PWA service worker.' }),
      ]),
      el('div', { cls: 'view-actions' }, [
        el('button', { cls: 'btn btn-primary', text: 'New automation', on: { click: addAutomation } }),
      ]),
    ]));
    const card = el('div', { cls: 'card', style: { padding: 0 } });
    const wrap = el('div', { cls: 'table-wrap' });
    const t = el('table', { cls: 'table' });
    t.innerHTML = '<thead><tr><th>Name</th><th>Trigger</th><th>Action</th><th>Last run</th><th>Next run</th><th>Status</th><th></th></tr></thead>';
    const tb = el('tbody');
    for (const a of LAutomation.listAutomations()) {
      const tr = el('tr');
      tr.innerHTML = '<td><strong>' + esc(a.name) + '</strong></td><td>' + esc(describeTrigger(a.trigger)) + '</td><td>' + esc(a.action.kind + (a.action.workflow ? ':' + a.action.workflow : '')) + '</td><td>' + (a.lastRun ? ago(a.lastRun) : '—') + '</td><td>' + (a.nextRun ? new Date(a.nextRun).toLocaleString() : '—') + '</td><td><span class="tag ' + (a.status === 'DISABLED' ? 'neutral' : 'ok') + '">' + esc(a.status) + '</span></td>';
      const td = el('td');
      const tog = el('button', { cls: 'btn btn-sm', text: a.status === 'DISABLED' ? 'Enable' : 'Disable' });
      tog.addEventListener('click', () => { LAutomation.toggleAutomation(a.id, a.status === 'DISABLED'); LApp.refreshView(); });
      const del = el('button', { cls: 'btn btn-sm btn-danger', text: 'Delete' });
      del.addEventListener('click', () => { LAutomation.removeAutomation(a.id); LApp.refreshView(); });
      td.appendChild(tog); td.appendChild(del);
      tr.appendChild(td);
      tb.appendChild(tr);
    }
    t.appendChild(tb);
    wrap.appendChild(t);
    card.appendChild(wrap);
    root.appendChild(card);
    return root;
    function addAutomation() {
      const name = prompt('Name:', 'Daily job search');
      if (!name) return;
      const cron = prompt('Cron expression (m h dom mon dow):', '0 9 * * *');
      if (!cron) return;
      LScheduler.add({ name, trigger: { kind: 'cron', expr: cron }, action: { kind: 'workflow', workflow: 'job_hunt' } });
      LApp.toast('ok', 'Automation', 'Scheduled.');
      LApp.refreshView();
    }
  };
  function describeTrigger(t) {
    if (!t) return '—';
    if (t.kind === 'interval') return 'every ' + Math.round(t.ms / 60000) + ' min';
    if (t.kind === 'cron') return 'cron: ' + t.expr;
    if (t.kind === 'once') return 'once at ' + new Date(t.at).toLocaleString();
    return t.kind;
  }

  /* ============== ACTIVITY ============== */
  views.activity = function () {
    const root = el('div', { cls: 'view' });
    root.appendChild(el('div', { cls: 'view-header' }, [
      el('div', null, [
        el('h1', { cls: 'view-title', text: 'Activity' }),
        el('p', { cls: 'view-sub', text: 'Every agent action, in order. Nothing hidden.' }),
      ]),
      el('div', { cls: 'view-actions' }, [
        el('button', { cls: 'btn btn-ghost', text: 'Clear', on: { click: () => { LStorage.set('activity', []); LApp.refreshView(); } } }),
      ]),
    ]));
    const list = LStorage.get('activity', []);
    if (!list.length) {
      root.appendChild(el('div', { cls: 'empty' }, [
        el('div', { cls: 'empty-icon', text: '🛰' }),
        el('div', { cls: 'empty-title', text: 'No activity yet' }),
      ]));
      return root;
    }
    const card = el('div', { cls: 'card' });
    for (const a of list) {
      card.appendChild(el('div', { cls: 'card-row' }, [
        el('div', null, [
          el('strong', { text: a.actor + ' ' }),
          el('span', { cls: 'card-sub', text: a.verb + ' ' }),
          el('span', { text: a.target }),
        ]),
        el('span', { cls: 'card-sub', text: ago(a.ts) }),
      ]));
    }
    root.appendChild(card);
    return root;
  };

  /* ============== SETTINGS ============== */
  views.settings = function () {
    const root = el('div', { cls: 'view' });
    root.appendChild(el('div', { cls: 'view-header' }, [
      el('div', null, [
        el('h1', { cls: 'view-title', text: 'Settings' }),
        el('p', { cls: 'view-sub', text: 'Identity, providers, security, integrations.' }),
      ]),
    ]));

    const card0 = el('div', { cls: 'card' });
    card0.appendChild(el('h2', { cls: 'section-title', text: 'Identity' }));
    card0.appendChild(el('div', { cls: 'card-row' }, [el('span', { text: 'AI' }), el('strong', { text: 'LOSWRR AI' })]));
    card0.appendChild(el('div', { cls: 'card-row' }, [el('span', { text: 'CEO / Owner' }), el('strong', { text: 'Aitzaz' })]));
    card0.appendChild(el('div', { cls: 'card-row' }, [el('span', { text: 'Address' }), el('strong', { text: '"Sir Aitzaz"' })]));
    card0.appendChild(el('div', { cls: 'card-row' }, [el('span', { text: 'Tagline' }), el('strong', { text: 'Your Personal AI Operating System' })]));
    root.appendChild(card0);

    const card1 = el('div', { cls: 'card' });
    card1.appendChild(el('h2', { cls: 'section-title', text: 'AI Provider Manager' }));
    card1.appendChild(el('div', { cls: 'card-sub', text: 'Configure cloud and local providers. API keys are AES-encrypted at rest and never logged.' }));
    const list = el('div', { cls: 'grid grid-2' });
    LProviders.list().forEach(p => {
      const cfg = LProviders.getConfig(p.key);
      const isActive = LProviders.getActive() === p.key;
      const isFallback = LProviders.getFallback() === p.key;
      const c = el('div', { cls: 'provider-card' + (isActive ? ' active' : '') });
      c.appendChild(el('div', { cls: 'provider-icon', text: p.icon }));
      c.appendChild(el('div', { style: { flex: 1 } }, [
        el('div', { cls: 'provider-name', text: p.name }),
        el('div', { cls: 'provider-meta', text: (p.type === 'local' ? 'Local · ' : 'Cloud · ') + (cfg.model || p.defaultModel) }),
        el('div', { style: { display: 'flex', gap: '6px', marginTop: '8px' } }, [
          isActive ? el('span', { cls: 'tag ok', text: 'ACTIVE' }) : el('button', { cls: 'btn btn-sm', text: 'Set active', on: { click: () => { LProviders.setActive(p.key); LApp.toast('ok', 'Provider', p.name + ' active.'); LApp.refreshView(); LApp.refreshTopbar(); } } }),
          isFallback ? el('span', { cls: 'tag secondary', text: 'FALLBACK' }) : el('button', { cls: 'btn btn-sm', text: 'Set fallback', on: { click: () => { LProviders.setFallback(p.key); LApp.refreshView(); } } }),
        ]),
      ]));
      list.appendChild(c);
    });
    card1.appendChild(list);

    // Per-provider config
    const provCfg = el('div', { cls: 'card' });
    provCfg.appendChild(el('h2', { cls: 'section-title', text: 'Provider credentials' }));
    LProviders.list().forEach(p => {
      const cfg = LProviders.getConfig(p.key);
      const grp = el('div', { cls: 'card' });
      grp.appendChild(el('div', { cls: 'card-title', text: p.name }));
      const fg = el('div', { cls: 'form-grid' });
      const modelSel = el('select');
      (p.models || []).forEach(m => {
        const o = el('option', { text: m, attrs: { value: m } });
        if ((cfg.model || p.defaultModel) === m) o.selected = true;
        modelSel.appendChild(o);
      });
      modelSel.addEventListener('change', () => LProviders.setConfig(p.key, { model: modelSel.value }));
      const keyInp = el('input', { type: 'password', placeholder: p.type === 'local' ? 'API key (optional)' : 'API key', attrs: { autocomplete: 'off' } });
      const setBtn = el('button', { cls: 'btn', text: 'Save' });
      setBtn.addEventListener('click', async () => {
        try {
          await LProviders.setApiKey(p.key, keyInp.value);
          LApp.toast('ok', 'Provider', 'Saved.');
        } catch (e) { LApp.toast('err', 'Provider', e.message); }
      });
      fg.appendChild(el('div', { cls: 'form-row' }, [el('label', { text: 'Model' }), modelSel]));
      fg.appendChild(el('div', { cls: 'form-row' }, [el('label', { text: 'API key' }), keyInp]));
      grp.appendChild(fg);
      grp.appendChild(setBtn);
      if (p.type === 'local') {
        const base = el('input', { type: 'text', value: cfg.baseUrl || p.baseUrl, attrs: { placeholder: 'Base URL' } });
        base.addEventListener('change', () => LProviders.setConfig(p.key, { baseUrl: base.value }));
        grp.appendChild(el('div', { cls: 'form-row' }, [el('label', { text: 'Base URL' }), base]));
      }
      provCfg.appendChild(grp);
    });
    root.appendChild(card1);
    root.appendChild(provCfg);

    // Security
    const sec = el('div', { cls: 'card' });
    sec.appendChild(el('h2', { cls: 'section-title', text: 'Security' }));
    const pinRow = el('div', { cls: 'form-grid' });
    const oldPin = el('input', { type: 'password', placeholder: 'Current PIN' });
    const newPin = el('input', { type: 'password', placeholder: 'New PIN (4-12 digits)' });
    const changeBtn = el('button', { cls: 'btn btn-primary', text: 'Change PIN' });
    changeBtn.addEventListener('click', async () => {
      const ok = await LSecurity.changePin(oldPin.value, newPin.value);
      LApp.toast(ok ? 'ok' : 'err', 'Security', ok ? 'PIN changed.' : 'Wrong current PIN.');
    });
    pinRow.appendChild(el('div', { cls: 'form-row' }, [el('label', { text: 'Current PIN' }), oldPin]));
    pinRow.appendChild(el('div', { cls: 'form-row' }, [el('label', { text: 'New PIN' }), newPin]));
    sec.appendChild(pinRow);
    sec.appendChild(changeBtn);
    const logoutBtn = el('button', { cls: 'btn', text: 'Lock now' });
    logoutBtn.addEventListener('click', () => LApp.lock());
    sec.appendChild(logoutBtn);

    const auditBtn = el('button', { cls: 'btn btn-ghost', text: 'View audit log', on: { click: () => showAudit() } });
    sec.appendChild(auditBtn);
    root.appendChild(sec);

    // Credits
    const cred = el('div', { cls: 'card' });
    cred.appendChild(el('h2', { cls: 'section-title', text: 'Credits & attribution' }));
    cred.appendChild(el('div', { cls: 'card-sub', text: 'LOSWRR AI OS is built on the open-source Aitzaz-OS foundation (MIT) — a JARVIS-style voice, memory, agent, and security platform originally by Chris Lassiter (github.com/muhammadlai/Aitzaz-OS). The original JARVIS ecosystem, Alice desktop (MIT, Slava Trofimov), and Hermes Agent architecture are preserved as the foundation of this build. LOSWRR AI branding, the CEO orchestrator, multi-agent system, Job Hunter, Lead Hunter, CRM, and CEO/OWNER identity (Aitzaz) are additions for this build.' }));
    root.appendChild(cred);

    return root;

    function showAudit() {
      const log = LSecurity.auditLog().slice(0, 50);
      const text = log.map(e => '[' + new Date(e.ts).toISOString() + '] ' + e.action + ' ' + e.result).join('\n');
      alert('Audit log (latest 50):\n\n' + text);
    }
  };

  /* ============== NAV ============== */
  const NAV = [
    { key: 'command',   label: 'Command Center', icon: 'command' },
    { key: 'chat',      label: 'AI Chat',        icon: 'chat' },
    { key: 'voice',     label: 'Voice',          icon: 'voice' },
    { key: 'agents',    label: 'Agents',         icon: 'agents' },
    { key: 'computer',  label: 'Computer',       icon: 'computer' },
    { key: 'browser',   label: 'Browser',        icon: 'browser' },
    { key: 'jobs',      label: 'Job Hunter',     icon: 'job' },
    { key: 'leads',     label: 'Lead Hunter',    icon: 'lead' },
    { key: 'crm',       label: 'CRM',            icon: 'crm' },
    { key: 'memory',    label: 'Memory',         icon: 'memory' },
    { key: 'tasks',     label: 'Tasks',          icon: 'tasks' },
    { key: 'research',  label: 'Research',       icon: 'research' },
    { key: 'email',     label: 'Email',          icon: 'email' },
    { key: 'files',     label: 'Files',          icon: 'files' },
    { key: 'automation',label: 'Automation',     icon: 'automation' },
    { key: 'activity',  label: 'Activity',       icon: 'activity' },
    { key: 'settings',  label: 'Settings',       icon: 'settings' },
  ];
  views.NAV = NAV;
  views.renderNav = function (active, onClick) {
    const list = el('nav', { cls: 'nav-list' });
    NAV.forEach(n => {
      const b = el('button', { cls: 'nav-item' + (n.key === active ? ' active' : '') });
      b.appendChild(el('div', { cls: 'nav-icon', html: icon(n.icon) }));
      b.appendChild(el('div', { cls: 'nav-text', text: n.label }));
      b.addEventListener('click', () => onClick(n.key));
      list.appendChild(b);
    });
    return list;
  };

  global.LViews = views;
})(window);
