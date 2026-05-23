// ===================================
// state.js — App state (shared across modules)
// ===================================

const state = {
  files: [],
  selectedOpts: new Set(['resize', 'watermark', 'convert']),
  outputFmt: 'JPG',
  stats: {
    uploaded:  0,
    processed: 0,
    queue:     0,
  },
};
