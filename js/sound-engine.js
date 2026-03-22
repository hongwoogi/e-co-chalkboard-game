'use strict';
/**
 * sound-engine.js
 * Procedural 8-bit style sounds via Web Audio API — no external files needed.
 */
(function () {
  const SE = {
    _ctx: null,
    muted: localStorage.getItem('sfx_muted') === '1',

    ctx() {
      if (!this._ctx) {
        try { this._ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
      }
      // Resume if suspended (autoplay policy)
      if (this._ctx && this._ctx.state === 'suspended') this._ctx.resume();
      return this._ctx;
    },

    toggle() {
      this.muted = !this.muted;
      localStorage.setItem('sfx_muted', this.muted ? '1' : '0');
      return this.muted;
    },

    play(type) {
      if (this.muted) return;
      const c = this.ctx();
      if (!c) return;
      try {
        ({
          click:    () => this._tone(c, 700, 0.12, 0.08, 'sine'),
          select:   () => this._arp(c, [440, 554, 659], 'square', 0.12, 60),
          start:    () => this._arp(c, [523, 659, 784, 1047], 'square', 0.18, 90),
          score:    () => this._tone(c, 880, 0.15, 0.12, 'square'),
          correct:  () => this._arp(c, [523, 659, 784], 'sine', 0.18, 70),
          wrong:    () => this._sweep(c, 320, 100, 0.35, 'sawtooth'),
          line:     () => this._sweep(c, 350, 900, 0.22, 'square'),
          combo:    () => this._arp(c, [659, 880, 1109], 'square', 0.16, 60),
          gameover: () => this._arp(c, [440, 330, 220, 147], 'sawtooth', 0.16, 160),
          tick:     () => this._tone(c, 880, 0.18, 0.12, 'square'),
          pop:      () => this._tone(c, 1300, 0.14, 0.08, 'sine'),
          flip:     () => this._tone(c, 600, 0.13, 0.10, 'square'),
          eat:      () => this._tone(c, 750, 0.14, 0.09, 'square'),
        }[type] || (() => {}))();
      } catch (e) { /* AudioContext may be unavailable */ }
    },

    _tone(c, freq, vol, dur, type) {
      const o = c.createOscillator(), g = c.createGain();
      o.connect(g); g.connect(c.destination);
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
      o.start(); o.stop(c.currentTime + dur + 0.01);
    },

    _sweep(c, f1, f2, dur, type, vol = 0.18) {
      const o = c.createOscillator(), g = c.createGain();
      o.connect(g); g.connect(c.destination);
      o.type = type;
      o.frequency.setValueAtTime(f1, c.currentTime);
      o.frequency.linearRampToValueAtTime(f2, c.currentTime + dur);
      g.gain.setValueAtTime(vol, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
      o.start(); o.stop(c.currentTime + dur + 0.01);
    },

    _arp(c, freqs, type, vol, gapMs) {
      freqs.forEach((f, i) => {
        const t = c.currentTime + i * (gapMs / 1000);
        const o = c.createOscillator(), g = c.createGain();
        o.connect(g); g.connect(c.destination);
        o.type = type; o.frequency.value = f;
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        o.start(t); o.stop(t + 0.19);
      });
    }
  };

  window.SoundEngine = SE;
})();
