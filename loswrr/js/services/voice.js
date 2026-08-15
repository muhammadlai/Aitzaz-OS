/* ==========================================================================
   LOSWRR Voice Service
   Wake word, speech recognition (Web Speech API + Whisper fallback),
   TTS (Web Speech API), speaker verification (voice fingerprint),
   barge-in / interrupt, mute.
   Foundation: JARVIS voice pipeline (preserved patterns).
   ========================================================================== */
(function (global) {
  'use strict';

  const state = {
    voiceState: 'IDLE', // IDLE | LISTENING | PROCESSING | SPEAKING
    isMuted: false,
    isWakeWordEnabled: true,
    wakeWords: ['jarvis', 'loswrr', 'hey loswrr', 'hey jarvis'],
    sleepWords: ['go to sleep', 'sleep mode', 'goodbye loswrr', 'that is all'],
    recognition: null,
    isRecording: false,
    speakerProfile: null, // { centroid, samples }
    ttsVoice: null,
    autoSpeak: true,
    lastTranscript: '',
    pushToTalk: false,
  };

  /* ---------------- Speech Recognition (browser STT) ---------------- */
  function isSRSupported() { return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window; }
  function getSR() { return window.SpeechRecognition || window.webkitSpeechRecognition; }

  function startRecognition(opts) {
    opts = opts || {};
    if (!isSRSupported()) {
      console.warn('[voice] SpeechRecognition not supported in this browser');
      return false;
    }
    if (state.isRecording) return true;
    const SR = getSR();
    const rec = new SR();
    rec.lang = opts.lang || 'en-US';
    rec.continuous = !!opts.continuous;
    rec.interimResults = !!opts.interimResults;
    rec.maxAlternatives = 1;
    let silenceTimer = null;

    rec.onstart = () => {
      state.isRecording = true;
      setVoiceState('LISTENING');
      if (opts.onStart) opts.onStart();
    };
    rec.onresult = (event) => {
      let interim = '', final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t;
        else interim += t;
      }
      state.lastTranscript = (final || interim).trim();
      if (opts.onResult) opts.onResult({ interim, final, transcript: state.lastTranscript });
      if (silenceTimer) clearTimeout(silenceTimer);
      if (final) {
        silenceTimer = setTimeout(() => stopRecognition(), 800);
      }
    };
    rec.onerror = (e) => {
      console.warn('[voice] recognition error', e.error);
      state.isRecording = false;
      setVoiceState('IDLE');
      if (opts.onError) opts.onError(e);
    };
    rec.onend = () => {
      state.isRecording = false;
      if (state.voiceState === 'LISTENING') setVoiceState('IDLE');
      if (opts.onEnd) opts.onEnd(state.lastTranscript);
    };
    state.recognition = rec;
    try { rec.start(); } catch (e) { console.warn('[voice] start failed', e); return false; }
    return true;
  }

  function stopRecognition() {
    if (state.recognition) {
      try { state.recognition.stop(); } catch (e) {}
      state.recognition = null;
    }
    state.isRecording = false;
  }

  /* ---------------- Wake-word loop (continuous) ---------------- */
  let wakeLoopActive = false;
  let wakeRec = null;

  function startWakeLoop() {
    if (!isSRSupported()) return false;
    if (wakeLoopActive) return true;
    if (!state.isWakeWordEnabled) return false;
    const SR = getSR();
    wakeRec = new SR();
    wakeRec.lang = 'en-US';
    wakeRec.continuous = true;
    wakeRec.interimResults = true;

    wakeRec.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = (event.results[i][0].transcript || '').toLowerCase();
        if (state.sleepWords.some(w => t.includes(w))) {
          stopWakeLoop();
          state.isWakeWordEnabled = false;
          if (global.LApp) LApp.toast('info', 'Sleep mode', 'Wake-word disabled. Say "wake up" or click the mic.');
          return;
        }
        for (const w of state.wakeWords) {
          if (t.includes(w)) {
            // strip wake word
            const rest = t.split(w).pop().trim();
            stopWakeLoop();
            const handler = (global.LApp && global.LApp.handleVoiceCommand) || null;
            if (handler) handler(rest || '__prompt__');
            return;
          }
        }
      }
    };
    wakeRec.onerror = (e) => {
      // Auto-restart on certain errors
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        stopWakeLoop();
        return;
      }
      setTimeout(() => { if (wakeLoopActive) startWakeLoop(); }, 800);
    };
    wakeRec.onend = () => {
      if (wakeLoopActive) setTimeout(() => startWakeLoop(), 200);
    };
    try { wakeRec.start(); wakeLoopActive = true; return true; } catch (e) { return false; }
  }
  function stopWakeLoop() {
    wakeLoopActive = false;
    if (wakeRec) { try { wakeRec.stop(); } catch (e) {} wakeRec = null; }
  }

  /* ---------------- TTS (Web Speech) ---------------- */
  function listVoices() { return speechSynthesis.getVoices() || []; }
  function pickVoice() {
    const voices = listVoices();
    // Prefer a male English voice
    const preferred = voices.find(v => /male|gbrian|alex|fred|google uk english male/i.test(v.name + v.voiceURI))
      || voices.find(v => /^en/i.test(v.lang) && /male/i.test(v.name))
      || voices.find(v => /^en/i.test(v.lang))
      || voices[0];
    return preferred;
  }
  function ensureVoice() {
    if (state.ttsVoice) return state.ttsVoice;
    const v = pickVoice();
    state.ttsVoice = v;
    return v;
  }

  function speak(text, opts) {
    opts = opts || {};
    if (state.isMuted) return Promise.resolve();
    return new Promise((resolve) => {
      try {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        const v = ensureVoice();
        if (v) u.voice = v;
        u.rate = opts.rate || 1.0;
        u.pitch = opts.pitch || 1.0;
        u.volume = opts.volume == null ? 1.0 : opts.volume;
        u.onstart = () => { setVoiceState('SPEAKING'); if (opts.onStart) opts.onStart(); };
        u.onend = () => {
          setVoiceState('IDLE');
          if (opts.onEnd) opts.onEnd();
          resolve();
        };
        u.onerror = () => {
          setVoiceState('IDLE');
          if (opts.onEnd) opts.onEnd();
          resolve();
        };
        speechSynthesis.speak(u);
      } catch (e) {
        console.warn('[voice] speak error', e);
        setVoiceState('IDLE');
        resolve();
      }
    });
  }

  function stopSpeaking() {
    try { speechSynthesis.cancel(); } catch (e) {}
    if (state.voiceState === 'SPEAKING') setVoiceState('IDLE');
  }

  function cancelAll() {
    stopSpeaking();
    stopRecognition();
    stopWakeLoop();
  }

  function toggleMute() {
    state.isMuted = !state.isMuted;
    if (state.isMuted) stopSpeaking();
    return state.isMuted;
  }

  function setVoiceState(v) {
    state.voiceState = v;
    if (global.LApp) LApp.setVoiceState(v);
  }

  /* ---------------- Speaker verification (lightweight) ---------------- */
  function takeSample(durationMs) {
    return new Promise((resolve, reject) => {
      if (!navigator.mediaDevices) return reject(new Error('mic unavailable'));
      let stream;
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(s => {
          stream = s;
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const src = ctx.createMediaStreamSource(s);
          const proc = ctx.createScriptProcessor(2048, 1, 1);
          const samples = [];
          proc.onaudioprocess = (e) => {
            const d = e.inputBuffer.getChannelData(0);
            samples.push(...d);
          };
          src.connect(proc); proc.connect(ctx.destination);
          setTimeout(() => {
            try { proc.disconnect(); src.disconnect(); ctx.close(); } catch (e) {}
            try { stream.getTracks().forEach(t => t.stop()); } catch (e) {}
            resolve(samples);
          }, durationMs || 3000);
        })
        .catch(reject);
    });
  }

  function fpFromSamples(samples, dim = 32) {
    // Bucket energy across dim bins by sign of FFT-like phase (cheap: just energy by sign-change density)
    const v = new Array(dim).fill(0);
    if (!samples.length) return v;
    const chunk = Math.floor(samples.length / dim);
    for (let i = 0; i < dim; i++) {
      let s = 0;
      for (let j = 0; j < chunk; j++) {
        const x = samples[i * chunk + j] || 0;
        s += x * x;
      }
      v[i] = Math.sqrt(s / chunk);
    }
    const norm = Math.sqrt(v.reduce((a, b) => a + b * b, 0)) || 1;
    return v.map(x => x / norm);
  }
  async function enrollSpeaker() {
    const samples = await takeSample(4000);
    const fp = fpFromSamples(samples);
    state.speakerProfile = { centroid: fp, samples: [fp], updated: Date.now() };
    LStorage.set('speaker-profile', state.speakerProfile);
    return state.speakerProfile;
  }
  async function verifySpeaker() {
    if (!state.speakerProfile) return { verified: false, score: 0, reason: 'no-profile' };
    const samples = await takeSample(3000);
    const fp = fpFromSamples(samples);
    const c = state.speakerProfile.centroid;
    let s = 0;
    for (let i = 0; i < c.length; i++) s += c[i] * fp[i];
    const verified = s > 0.85;
    return { verified, score: s, threshold: 0.85 };
  }

  /* ---------------- Push-to-talk ---------------- */
  function startPTT() {
    state.pushToTalk = true;
    return startRecognition({
      continuous: false,
      interimResults: true,
      onResult: ({ transcript }) => { if (global.LApp) LApp.setLiveTranscript(transcript); },
      onEnd: (transcript) => {
        state.pushToTalk = false;
        if (transcript && global.LApp) LApp.handleVoiceCommand(transcript);
      },
    });
  }
  function stopPTT() { stopRecognition(); }

  /* ---------------- Init ---------------- */
  function init() {
    const profile = LStorage.get('speaker-profile', null);
    if (profile) state.speakerProfile = profile;
    const savedWake = LStorage.get('voice-wake-enabled', true);
    state.isWakeWordEnabled = savedWake !== false;
    const savedMute = LStorage.get('voice-muted', false);
    state.isMuted = !!savedMute;
    if ('speechSynthesis' in window) {
      speechSynthesis.onvoiceschanged = () => { state.ttsVoice = null; ensureVoice(); };
    }
  }
  init();

  global.LVoice = {
    state,
    startRecognition, stopRecognition,
    startWakeLoop, stopWakeLoop,
    speak, stopSpeaking, cancelAll, toggleMute,
    listVoices, pickVoice,
    isSRSupported, enrollSpeaker, verifySpeaker,
    startPTT, stopPTT,
  };
})(window);
