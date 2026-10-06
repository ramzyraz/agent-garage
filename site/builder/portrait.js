// Compose the shared sky independently of the visitor's dragged/zoomed camera.
(function (root) {
  const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);
  const norm = (v) => v.map((x) => x / Math.hypot(...v));
  const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  function basis(yaw, pitch) {
    const fw = [Math.sin(yaw)*Math.cos(pitch), Math.sin(pitch), Math.cos(yaw)*Math.cos(pitch)];
    const rt = [Math.cos(yaw), 0, -Math.sin(yaw)];
    return { fw, rt, up: cross(fw, rt) };
  }
  function project(dir, camera, w, h) {
    const b = basis(camera.yaw, camera.pitch), z = dot(dir, b.fw);
    const f = camera.focal * (h > w * 1.1 ? 0.75 : 1), unit = Math.min(w, h);
    return { x: w/2 + unit*f*dot(dir, b.rt)/z, y: h/2 - unit*f*dot(dir, b.up)/z, z };
  }
  function surface(world, friend, t0, w = 1080, h = 1350) {
    const S = typeof module !== "undefined" && module.exports ? require("./surface.js") : root.Surface;
    const s = S.site(world, t0);
    let comp = S.companion(world, friend, t0, w/h);
    const T = v => [dot(v, s.E), dot(v, s.U), dot(v, s.N)];
    const rings = world.kind === "gas" && world.render.ring ? Array.from({ length: 128 }, (_, i) => {
      const a = i*Math.PI/64, R = world.render.ringOut;
      return T(norm([Math.cos(a)*R-s.O[0], -s.O[1], Math.sin(a)*R-s.O[2]]));
    }).filter(d => d[1] >= 0) : [];
    if (world.kind === "gas") {
      // The portrait may widen the lens. Enlarge and move the friend clear of the
      // actual rings, rather than leaving it small or hidden behind the giant.
      const size = Math.max(0.22, comp.size), own = Math.atan(size);
      const edge = Math.min(-Math.asin(1.08/Math.hypot(...s.O)), ...rings.map(d => Math.atan2(d[0], d[2])));
      const yaw = edge - own - 0.10, el = 0.60;
      const dir = [Math.sin(yaw)*Math.cos(el), Math.sin(el), Math.cos(yaw)*Math.cos(el)];
      const rt = [Math.cos(yaw), 0, -Math.sin(yaw)], up = cross(dir, rt), L = T(s.L);
      comp = { ...comp, dir, rt, up, size, sun: norm([dot(L, rt), dot(L, up), -dot(L, dir)]) };
    }
    const bodies = [{ dir: comp.dir, radius: Math.atan(comp.size),
      labelRadius: Math.atan(comp.size*0.85/Math.max(1.15, friend.render.ring ? friend.render.ringOut : 0)), name: friend.name }];
    if (world.kind === "gas") {
      const dir = norm(s.O.map((x) => -x));
      bodies.unshift({ dir: [dot(dir, s.E), dot(dir, s.U), dot(dir, s.N)],
        radius: Math.asin(1.08 / Math.hypot(...s.O)), name: world.name });
    }
    let yaw = Math.atan2(bodies.reduce((n, b) => n + b.dir[0], 0), bodies.reduce((n, b) => n + b.dir[2], 0));
    const bounds = bodies.map((b) => {
      const rt = norm(cross([0, 1, 0], b.dir)), up = cross(b.dir, rt);
      return [b.dir, ...Array.from({ length: 32 }, (_, i) => {
        const a = i * Math.PI / 16;
        return b.dir.map((x, k) => x*Math.cos(b.radius) + (rt[k]*Math.cos(a)+up[k]*Math.sin(a))*Math.sin(b.radius));
      })];
    });
    const points = [...bounds.flat(), ...rings];
    const angles = points.map(d => {
      const a = Math.atan2(d[0], d[2]) - yaw;
      return yaw + Math.atan2(Math.sin(a), Math.cos(a));
    });
    yaw = (Math.min(...angles) + Math.max(...angles))/2;
    // Fit full planet/ring bounds in the image above the caption. Search the vertical
    // camera angle; each angle has an analytic maximum lens length for these bounds.
    let best = null;
    for (let pitch = -0.2; pitch <= 1.2; pitch += 0.005) {
      let effective = pitch > 0 ? Math.min(1.4, 0.16*h/w/Math.tan(pitch)) : 1.4;
      const b = basis(yaw, pitch);
      for (const dir of points) {
        const z = dot(dir, b.fw);
        if (z <= 0) { effective = 0; break; }
        const x = dot(dir, b.rt)/z, y = dot(dir, b.up)/z;
        effective = Math.min(effective, 0.42/Math.max(Math.abs(x), 1e-9),
          y > 0 ? 0.41*h/w/y : 0.10*h/w/Math.max(-y, 1e-9));
      }
      if (!best || effective > best.effective) best = { yaw, pitch, effective };
    }
    const camera = { yaw, pitch: best.pitch, focal: best.effective / (h > w*1.1 ? 0.75 : 1) };
    return { lookYaw: camera.yaw - s.yaw - comp.look, lookPitch: camera.pitch - s.pitch,
      focal: camera.focal, comp, labels: bodies.map((b) => {
        const centre = project(b.dir, camera, w, h);
        const rt = norm(cross([0, 1, 0], b.dir)), up = cross(b.dir, rt), radius = b.labelRadius || b.radius;
        const top = b.dir.map((x, k) => x*Math.cos(radius) + up[k]*Math.sin(radius));
        return { name: b.name, ...centre, y: project(top, camera, w, h).y + 25 };
      }),
      camera, points };
  }
  const api = { surface, project };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Portrait = api;
})(typeof window !== "undefined" ? window : globalThis);
