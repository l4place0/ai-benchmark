/* _dev/read_state.js — report the live app state after an interaction script. */
var a = window.PLR.app;
return {
  lampOn: a.env.lampOn, lightsOn: a.env.lightsOn, hour: a.env.hour, day: +a.env.day.toFixed(2),
  steamOn: a.sctx.parts.steam ? !!a.sctx.parts.steam.on : null,
  curtainOpen: a.sctx.curtainOpen,
  blindBundle: a.sctx.blindState ? +a.sctx.blindState.bundle.toFixed(2) : null,
  recordSpinning: a.sctx.parts.record ? +a.sctx.parts.record.spinning.toFixed(2) : null,
  doorOpen: a.sctx.doorState ? +a.sctx.doorState.open.toFixed(2) : null
};
