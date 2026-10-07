// Frame-time feedback for the two renderers. Never changes a world's terrain or palette.
(function () {
  function create(dpr = 1, locked = false) {
    const caps = { orbit: Math.min(dpr, 1.5), land: Math.min(dpr, 1) };
    const levels = { ...caps };
    const effective = { ...levels };
    // 'raised': fast hardware earned more than the starting budget. 'dropped': this mode struggled
    // once, so it never climbs again (no flickering between two resolutions).
    const raised = { orbit: false, land: false }, dropped = { orbit: false, land: false };
    let elapsed = 0, frames = 0, slow = 0, quick = 0;
    function reset() { elapsed = frames = slow = quick = 0; }
    return {
      reset,
      scale(mode, width, height) {
        const level = levels[mode];
        // Start the expensive landscape at a bounded pixel count, including on large monitors.
        effective[mode] = mode === 'land' && !locked && !raised[mode]
          ? Math.min(level, Math.max(0.3, Math.sqrt(360000 / Math.max(1, width * height)))) : level;
        return effective[mode];
      },
      sample(mode, ms) {
        if (locked || !Number.isFinite(ms) || ms <= 0) return false;
        elapsed += ms; frames++; if (ms > 45) slow++; if (ms < 22) quick++;
        // A struggling renderer must not wait forty seconds for forty frames. Four frames
        // reject isolated hitches; wall time makes the response quick at low frame rates.
        if (elapsed < 900 || frames < 4) return false;
        const floor = mode === 'land' ? 0.3 : 0.45;
        let change = false;
        if (slow / frames > 0.6 && effective[mode] > floor) {
          levels[mode] = Math.max(floor, effective[mode] * 0.75);
          dropped[mode] = change = true;
        } else if (quick === frames && !dropped[mode] && effective[mode] < caps[mode]) {
          // Every frame kept up with the display: a desktop GPU can afford a sharper landscape.
          levels[mode] = Math.min(caps[mode], effective[mode] * 1.25);
          raised[mode] = change = true;
        }
        reset();
        return change;
      },
    };
  }
  const api = { create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.RenderQuality = api;
})();
