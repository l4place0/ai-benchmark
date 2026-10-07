/* =========================================================================
   Pure Line Room — state.js
   Global environment state. The room follows the real local clock, and the
   wall switch can take over at any time: pressing it makes the room dark
   ("lights off") or lifts it back to daylight ("lights on"). Every visual and
   audio system reads its state from here, and every change is damped.
   ========================================================================= */
(function (root) {
  'use strict';
  var PLR = (root.PLR = root.PLR || {});
  var M = PLR.math;

  function hourOf(d) { return d.getHours() + d.getMinutes() / 60; }

  var State = {
    /* ---- environment ---- */
    phase: 0,            // 0 = full daylight, 1 = night; damped, read this
    target: 0,
    override: null,      // null = follow the clock, true = forced night, false = lifted to day
    hours: 12,
    minutes: 0,
    seconds: 0,
    dayStart: 6.4,       // the room reads as day between these local hours
    dayEnd: 19.6,

    /* ---- devices ---- */
    lightOn: true,       // the room light switch is up
    lampOn: false,       // desk lamp
    fanOn: false,
    fanSpeed: 0,
    blindsOpen: true,
    recordOn: false,
    recordSpeed: 0,
    curtainOpen: true,

    /* ---- damped animation channels ---- */
    ch: { room: 0, lamp: 0, fan: 0, blinds: 1, curtain: 1, record: 0 },

    time: 0,
    listeners: [],

    init: function () {
      var now = new Date();
      this.hours = now.getHours();
      this.minutes = now.getMinutes();
      this.seconds = now.getSeconds();
      this.target = this.nightNow() ? 1 : 0;
      this.phase = this.target;
      this.ch.room = this.target;
      this.lightOn = !this.target;
      return this;
    },

    on: function (fn) { this.listeners.push(fn); return this; },
    emit: function (name, data) {
      for (var i = 0; i < this.listeners.length; i++) this.listeners[i](name, data);
    },

    /* Is it dark outside right now? */
    nightNow: function () {
      var h = hourOf(new Date());
      return h < this.dayStart || h >= this.dayEnd;
    },

    /* Is the room dark? Either it is dark outside or the switch is off. */
    night: function () {
      if (this.override !== null) return this.override;
      return this.nightNow();
    },

    /* The wall switch. Pressing it darkens the room; pressing it again lifts
       it back to whatever the clock says (or to day if it is dark outside). */
    toggleLight: function () {
      var dark = this.night();
      if (dark) {
        this.override = false;          // lift the room into day
        this.lightOn = true;
      } else {
        this.override = true;           // put the room into night
        this.lightOn = false;
      }
      this.emit('light', this.lightOn);
      return this.lightOn;
    },

    /* Hand control back to the clock. */
    autoMode: function () {
      this.override = null;
      this.emit('auto');
      return this;
    },

    update: function (dt) {
      var now = new Date();
      this.hours = now.getHours();
      this.minutes = now.getMinutes();
      this.seconds = now.getSeconds() + now.getMilliseconds() / 1000;

      this.target = this.night() ? 1 : 0;
      var step = dt > 0 ? dt : 1;
      if (dt > 0) {
        this.time += dt;
        this.phase = M.ease.damp(this.phase, this.target, 1.5, dt);
      }
      this.lightOn = this.target < 0.5;

      var ch = this.ch;
      ch.room = M.ease.damp(ch.room, this.target, 2.4, step);
      ch.lamp = M.ease.damp(ch.lamp, this.lampOn ? 1 : 0, 6, step);
      ch.fan = M.ease.damp(ch.fan, this.fanOn ? 1 : 0, 1.5, step);
      ch.blinds = M.ease.damp(ch.blinds, this.blindsOpen ? 1 : 0, 3.4, step);
      ch.curtain = M.ease.damp(ch.curtain, this.curtainOpen ? 1 : 0, 3.0, step);
      ch.record = M.ease.damp(ch.record, this.recordOn ? 1 : 0, 1.9, step);
      this.fanSpeed = ch.fan;
      this.recordSpeed = ch.record;
      return this;
    },

    /* True while the plate still reads as daylight. */
    lit: function () { return this.phase < 0.5; },
    night01: function () { return M.clamp(this.phase, 0, 1); },

    clock: function () {
      var s = this.seconds;
      var m = this.minutes + s / 60;
      var h = (this.hours % 12) + m / 60;
      return { h: h, m: m, s: s };
    },

    clockText: function () {
      var hh = this.hours, mm = this.minutes;
      var ap = hh >= 12 ? 'PM' : 'AM';
      var h12 = hh % 12; if (h12 === 0) h12 = 12;
      return h12 + ':' + (mm < 10 ? '0' : '') + mm + ' ' + ap;
    },
  };

  PLR.state = State;
})(typeof window !== 'undefined' ? window : globalThis);
