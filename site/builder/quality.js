// Frame-time feedback for the two renderers. Never changes a world's terrain or palette.
(function () {
  function create(dpr = 1, locked = false) {
    const levels = { orbit: Math.min(dpr, 1.5), land: Math.min(dpr, 1) };
    const effective = { ...levels };
    let elapsed = 0, frames = 0, slow = 0;
    function reset() { elapsed = frames = slow = 0; }
    return {
      reset,
      scale(mode, width, height) {
        const level = levels[mode];
        // Start the expensive landscape at a bounded pixel count, including on large monitors.
        effective[mode] = mode === 'land' && !locked
          ? Math.min(level, Math.max(0.3, Math.sqrt(360000 / Math.max(1, width * height)))) : level;
        return effective[mode];
      },
      sample(mode, ms) {
        if (locked || !Number.isFinite(ms) || ms <= 0) return false;
        elapsed += ms; frames++; if (ms > 45) slow++;
        // A struggling renderer must not wait forty seconds for forty frames. Four frames
        // reject isolated hitches; wall time makes the response quick at low frame rates.
        if (elapsed < 900 || frames < 4) return false;
        const floor = mode === 'land' ? 0.3 : 0.45;
        const change = slow / frames > 0.6 && effective[mode] > floor;
        if (change) levels[mode] = Math.max(floor, effective[mode] * 0.75);
        reset();
        return change;
      },
    };
  }
  const api = { create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.RenderQuality = api;
})();
