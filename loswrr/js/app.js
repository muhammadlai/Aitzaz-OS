/* ==========================================================================
   LOSWRR App — main glue
   ========================================================================== */
(function (global) {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const App = {
    /* ---------- Auth ---------- */
    async tryAuth() {
      $('auth-gate').hidden = false;
      $('auth-pin').focus();
      $('auth-submit').addEventListener('click', () => this.submitPin());
      $('auth-pin').addEventListener('keydown', e => { if (e.key === 'Enter') this.submitPin(); });
    },
    async submitPin() {
      const pin = $('auth-pin').value;
      const ok = await LSecurity.verify(pin);
      if (!ok) {
        $('auth-hint').textContent = 'Wrong PIN. Try again.';
        $('auth-pin').value = '';
        $('auth-pin').focus();
        return;
      }
      $('auth-gate').hidden = true;
      $('app').hidden = false;
      this.boot();
    },
    lock() { LSecurity.logout(); location.reload(); },

    /* ---------- Boot ---------- */
    async boot() {
      // Hydrate UI
      this.refreshTopbar();
      this.refreshNav();
      this.refreshView();
      // Wire global UI
      this.wireTopbar();
      this.wireCommandBar();
      this.wireActivity();
      this.wireApproval();
      this.wireEvents();
      // Greet
      this.greet();
      // Probe providers
      LProviders.list().forEach(p => LProviders.probe(p.key));
      // Auto-enroll demo data if first run
      this.seedIfEmpty();
      // Restore activity log to drawer
      this.replayActivity();
      // Update topbar providers
      setTimeout(() => this.refreshTopbar(), 1000);
    },

    seedIfEmpty() {
      if (!LStorage.get('seeded-v1', false)) {
        LStorage.set('emails', LDemo.emails);
        // Seed a couple of memories for context
        LMemory.add('Owner: Aitzaz (CEO).', { category: 'PERSONAL' });
        LMemory.add('Primary target market: US roofing companies.', { category: 'BUSINESS' });
        LMemory.add('Job priority: remote work, customer support > $800/mo.', { category: 'JOBS' });
        LStorage.set('seeded-v1', true);
      }
    },

    async greet() {
      try {
        await LVoice.speak('Good evening, Sir Aitzaz. How can I help?');
      } catch (e) { /* no TTS */ }
    },

    /* ---------- Events ---------- */
    wireEvents() {
      // activity updates
      LApp_ref(this);
      global.LApp = this;
    },
    emit(kind, data) {
      if (kind === 'activity') this.pushActivity(data);
      if (kind === 'workflow') this.renderWorkflow(data.steps);
      if (kind === 'agent-update') this.updateAgentCard(data);
      if (kind === 'approval-required') this.openApproval(data);
    },
    pushActivity({ actor, verb, target }) {
      const list = LStorage.get('activity', []);
      list.unshift({ ts: Date.now(), actor, verb, target });
      LStorage.set('activity', list.slice(0, 200));
      const li = $('activity-list');
      const liEl = document.createElement('li');
      liEl.className = 'activity-item';
      liEl.innerHTML = '<div class="activity-time">' + new Date().toLocaleTimeString() + '</div>' +
        '<div class="activity-text"><span class="actor">' + actor + '</span> <span class="verb">' + verb + '</span> <span class="target">' + target + '</span></div>';
      liEl.style.opacity = '0';
      li.insertBefore(liEl, li.firstChild);
      requestAnimationFrame(() => liEl.style.opacity = '1');
      while (li.children.length > 50) li.removeChild(li.lastChild);
    },
    replayActivity() {
      const list = LStorage.get('activity', []);
      for (const a of list.slice(0, 20)) this.pushActivity(a);
    },
    renderWorkflow(steps) {
      // Render in command center's workflow box if present, else draw a floating banner
      const box = $('cmd-workflow');
      if (box) {
        box.innerHTML = '';
        steps.forEach((s, i) => {
          const row = document.createElement('div');
          row.className = 'workflow-step active';
          row.innerHTML = '<div class="workflow-step-num">' + (i + 1) + '</div>' +
            '<div><div class="workflow-step-name">' + s.agent + '</div>' +
            '<div class="workflow-step-desc">' + s.action + '</div></div>';
          box.appendChild(row);
          if (i < steps.length - 1) {
            const arr = document.createElement('div');
            arr.className = 'workflow-step-arrow';
            arr.textContent = '↓';
            box.appendChild(arr);
          }
        });
        if (App._wfTimeout) clearTimeout(App._wfTimeout);
        App._wfTimeout = setTimeout(() => { box.innerHTML = ''; box.appendChild(emptyState('No active workflow', '🎯')); }, 15000);
      }
    },
    updateAgentCard({ id, status, currentTask, progress, lastAction }) {
      document.querySelectorAll('[data-agent="' + id + '"]').forEach(c => {
        const dot = c.querySelector('.agent-status-dot');
        if (dot && status) { dot.className = 'agent-status-dot ' + status; }
        const task = c.querySelector('.agent-task');
        if (task && currentTask != null) task.textContent = currentTask || '—';
        const bar = c.querySelector('.agent-progress-bar');
        if (bar && progress != null) bar.style.width = progress + '%';
      });
    },

    /* ---------- Approval Modal ---------- */
    wireApproval() {
      $('approval-deny').addEventListener('click', () => this.resolveApproval(false));
      $('approval-allow').addEventListener('click', () => this.resolveApproval(true));
    },
    openApproval(data) {
      $('approval-body').innerHTML =
        '<p>The ' + (data.agent || 'agent') + ' is requesting approval for this action:</p>' +
        '<pre>' + JSON.stringify(data.payload || data, null, 2) + '</pre>' +
        '<p class="card-sub">Approve only if you initiated this action. Destructive actions are blocked by policy.</p>';
      $('approval-modal').hidden = false;
      this._approvalResolve = null;
      this._approvalPromise = new Promise(res => { this._approvalResolve = res; });
    },
    resolveApproval(ok) {
      $('approval-modal').hidden = true;
      if (this._approvalResolve) this._approvalResolve(ok);
    },
    confirm(text) {
      this.openApproval({ agent: 'confirmation', payload: { question: text } });
      return this._approvalPromise;
    },

    /* ---------- Topbar ---------- */
    refreshTopbar() {
      const p = LProviders.get(LProviders.getActive());
      const pill = $('pill-provider');
      if (p) {
        pill.querySelector('.pill-text').textContent = p.name;
        pill.className = 'pill info';
      }
      const bridge = $('pill-bridge');
      bridge.querySelector('.pill-text').textContent = LBridge.state.connected ? 'Bridge ON' : 'Bridge OFF';
      bridge.className = 'pill ' + (LBridge.state.connected ? 'ok' : '');
      const voice = $('pill-voice');
      const vs = LVoice.state.voiceState;
      voice.querySelector('.pill-text').textContent = 'Voice: ' + vs;
      voice.className = 'pill ' + (vs === 'SPEAKING' ? 'ok' : (vs === 'LISTENING' ? 'info' : (vs === 'PROCESSING' ? 'warn' : '')));
      // CEO orb state
      const ceo = L_CEOAgent.getAgent();
      const orb = $('ceo-orb');
      const state = ceo.status || 'IDLE';
      orb.className = 'ceo-orb state-' + state;
      $('orb-text').textContent = state;
    },

    wireTopbar() {
      $('nav-toggle').addEventListener('click', () => document.getElementById('app').classList.toggle('nav-collapsed'));
      $('mic-btn').addEventListener('click', () => {
        if (LVoice.state.isRecording) LVoice.stopPTT();
        else LVoice.startPTT();
      });
      $('mute-btn').addEventListener('click', () => {
        const m = LVoice.toggleMute();
        LStorage.set('voice-muted', m);
        this.toast('info', 'Voice', m ? 'Muted.' : 'Audible.');
      });
      $('stop-btn').addEventListener('click', () => LVoice.stopSpeaking());
    },

    /* ---------- Command bar ---------- */
    wireCommandBar() {
      const inp = $('cmd-input');
      const send = $('cmd-send');
      const go = () => {
        const t = inp.value.trim();
        if (!t) return;
        inp.value = '';
        this.runCommand(t);
      };
      send.addEventListener('click', go);
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
      document.addEventListener('keydown', e => {
        if (e.key === ' ' && document.activeElement === document.body) {
          e.preventDefault(); LVoice.startPTT();
        }
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
          e.preventDefault(); inp.focus();
        }
        if (e.key === 'Escape') {
          LVoice.stopSpeaking();
          $('voice-hud').hidden = true;
        }
      });
    },

    async runCommand(text, opts) {
      opts = opts || {};
      this.toast('info', 'CEO', 'Received: ' + text);
      try {
        const r = await LOrchestrator.run(text, { source: 'command-bar' });
        if (r && r.response) {
          this.toast('ok', 'CEO', r.response);
          if (!opts.silent) LVoice.speak(r.response);
        }
        this.refreshView();
      } catch (e) {
        this.toast('err', 'CEO', e.message);
      }
    },

    async handleVoiceCommand(text) {
      if (text === '__prompt__' || !text || !text.trim()) {
        this.toast('info', 'Voice', 'Listening…');
        LVoice.startPTT();
        return;
      }
      LStorage.push('transcripts', { ts: Date.now(), text });
      this.runCommand(text);
    },

    setLiveTranscript(t) {
      const el = $('voice-hud-transcript') || $('voice-page-transcript');
      if (el) el.textContent = t;
      const hud = $('voice-hud');
      if (hud && !LVoice.state.isRecording) hud.hidden = false;
    },
    setVoiceState(v) {
      const hud = $('voice-hud');
      if (hud) {
        hud.className = 'voice-hud state-' + v;
        hud.querySelector('.voice-hud-text').textContent = v;
        hud.hidden = (v === 'IDLE');
      }
      const pageHud = $('voice-page-hud');
      if (pageHud) {
        pageHud.className = 'voice-hud state-' + v;
        pageHud.querySelector('.voice-hud-text').textContent = v;
      }
      this.refreshTopbar();
    },

    /* ---------- Activity Drawer ---------- */
    wireActivity() {
      $('activity-clear').addEventListener('click', () => { LStorage.set('activity', []); $('activity-list').innerHTML = ''; });
    },

    /* ---------- Nav ---------- */
    refreshNav() {
      const list = $('nav-list');
      list.innerHTML = '';
      const nav = LViews.renderNav(LRouter.current, (key) => LRouter.go(key));
      while (nav.firstChild) list.appendChild(nav.firstChild);
    },
    go(view) { LRouter.go(view); },
    refreshView() {
      const view = LRouter.current;
      this.refreshNav();
      const fn = LViews[view] || LViews.command;
      const content = $('content');
      content.innerHTML = '';
      const v = fn();
      content.appendChild(v);
      this.refreshTopbar();
      this.updateModeBadge();
    },
    updateModeBadge() {
      const badge = $('mode-badge');
      const isDemo = !LProviders.getApiKey(LProviders.getActive());
      badge.textContent = isDemo ? 'DEMO MODE' : 'ONLINE AI';
      badge.className = 'mode-badge ' + (isDemo ? '' : 'live');
    },

    openUrl(url) { window.open(url, '_blank', 'noopener'); },

    /* ---------- Toasts ---------- */
    toast(kind, title, msg) {
      const root = $('toasts');
      const t = document.createElement('div');
      t.className = 'toast ' + kind;
      t.innerHTML = '<div><div class="toast-title">' + title + '</div><div class="toast-msg">' + (msg || '') + '</div></div>';
      root.appendChild(t);
      setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(20px)'; }, 4500);
      setTimeout(() => t.remove(), 5000);
    },
  };

  function LApp_ref(self) { /* placeholder for circular */ }
  function emptyState(title, icon) {
    const d = document.createElement('div');
    d.className = 'empty';
    d.innerHTML = '<div class="empty-icon">' + (icon || '✨') + '</div><div class="empty-title">' + title + '</div>';
    return d;
  }

  global.LApp = App;

  // Wire router -> App
  LRouter.on(() => App.refreshView());

  document.addEventListener('DOMContentLoaded', () => {
    App.tryAuth();
  });
})(window);
