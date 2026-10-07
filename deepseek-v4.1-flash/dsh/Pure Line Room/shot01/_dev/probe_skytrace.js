return {
  traceOnWindow: window.PLR._skyTrace || null,
  traceOnGlobal: typeof PLR !== 'undefined' ? (PLR._skyTrace || null) : 'noPLR',
  keys: Object.keys(window.PLR).slice(0, 20)
};
