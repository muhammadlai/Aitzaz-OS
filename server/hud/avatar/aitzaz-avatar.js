/* ============================================================================
   AITZAZ AI PRO — built-in holographic avatar
   ----------------------------------------------------------------------------
   A canvas-rendered holographic head that is driven ENTIRELY by the real
   assistant pipeline state (same events that drive speech, brain and voice):

     setState("idle"|"booting"|"listening"|"speech"|"thinking"|"speaking"
             |"paused"|"mic_off"|"stopped"|"error")
     setMicLevel(0..1)    — live microphone level (listening/speech states)
     setSpeakLevel(0..1)  — live TTS output level (speaking state)

   The avatar animates while listening (attentive visor), while processing
   (scan + fast orbits), while speaking (mouth waveform synced to the voice),
   and idles with breathing glow + blinking when nothing is happening.

   Swap-in contract: any other avatar system can replace this file's
   implementation by exposing the same global `AitzazAvatar` API — see
   avatar/README.md.
   ========================================================================== */
"use strict";

const AitzazAvatar = (() => {
  let cv = null, ctx = null, host = null;
  let running = false;
  let state = "idle";
  let micLevel = 0, speakLevel = 0;
  let t0 = performance.now();

  // eased parameters (targets are set per state each frame)
  const P = {
    glow: 0, visor: 0, eyeOpen: 1, bob: 0, ringSpeed: 0.25, scan: 0,
    mouth: 0, flicker: 0, alpha: 1, tilt: 0, blink: 1,
  };
  let scanPhase = 0, nextBlink = 3000, lastBlink = 0;

  /* ------------------------------------------------------------ lifecycle */
  function init(hostEl) {
    if (cv) return;
    host = hostEl;
    cv = document.createElement("canvas");
    cv.className = "aitzaz-avatar-canvas";
    host.appendChild(cv);
    ctx = cv.getContext("2d");
    resize();
    window.addEventListener("resize", resize);
    if (!running) { running = true; requestAnimationFrame(frame); }
  }

  function resize() {
    if (!cv || !host) return;
    const r = host.getBoundingClientRect();
    cv.width = Math.max(2, Math.round(r.width * devicePixelRatio));
    cv.height = Math.max(2, Math.round(r.height * devicePixelRatio));
  }

  /* --------------------------------------------------------------- public */
  function setState(st) { state = st; }
  function setMicLevel(v) { micLevel = clamp01(v); }
  function setSpeakLevel(v) { speakLevel = clamp01(v); }
  function destroy() {
    running = false;
    if (cv) { cv.remove(); cv = null; ctx = null; }
  }
  const clamp01 = v => Math.min(1, Math.max(0, Number(v) || 0));
  const lerp = (a, b, k) => a + (b - a) * k;

  /* -------------------------------------------------------------- targets */
  function targets() {
    const t = { glow: 0.55, visor: 0.5, eyeOpen: 1, bobAmp: 0.06, ringSpeed: 0.25,
                scanSpeed: 0.00006, mouth: 0, flicker: 0, alpha: 1, tilt: 0,
                blinkRate: 3200, color: "#00e5ff" };
    switch (state) {
      case "booting":
        t.glow = 0.35; t.visor = 0.25; t.eyeOpen = 0.2; t.ringSpeed = 0.6;
        t.scanSpeed = 0.0012; t.bobAmp = 0; t.blinkRate = 1e9;
        break;
      case "listening":
        t.glow = 0.75 + micLevel * 0.5; t.visor = 0.65 + micLevel * 0.4;
        t.eyeOpen = 1; t.ringSpeed = 0.45; t.bobAmp = 0.05;
        t.blinkRate = 2600;
        break;
      case "speech":   // user is talking — the avatar listens intently
        t.glow = 0.9 + micLevel * 0.6; t.visor = 0.85 + micLevel * 0.4;
        t.eyeOpen = 0.85; t.ringSpeed = 0.7 + micLevel; t.mouth = 0.12;
        t.bobAmp = 0.08; t.blinkRate = 4200;
        break;
      case "thinking": // brain processing — scan + fast orbits
        t.glow = 0.8; t.visor = 0.55; t.eyeOpen = 0.35; t.ringSpeed = 1.6;
        t.scanSpeed = 0.0009; t.bobAmp = 0.02; t.color = "#ffb300";
        t.blinkRate = 1e9;
        break;
      case "speaking": // voice out — mouth waveform follows TTS level
        t.glow = 0.85 + speakLevel * 0.5; t.visor = 0.75 + speakLevel * 0.35;
        t.eyeOpen = 1; t.ringSpeed = 0.55; t.mouth = speakLevel;
        t.bobAmp = 0.07; t.blinkRate = 3600;
        break;
      case "paused":
        t.glow = 0.25; t.visor = 0.18; t.eyeOpen = 0.12; t.ringSpeed = 0.05;
        t.bobAmp = 0.015; t.blinkRate = 1e9; t.color = "#4d7d92";
        break;
      case "mic_off":
        t.glow = 0.08; t.visor = 0.05; t.eyeOpen = 0.05; t.ringSpeed = 0;
        t.bobAmp = 0; t.alpha = 0.35; t.blinkRate = 1e9; t.color = "#4d7d92";
        break;
      case "stopped":
        t.glow = 0; t.visor = 0; t.eyeOpen = 0; t.ringSpeed = 0; t.bobAmp = 0;
        t.alpha = 0.12; t.blinkRate = 1e9;
        break;
      case "error":
        t.glow = 0.7; t.visor = 0.5; t.ringSpeed = 0.05; t.flicker = 0.5;
        t.color = "#ff4d5e";
        break;
      default: // idle
        t.blinkRate = 3400;
    }
    return t;
  }

  /* ---------------------------------------------------------------- render */
  function frame(now) {
    if (!running) return;
    const dt = Math.min(64, now - t0); t0 = now;
    const tg = targets();
    const k = 1 - Math.pow(0.0015, dt / 16.7); // frame-rate independent easing
    P.glow = lerp(P.glow, tg.glow, k);
    P.visor = lerp(P.visor, tg.visor, k);
    P.eyeOpen = lerp(P.eyeOpen, tg.eyeOpen, k);
    P.ringSpeed = lerp(P.ringSpeed, tg.ringSpeed, k);
    P.mouth = lerp(P.mouth, tg.mouth, k);
    P.alpha = lerp(P.alpha, tg.alpha, k);
    P.tilt = lerp(P.tilt, tg.tilt, k);
    P.flicker = lerp(P.flicker, tg.flicker, k);
    scanPhase = (scanPhase + tg.scanSpeed * dt) % 1.4;

    // blinking
    if (now - lastBlink > tg.blinkRate) { lastBlink = now; P.blink = 0; }
    if (now - lastBlink < 130) P.blink = 0.06 + 0.94 * Math.sin((now - lastBlink) / 130 * Math.PI);
    else P.blink = 1;

    if (!cv || !ctx) { requestAnimationFrame(frame); return; }
    const W = cv.width, H = cv.height;
    const cx = W / 2, cy = H / 2;
    const t = now / 1000;
    const unit = Math.min(W, H);
    const bob = Math.sin(t * 1.4) * tg.bobAmp * unit * 0.5;

    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.globalAlpha = P.alpha;
    ctx.translate(0, bob);
    ctx.rotate(P.tilt);

    const color = tg.color;
    const dpr = devicePixelRatio;

    /* ------- orbital rings behind the head ------- */
    const ringR = unit * 0.33 * (1 + Math.sin(t * 2.1) * 0.015);
    const rot = t * P.ringSpeed;
    glowStroke(ctx, color, 0.5 * P.glow * dpr);
    dashRing(ctx, cx, cy, ringR, unit * 0.006, color, [40, 18], rot * 2);
    glowStroke(ctx, color, 0.25 * P.glow * dpr);
    dashRing(ctx, cx, cy, ringR * 1.14, unit * 0.0025, color, [4, 10], -rot * 3);
    glowStroke(ctx, color, 0.35 * P.glow * dpr);
    dashRing(ctx, cx, cy, ringR * 0.88, unit * 0.0035, color, [90, 40], rot * 1.2);

    /* ------- head silhouette ------- */
    const hw = unit * 0.205;               // half width
    const hh = unit * 0.24;                // half height of dome
    const chin = cy + unit * 0.075;
    const domeTop = cy - hh;

    ctx.save();
    ctx.beginPath();
    // dome
    ctx.moveTo(cx - hw, cy + unit * 0.02);
    ctx.bezierCurveTo(cx - hw, domeTop + unit * 0.05, cx - hw * 0.6, domeTop, cx, domeTop);
    ctx.bezierCurveTo(cx + hw * 0.6, domeTop, cx + hw, domeTop + unit * 0.05, cx + hw, cy + unit * 0.02);
    // jaw tapers to chin
    ctx.bezierCurveTo(cx + hw * 0.85, cy + unit * 0.12, cx + hw * 0.35, chin + unit * 0.03, cx, chin + unit * 0.02);
    ctx.bezierCurveTo(cx - hw * 0.35, chin + unit * 0.03, cx - hw * 0.85, cy + unit * 0.12, cx - hw, cy + unit * 0.02);
    ctx.closePath();

    // fill: faint holographic body
    const fillGrad = ctx.createLinearGradient(cx, domeTop, cx, chin);
    fillGrad.addColorStop(0, color + "14");
    fillGrad.addColorStop(1, color + "05");
    ctx.fillStyle = fillGrad;
    ctx.fill();

    // outline: glow stroke with flicker for error state
    const fl = 1 - Math.random() * P.flicker;
    ctx.strokeStyle = color;
    ctx.globalAlpha = P.alpha * fl;
    ctx.lineWidth = Math.max(1, unit * 0.004);
    glowStroke(ctx, color, (0.55 + P.glow * 0.45) * 12 * dpr);
    ctx.stroke();
    ctx.globalAlpha = P.alpha;
    ctx.restore();

    /* ------- visor (the "eyes" band) ------- */
    const vy = cy - unit * 0.035;
    const vw = hw * 1.28, vh = unit * 0.085;
    const visorGrad = ctx.createLinearGradient(cx, vy - vh / 2, cx, vy + vh / 2);
    visorGrad.addColorStop(0, color + "08");
    visorGrad.addColorStop(0.5, color + hexAlpha(P.visor * 0.55));
    visorGrad.addColorStop(1, color + "08");
    ctx.beginPath();
    roundedRect(ctx, cx - vw / 2, vy - vh / 2, vw, vh, vh * 0.45);
    ctx.fillStyle = visorGrad;
    ctx.fill();
    glowStroke(ctx, color, P.visor * 10 * dpr);
    ctx.strokeStyle = color + hexAlpha(0.35 + P.visor * 0.5);
    ctx.lineWidth = Math.max(1, unit * 0.0022);
    ctx.stroke();

    /* ------- eyes ------- */
    const eyeY = vy;
    const eyeDX = vw * 0.2;
    const eyeH = P.eyeOpen * P.blink * vh * 0.55;
    for (const s of [-1, 1]) {
      const ex = cx + s * eyeDX;
      ctx.beginPath();
      ctx.moveTo(ex - vw * 0.11, eyeY);
      ctx.quadraticCurveTo(ex, eyeY - eyeH * 1.15, ex + vw * 0.11, eyeY);
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1.4, unit * 0.004);
      glowStroke(ctx, color, (0.4 + P.visor * 0.8) * 10 * dpr);
      ctx.stroke();
    }

    /* ------- mouth / voice waveform ------- */
    if (P.mouth > 0.015 || state === "speech") {
      const mw = vw * 0.42, my = vy + vh * 0.95;
      const amp = P.mouth > 0.015 ? P.mouth : 0.25 + micLevel * 0.75;
      const bars = 7;
      glowStroke(ctx, color, 8 * dpr);
      ctx.strokeStyle = color + "cc";
      ctx.lineWidth = Math.max(1, unit * 0.003);
      ctx.beginPath();
      for (let i = 0; i < bars; i++) {
        const bx = cx - mw / 2 + (i + 0.5) * (mw / bars);
        const bamp = amp * (0.4 + 0.6 * Math.abs(Math.sin(t * 9 + i * 1.7)));
        ctx.moveTo(bx, my - bamp * unit * 0.03);
        ctx.lineTo(bx, my + bamp * unit * 0.03);
      }
      ctx.stroke();
    }

    /* ------- thinking scan sweep ------- */
    if (tg.scanSpeed > 0.0004) {
      const sy = domeTop + (chin - domeTop) * Math.min(1, scanPhase);
      const grad = ctx.createLinearGradient(0, sy - unit * 0.06, 0, sy + unit * 0.06);
      grad.addColorStop(0, color + "00");
      grad.addColorStop(0.5, color + "55");
      grad.addColorStop(1, color + "00");
      ctx.fillStyle = grad;
      ctx.fillRect(cx - hw * 1.2, sy - unit * 0.06, hw * 2.4, unit * 0.12);
    }

    /* ------- ambient particles ------- */
    for (let i = 0; i < 14; i++) {
      const a = t * (0.15 + (i % 5) * 0.05) + i * 2.4;
      const pr = ringR * 1.28 + Math.sin(a * 2) * unit * 0.012;
      const px = cx + Math.cos(a) * pr;
      const py = cy + Math.sin(a) * pr * 0.72;
      ctx.beginPath();
      ctx.fillStyle = color + hexAlpha(0.12 + P.glow * 0.2);
      ctx.arc(px, py, Math.max(0.8, unit * 0.0022 * (1 + 0.5 * Math.sin(a * 3))), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
    requestAnimationFrame(frame);
  }

  /* -------------------------------------------------------------- helpers */
  function hexAlpha(a) {
    const v = Math.max(0, Math.min(1, a));
    return Math.round(v * 255).toString(16).padStart(2, "0");
  }
  function glowStroke(c, color, blur) {
    c.shadowColor = color; c.shadowBlur = blur;
  }
  function dashRing(c, cx, cy, r, w, color, dash, offset) {
    c.beginPath();
    c.setLineDash(dash);
    c.lineDashOffset = offset;
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.lineWidth = Math.max(1, w);
    c.strokeStyle = color;
    c.stroke();
    c.setLineDash([]);
  }
  function roundedRect(c, x, y, w, h, r) {
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  return { init, setState, setMicLevel, setSpeakLevel, destroy };
})();

/* eslint-disable no-undef */
if (typeof module !== "undefined" && module.exports) module.exports = AitzazAvatar;
