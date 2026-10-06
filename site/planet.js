// Namesake renderer: one full-screen fragment shader draws the planet, clouds, rings,
// atmosphere and stars. Everything is computed per pixel; there are no meshes or textures.
(function () {
  const VERT = "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";
  const FRAG = `
precision highp float;
uniform vec2 uRes; uniform float uTime, uDist, uShift, uForm;
uniform mat3 uM; uniform vec3 uAxis, uSun;
uniform vec3 uSeed; uniform float uKind, uSea, uCloud, uIce, uCity, uRough, uScale, uBands;
uniform vec3 uP0, uP1, uP2, uP3, uP4, uP5, uAtmo, uCloudCol, uRingCol;
uniform float uRing, uRingIn, uRingOut;

float hash(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float noise(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x), mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x), mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z);
}
const mat3 m3 = mat3(0.00,0.80,0.60, -0.80,0.36,-0.48, -0.60,-0.48,0.64);
float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 6; i++){ s += a*noise(p); p = m3*p*2.02; a *= 0.5; } return s/0.984; }
float fbm3(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 3; i++){ s += a*noise(p); p = m3*p*2.02; a *= 0.5; } return s/0.875; }
float ridged(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a*(1.0-abs(2.0*noise(p)-1.0)); p = m3*p*2.03; a *= 0.5; } return s/0.969; }

float height(vec3 p){
  vec3 q = p*uScale + uSeed;
  float w = fbm3(q*0.6 + 7.0);
  float h = fbm(q + vec3(w*1.4));
  float r = ridged(q*1.6 + 3.0);
  h = mix(h, h*0.55 + r*0.45, uRough);
  h = smoothstep(0.28, 0.72, h);
  return mix(0.5, h, uForm);
}

vec3 rockColor(float H, vec3 p, out float water, out float land){
  water = 0.0; land = 0.0;
  vec3 col;
  if (H < uSea){
    float d = (uSea - H)/max(uSea, 0.01);
    col = mix(uP1, uP0, smoothstep(0.0, 0.4, d));
    water = 1.0;
  } else {
    float t = (H - uSea)/max(1.0 - uSea, 0.01);
    col = mix(uP2, uP3, smoothstep(0.03, 0.4, t));
    col = mix(col, uP4, smoothstep(0.45, 0.75, t));
    col = mix(col, uP5, smoothstep(0.84, 0.95, t));
    col *= 0.85 + 0.3*noise(p*40.0 + uSeed);
    land = 1.0;
  }
  float lat = abs(p.y) + (noise(p*6.0 + uSeed)-0.5)*0.18 + max(H - uSea, 0.0)*0.25;
  float ice = smoothstep(uIce - 0.03, uIce + 0.03, lat);
  col = mix(col, uP5, ice);
  water *= 1.0 - ice; land *= 1.0 - ice;
  return col;
}

vec3 gasColor(vec3 p){
  vec3 q = p + uSeed*0.01;
  float warp = fbm(vec3(p.x*2.0, p.y*7.0, p.z*2.0) + uSeed + vec3(uTime*0.012, 0.0, 0.0));
  float lat = p.y + (warp - 0.5)*0.22;
  float b = sin(lat*uBands + uSeed.x) * 0.5 + 0.5;
  float b2 = sin(lat*uBands*2.3 + uSeed.y) * 0.5 + 0.5;
  vec3 col = mix(uP0, uP1, b);
  col = mix(col, uP2, smoothstep(0.6, 1.0, b2)*0.7);
  col = mix(col, uP3, smoothstep(0.75, 1.0, b)*smoothstep(0.4, 0.8, warp));
  col = mix(col, uP4, smoothstep(0.55, 0.7, fbm3(q*9.0 + vec3(0.0, 0.0, uTime*0.02)))*0.35);
  // One great storm.
  float lon = atan(p.z, p.x);
  float sl = fract(uSeed.z*0.37)*6.28 - 3.14, sa = (fract(uSeed.x*0.13) - 0.5)*0.9;
  vec2 d = vec2(mod(lon - sl + 3.14159, 6.28318) - 3.14159, (p.y - sa)*2.2);
  float r = length(d);
  float swirl = noise(vec3(atan(d.y, d.x)*2.0 + r*30.0 - uTime*0.3, r*8.0, uSeed.y));
  col = mix(col, uP5*(0.75 + 0.5*swirl), smoothstep(0.22, 0.12, r)*0.9);
  return col;
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes)/min(uRes.x, uRes.y);
  uv.y -= uShift;
  vec3 ro = vec3(0.0, 0.0, uDist);
  vec3 rd = normalize(vec3(uv, -1.8));
  vec3 L = uSun;

  // Background: stars and a faint nebula tinted by the atmosphere.
  vec3 col = vec3(0.0);
  vec2 g = floor(gl_FragCoord.xy/1.5);
  float s = hash(vec3(g, 3.0));
  col += vec3(0.8, 0.85, 1.0) * smoothstep(0.9965, 1.0, s) * (0.6 + 0.4*sin(uTime*2.0 + s*500.0));
  float neb = fbm3(vec3(rd.xy*2.5, uSeed.x*0.1));
  col += uAtmo * pow(neb, 3.0) * 0.12 + vec3(0.01, 0.012, 0.025);

  // Planet hit.
  float b = dot(ro, rd), c = dot(ro, ro) - 1.0, disc = b*b - c;
  float tP = 1e9;
  float tc = -b; float closest = length(ro + rd*tc);
  if (disc > 0.0){
    tP = -b - sqrt(disc);
    vec3 pw = ro + rd*tP;              // world position on the sphere
    vec3 p = uM * pw;                  // planet-local position
    float dif0 = dot(pw, L);
    vec3 n = p; vec3 base; float water = 0.0, land = 0.0; vec3 emit = vec3(0.0);
    if (uKind < 1.5){
      float H = height(p);
      float e = 0.004;
      vec3 t1 = normalize(cross(p, vec3(0.0, 1.0, 0.1)));
      vec3 t2 = cross(p, t1);
      float h1 = height(normalize(p + t1*e)), h2 = height(normalize(p + t2*e));
      if (uKind < 0.5){
        base = rockColor(H, p, water, land);
        float k = 0.06*land*uForm;
        n = normalize(p - k*((h1 - H)/e*t1 + (h2 - H)/e*t2));
        // Night lights on inhabited worlds.
        float night = smoothstep(0.05, -0.2, dif0);
        float lights = smoothstep(0.72, 0.95, noise(p*140.0 + uSeed)) * smoothstep(0.45, 0.62, fbm3(p*7.0 + uSeed.zxy));
        emit += vec3(1.0, 0.72, 0.38) * lights * land * night * uCity * 2.2 * uForm;
      } else {
        // Lava: dark crust, glowing cracks and lakes.
        float cr = ridged(p*uScale*2.0 + uSeed.yzx);
        float crack = smoothstep(0.86, 0.97, cr);
        float lake = smoothstep(uSea, uSea - 0.08, H);
        base = mix(uP1, uP3, smoothstep(0.3, 0.9, H)) * (0.7 + 0.6*noise(p*30.0));
        float pulse = 0.8 + 0.2*sin(uTime*1.5 + noise(p*5.0)*6.0);
        emit += uP5 * (crack*0.9 + lake*1.3) * pulse * uForm;
        base *= 1.0 - lake*0.8;
        n = normalize(p - 0.05*(1.0 - lake)*((h1 - H)/e*t1 + (h2 - H)/e*t2));
      }
    } else {
      base = gasColor(p);
    }
    vec3 nw = n * uM;                  // back to world (uM is orthonormal)
    float dif = max(dot(nw, L), 0.0);
    float soft = smoothstep(-0.15, 0.25, dif0);

    // Shadow cast by the ring onto the planet.
    if (uRing > 0.5){
      float dn = dot(L, uAxis);
      if (abs(dn) > 1e-3){
        float tr = -dot(pw, uAxis)/dn;
        if (tr > 0.0){
          float rr = length(pw + L*tr);
          float x = (rr - uRingIn)/(uRingOut - uRingIn);
          if (x > 0.0 && x < 1.0) dif *= 1.0 - 0.65*smoothstep(0.0, 0.08, x)*smoothstep(1.0, 0.85, x);
        }
      }
    }

    vec3 lit = base * (dif*1.15*soft + 0.02);
    if (uKind > 1.5) lit = base * (pow(max(dif0, 0.0), 0.8)*1.1 + 0.015);

    // Ocean glint.
    vec3 hv = normalize(L - rd);
    lit += vec3(1.0, 0.95, 0.85) * pow(max(dot(pw, hv), 0.0), 90.0) * water * 0.9 * soft;

    // Clouds.
    if (uCloud > 0.0){
      float a = uTime*0.012;
      vec3 pc = mat3(cos(a), 0.0, sin(a), 0.0, 1.0, 0.0, -sin(a), 0.0, cos(a)) * p;
      float cn = fbm(pc*2.6 + uSeed.zxy + vec3(0.0, fbm3(pc*1.3)*1.5, 0.0));
      float th = 0.66 - uCloud*0.3;
      float cov = smoothstep(th, th + 0.14, cn) * uForm;
      float cl = clamp(dif0*1.1 + 0.05, 0.0, 1.0);
      lit = mix(lit, uCloudCol * cl, cov*0.92);
      emit *= 1.0 - cov*0.8;
    }
    lit += emit;

    // Atmosphere rim on the disc.
    float mu = max(dot(normalize(pw), -rd), 0.0);
    float rim = pow(1.0 - mu, 2.5);
    float atmoLight = smoothstep(-0.25, 0.6, dif0);
    lit += uAtmo * rim * atmoLight * 0.9;
    lit = mix(lit, uAtmo*atmoLight, rim*0.25);
    col = lit;
  }

  // Halo around the limb.
  if (closest > 1.0){
    float h = closest - 1.0;
    vec3 cp = normalize(ro + rd*tc);
    float lf = smoothstep(-0.35, 0.6, dot(cp, L));
    col += uAtmo * exp(-h/0.045) * lf * 0.85 * uForm;
    col += uAtmo * exp(-h/0.25) * lf * 0.12 * uForm;
  }

  // Rings.
  if (uRing > 0.5){
    float dn = dot(rd, uAxis);
    if (abs(dn) > 1e-4){
      float t = -dot(ro, uAxis)/dn;
      if (t > 0.0 && t < tP){
        vec3 pr = ro + rd*t;
        float rr = length(pr);
        float x = (rr - uRingIn)/(uRingOut - uRingIn);
        if (x > 0.0 && x < 1.0){
          float dens = 0.35 + 0.65*noise(vec3(rr*55.0, uSeed.x, 0.0));
          dens *= 0.6 + 0.4*noise(vec3(rr*9.0, uSeed.y, 1.0));
          dens *= smoothstep(0.0, 0.06, x)*smoothstep(1.0, 0.9, x);
          dens *= 1.0 - 0.85*smoothstep(0.02, 0.0, abs(x - 0.62));   // a Cassini-style gap
          float tc2 = -dot(pr, L);
          float sh = (tc2 > 0.0 && length(pr + L*tc2) < 1.0) ? 0.12 : 1.0;
          vec3 rc = uRingCol * (0.25 + 0.85*sh) * (0.8 + 0.4*noise(vec3(rr*120.0, 2.0, uSeed.z)));
          col = mix(col, rc, clamp(dens*0.9*uForm, 0.0, 1.0));
        }
      }
    }
  }

  // Filmic-ish tone and vignette.
  col = col/(1.0 + col*0.35);
  col = pow(col, vec3(0.92));
  col *= 1.0 - 0.35*dot(uv, uv);
  gl_FragColor = vec4(col, 1.0);
}`;

  function mul(a, b) {
    const r = [];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++)
      r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
    return r;
  }
  const rx = (t) => [1, 0, 0, 0, Math.cos(t), -Math.sin(t), 0, Math.sin(t), Math.cos(t)];
  const ry = (t) => [Math.cos(t), 0, Math.sin(t), 0, 1, 0, -Math.sin(t), 0, Math.cos(t)];
  const rz = (t) => [Math.cos(t), -Math.sin(t), 0, Math.sin(t), Math.cos(t), 0, 0, 0, 1];

  function createRenderer(canvas) {
    const gl = canvas.getContext("webgl", { antialias: false, preserveDrawingBuffer: true, alpha: false });
    if (!gl) return null;
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "a");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = {};
    const u = (n) => U[n] || (U[n] = gl.getUniformLocation(prog, n));
    const sun = [-0.72, 0.32, 0.62];
    const sl = Math.hypot(...sun);

    return {
      gl,
      draw(state) {
        const r = state.world.render;
        // World -> planet-local rotation: undo the view pitch, then the axial tilt, then the spin.
        const M = mul(ry(-state.yaw), mul(rz(-r.tilt), rx(-state.pitch)));
        // WebGL wants column-major.
        const colMajor = [M[0], M[3], M[6], M[1], M[4], M[7], M[2], M[5], M[8]];
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.uniform2f(u("uRes"), canvas.width, canvas.height);
        gl.uniform1f(u("uTime"), state.time);
        gl.uniform1f(u("uDist"), state.dist);
        gl.uniform1f(u("uShift"), state.shift);
        gl.uniform1f(u("uForm"), state.form);
        gl.uniformMatrix3fv(u("uM"), false, colMajor);
        gl.uniform3f(u("uAxis"), M[3], M[4], M[5]);
        gl.uniform3f(u("uSun"), sun[0] / sl, sun[1] / sl, sun[2] / sl);
        gl.uniform3fv(u("uSeed"), r.seed);
        for (const [k, v] of Object.entries({ uKind: r.kind, uSea: r.sea, uCloud: r.cloud, uIce: r.ice, uCity: r.cities,
          uRough: r.rough, uScale: r.scale, uBands: r.bands, uRing: r.ring, uRingIn: r.ringIn, uRingOut: r.ringOut }))
          gl.uniform1f(u(k), v);
        r.pal.forEach((c, i) => gl.uniform3fv(u("uP" + i), c));
        gl.uniform3fv(u("uAtmo"), r.atmo);
        gl.uniform3fv(u("uCloudCol"), r.cloudCol);
        gl.uniform3fv(u("uRingCol"), r.ringCol);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
    };
  }

  window.Planet = { createRenderer };
})();
