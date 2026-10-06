// Namesake surface view: stand on the world. One fragment shader raymarches the local terrain
// and draws the real sky above it: the planet's rings as an arch, its moons, and (from a gas
// giant's moon) the giant itself. Everything comes from the same world parameters as the orbit view.
(function () {
  const VERT = "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";
  const FRAG = `
precision highp float;
uniform vec2 uRes, uSpot; uniform float uTime, uFocal, uFade, uYaw, uPitch, uAlt;  // uAlt: height above the standing eye while descending
uniform vec3 uO, uE, uU, uN, uL;             // observer, tangent frame and sun, in planet-local space
uniform vec3 uSeed; uniform float uSea, uCloud, uIce, uCity, uRough, uScale, uLat, uMode, uBands, uSky;
uniform vec3 uG0, uG1, uG2, uG3, uG4, uG5;   // ground palette
uniform vec3 uP0, uP1, uP2, uP3, uP4, uP5;   // giant palette (moon mode)
uniform vec3 uAtmo, uCloudCol, uRingCol;
uniform float uRing, uRingIn, uRingOut;
uniform vec4 uMoons[3]; uniform vec3 uMoonColors[3];
uniform sampler2D uComp; uniform vec3 uCompDir, uCompRt, uCompUp; uniform float uCompSize;  // a friend's world

float hash(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float noise(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x), mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x), mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z);
}
const mat3 m3 = mat3(0.00,0.80,0.60, -0.80,0.36,-0.48, -0.60,-0.48,0.64);
float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 6; i++){ s += a*noise(p); p = m3*p*2.02; a *= 0.5; } return s/0.984; }
float fbm3(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 3; i++){ s += a*noise(p); p = m3*p*2.02; a *= 0.5; } return s/0.875; }

// The cloud deck: a layer 14 units above the standing eye (gCloudY), shared by the sky, the view from
// above it while descending, and the shadows it casts.
float gCloudY;
float cloudCov(vec2 xz, const int detail){
  vec2 cp = xz*0.035 + uSeed.zx + vec2(uTime*0.006, 0.0);
  float cn = detail > 0 ? fbm(vec3(cp.x, uSeed.y, cp.y) + vec3(0.0, fbm3(vec3(cp*0.6, 2.0))*1.2, 0.0)) : fbm3(vec3(cp.x, uSeed.y, cp.y));
  float th = 0.66 - uCloud*0.32;
  return smoothstep(th, th + 0.18, cn);
}

// Terrain. 'H' uses the same scale as the planet view: below uSea is sea, 1 is the high peaks.
const mat2 m2 = mat2(0.8, -0.6, 0.6, 0.8);
float n2(vec2 p){ return noise(vec3(p.x, 0.5, p.y)); }
float terrainH(vec2 xz, const int oct){
  vec2 p = xz*0.05*uScale + uSeed.xy;
  float w = n2(p*0.5 + 7.0);
  p += w*1.2;
  float a = 0.5, s = 0.0, r = 0.0;
  for (int i = 0; i < 8; i++){
    if (i >= oct) break;
    float v = n2(p);
    s += a*v; r += a*(1.0 - abs(2.0*v - 1.0));
    p = m2*p*2.03; a *= 0.5;
  }
  float h = mix(s, s*0.5 + r*r*0.62, uRough);
  // Craters on airless moons.
  if (uMode > 1.5){
    vec2 g = xz*0.09 + uSeed.yz, ip = floor(g), fp = fract(g);
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
      vec2 o = vec2(float(i), float(j));
      float rnd = hash(vec3(ip + o, uSeed.x));
      vec2 c = o + vec2(rnd, fract(rnd*31.7)) - fp;
      float rad = 0.18 + 0.25*fract(rnd*7.3);
      float d = length(c)/rad;
      if (rnd > 0.45) h += (smoothstep(1.0, 0.0, d)*(d*d - 1.0)*0.35 + smoothstep(1.35, 1.0, d)*smoothstep(0.7, 1.0, d)*0.08)*rad*2.0;
    }
  }
  return (h - 0.3)/0.42;
}
float amp(){ return uMode > 1.5 ? 2.2 : 3.0 + uRough*3.5; }
float groundY(vec2 xz, const int oct){ return terrainH(xz, oct)*amp(); }
float seaY(){ return uSea*amp(); }

vec3 toPlanet(vec3 d){ return uE*d.x + uU*d.y + uN*d.z; }
vec3 sunT(){ return vec3(dot(uL, uE), dot(uL, uU), dot(uL, uN)); }

float sphereHit(vec3 ro, vec3 rd, vec3 centre, float radius){
  vec3 q = ro - centre;
  float b = dot(q, rd), d = b*b - dot(q, q) + radius*radius;
  if (d <= 0.0) return 1e9;
  float t = -b - sqrt(d);
  return t > 0.0 ? t : 1e9;
}
// How much sunlight reaches point p (planet space): blocked by the planet, the rings and the moons.
float sunlight(vec3 p, bool ring){
  float light = 1.0;
  float tc = -dot(p, uL);
  if (uMode > 1.5 && tc > 0.0) light *= smoothstep(0.97, 1.03, length(p + uL*tc));
  if (ring && uRing > 0.5 && abs(uL.y) > 1e-3){
    float tr = -p.y/uL.y;
    if (tr > 0.0){
      float rr = length((p + uL*tr).xz);
      float x = (rr - uRingIn)/(uRingOut - uRingIn);
      if (x > 0.0 && x < 1.0) light *= 1.0 - 0.6*smoothstep(0.0, 0.08, x)*smoothstep(1.0, 0.85, x);
    }
  }
  return light;
}

vec3 gasColor(vec3 p){
  float warp = fbm(vec3(p.x*2.0, p.y*7.0, p.z*2.0) + uSeed + vec3(uTime*0.012, 0.0, 0.0));
  float lat = p.y + (warp - 0.5)*0.22;
  float b = sin(lat*uBands + uSeed.x)*0.5 + 0.5;
  float b2 = sin(lat*uBands*2.3 + uSeed.y)*0.5 + 0.5;
  vec3 col = mix(uP0, uP1, b);
  col = mix(col, uP2, smoothstep(0.6, 1.0, b2)*0.7);
  col = mix(col, uP3, smoothstep(0.75, 1.0, b)*smoothstep(0.4, 0.8, warp));
  col = mix(col, uP4, smoothstep(0.55, 0.7, fbm3(p*9.0 + uSeed + vec3(0.0, 0.0, uTime*0.02)))*0.35);
  // Fine streaks along the bands: up close the giant should read as weather, not a soft ball.
  col *= 0.86 + 0.28*fbm3(vec3(p.x*5.0, p.y*48.0 + (warp - 0.5)*3.0, p.z*5.0) + uSeed);
  float lon = atan(p.z, p.x);
  float sl = fract(uSeed.z*0.37)*6.28 - 3.14, sa = (fract(uSeed.x*0.13) - 0.5)*0.9;
  vec2 d = vec2(mod(lon - sl + 3.14159, 6.28318) - 3.14159, (p.y - sa)*2.2);
  float r = length(d);
  float swirl = noise(vec3(atan(d.y, d.x)*2.0 + r*30.0 - uTime*0.3, r*8.0, uSeed.y));
  return mix(col, uP5*(0.75 + 0.5*swirl), smoothstep(0.22, 0.12, r)*0.9);
}

// Sky light only (no objects): used for fog, ambient light and reflections near the horizon.
vec3 skyBase(vec3 d){
  vec3 L = sunT();
  float e = max(d.y, 0.0);
  float day = smoothstep(-0.25, 0.25, L.y);
  float low = 1.0 - smoothstep(0.0, 0.5, L.y);
  vec3 warm = vec3(1.0, 0.62, 0.32);
  vec3 zen = uAtmo*0.32*day + vec3(0.004, 0.006, 0.014);
  vec3 hor = mix(uAtmo*0.9, mix(uAtmo, warm, 0.55), low)*day + vec3(0.01, 0.012, 0.02);
  float sd = max(dot(d, L), 0.0);
  vec3 col = mix(hor, zen, pow(smoothstep(0.0, 0.7, e), 0.6));
  col += warm*(pow(sd, 6.0)*0.35*low + pow(sd, 40.0)*0.5)*day;
  return col*uSky;
}

vec3 gRo;     // camera position
float gPix;   // one pixel, as an angle
vec3 sky(vec3 d){
  vec3 L = sunT();
  vec3 sb = skyBase(d);
  vec3 dw = toPlanet(d);
  // Stars, fading out in daylight.
  vec3 sg = floor(dw*420.0);
  float st = smoothstep(0.9975, 1.0, hash(sg + 0.5));
  vec3 col = sb + vec3(0.85, 0.9, 1.0)*st*(1.0 - smoothstep(0.02, 0.35, dot(sb, vec3(0.33))))*(0.6 + 0.4*sin(uTime*2.0 + hash(sg)*40.0));
  col += vec3(0.04, 0.03, 0.06)*pow(fbm3(dw*3.0 + uSeed*0.1), 3.0)*(1.0 - uSky);
  // Sun disc.
  col += vec3(1.0, 0.92, 0.8)*smoothstep(0.99955, 0.9998, dot(d, L))*6.0;
  col += vec3(1.0, 0.85, 0.65)*pow(max(dot(d, L), 0.0), 900.0)*1.5;

  // The twin world, far beyond the moons: a sprite drawn by the orbit shader with this sky's sunlight.
  if (uCompSize > 0.0){
    float z = dot(d, uCompDir);
    if (z > 0.0){
      vec2 q = vec2(dot(d, uCompRt), dot(d, uCompUp))/(z*uCompSize);
      if (abs(q.x) < 1.0 && abs(q.y) < 1.0){
        vec4 c = texture2D(uComp, q*0.5 + 0.5)*smoothstep(1.0, 0.88, length(q));
        col = col*(1.0 - c.a) + c.rgb + sb*0.85*c.a;
      }
    }
  }
  float tHit = 1e9;
  vec3 obj = vec3(0.0); float hasObj = 0.0;
  // The giant, seen from one of its moons.
  if (uMode > 1.5){
    float t = sphereHit(uO, dw, vec3(0.0), 1.0);
    if (t < tHit){
      tHit = t;
      vec3 p = uO + dw*t;
      float dif = dot(p, uL);
      vec3 base = gasColor(p);
      vec3 lit = base*(pow(max(dif, 0.0), 0.8)*1.15*sunlight(p, true) + 0.012);
      float rim = pow(1.0 - max(dot(p, -dw), 0.0), 2.5);
      lit += uAtmo*rim*smoothstep(-0.25, 0.6, dif)*0.8;
      float tc = -dot(uO, dw);
      obj = lit; hasObj = clamp((1.0 - length(uO + dw*tc))/(tc*gPix), 0.0, 1.0);
    }
  }
  // Moons.
  for (int i = 0; i < 3; i++){
    vec4 m = uMoons[i];
    if (m.w > 0.0){
      float t = sphereHit(uO, dw, m.xyz, m.w);
      if (t < tHit){
        tHit = t;
        vec3 hit = uO + dw*t;
        vec3 nrm = (hit - m.xyz)/m.w;
        float terrain = fbm3(nrm*6.0 + uSeed + float(i)*13.0);
        float crater = noise(nrm*16.0 + uSeed.zxy);
        vec3 base = uMoonColors[i]*(0.6 + terrain*0.7);
        base *= 1.0 - smoothstep(0.62, 0.78, crater)*0.45;
        float behind = -dot(hit, uL), shadow = 1.0;
        if (behind > 0.0) shadow = smoothstep(0.96, 1.04, length(hit + uL*behind));
        vec3 q = m.xyz - uO; float along = dot(q, dw);
        float cov = clamp((m.w - length(q - dw*along))/(along*gPix), 0.0, 1.0);
        vec3 mc = base*(max(dot(nrm, uL), 0.0)*1.2*shadow + 0.03);
        obj = hasObj > 0.0 ? mix(obj, mc, cov) : mc;
        hasObj = max(hasObj, cov);
      }
    }
  }
  // Daylight washes out whatever is in the sky, like the Moon by day.
  col = mix(col, obj + sb*0.85, hasObj);
  // Rings: an arch across the sky from the surface, a ring of light from a moon.
  if (uRing > 0.5 && abs(dw.y) > 1e-4){
    float t = -uO.y/dw.y;
    if (t > 0.0 && t < tHit){
      vec3 pr = uO + dw*t;
      float rr = length(pr.xz);
      float x = (rr - uRingIn)/(uRingOut - uRingIn);
      if (x > 0.0 && x < 1.0){
        float dens = 0.35 + 0.65*noise(vec3(rr*55.0, uSeed.x, 0.0));
        dens *= 0.6 + 0.4*noise(vec3(rr*9.0, uSeed.y, 1.0));
        dens *= smoothstep(0.0, 0.06, x)*smoothstep(1.0, 0.9, x);
        dens *= 1.0 - 0.85*smoothstep(0.02, 0.0, abs(x - 0.62));
        float tc = -dot(pr, uL);
        float sh = (tc > 0.0 && length(pr + uL*tc) < 1.0) ? 0.1 : 1.0;
        vec3 rc = uRingCol*(0.2 + 0.95*sh)*(0.8 + 0.4*noise(vec3(rr*120.0, 2.0, uSeed.z)));
        col = mix(col, rc + sb*0.6, clamp(dens*0.92, 0.0, 1.0));
      }
    }
  }
  // Cloud deck overhead.
  if (uCloud > 0.0 && d.y > 0.0 && gRo.y < gCloudY){
    float cov = cloudCov(gRo.xz + d.xz*(gCloudY - gRo.y)/d.y, 1)*smoothstep(0.0, 0.12, d.y);
    float lit = 0.25 + 0.85*smoothstep(-0.1, 0.4, L.y);
    vec3 cc = uCloudCol*lit*mix(vec3(1.0), vec3(1.0, 0.72, 0.5), 1.0 - smoothstep(0.05, 0.45, L.y));
    col = mix(col, cc*uSky + sb*0.2, cov*0.9);
  }
  return col;
}

float cloudShadow(vec3 p, vec3 L){
  if (uCloud <= 0.0 || L.y <= 0.02) return 1.0;
  return 1.0 - 0.55*cloudCov(p.xz + L.xz*(gCloudY - p.y)/L.y, 0);
}

float softShadow(vec3 p, vec3 L){
  float s = 1.0, t = 0.15;
  for (int i = 0; i < 22; i++){
    vec3 q = p + L*t;
    float h = q.y - groundY(q.xz, 4);
    s = min(s, 10.0*h/t);
    if (s < 0.0 || q.y > amp()*1.6) break;
    t += clamp(h*0.6, 0.15, 2.5);
  }
  return clamp(s, 0.0, 1.0);
}

vec3 groundColor(vec3 p, vec3 n, float H){
  float t = clamp((H - uSea)/max(1.0 - uSea, 0.05), 0.0, 1.3);
  vec3 col = mix(uG2, uG3, smoothstep(0.03, 0.4, t));
  col = mix(col, uG4, smoothstep(0.45, 0.8, t));
  col = mix(col, uG4*0.8, smoothstep(0.55, 0.85, 1.0 - n.y)*0.8);   // bare rock on cliffs
  col = mix(col, uG2*1.15, smoothstep(0.035, 0.0, t)*step(0.0, uSea)); // beaches
  col *= 0.8 + 0.4*n2(p.xz*3.0 + uSeed.yz);
  // Snow where the planet view has it: by latitude and altitude, settling on flatter ground.
  float lat = uLat + (noise(vec3(p.xz*0.08, uSeed.x)) - 0.5)*0.18 + max(H - uSea, 0.0)*0.28;
  float snow = smoothstep(uIce - 0.03, uIce + 0.03, lat)*smoothstep(0.55, 0.8, n.y);
  return mix(col, uG5, snow);
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes)/min(uRes.x, uRes.y);
  float cy = cos(uPitch), sy = sin(uPitch);
  vec3 fw = vec3(sin(uYaw)*cy, sy, cos(uYaw)*cy);
  vec3 rt = normalize(vec3(cos(uYaw), 0.0, -sin(uYaw)));
  vec3 up = cross(fw, rt);
  vec3 rd = normalize(fw*uFocal + rt*uv.x + up*uv.y);
  vec3 L = sunT();

  float a = amp();
  float sea = uSea > 0.0 ? seaY() : -1e3;
  vec3 ro = vec3(uSpot.x, max(groundY(uSpot, 6), sea) + 0.32 + a*0.04, uSpot.y);
  gCloudY = ro.y + 14.0;
  ro.y += uAlt;
  gRo = ro;
  gPix = 1.2/(uFocal*min(uRes.x, uRes.y));

  // March the terrain; the sea is a flat plane.
  float tMax = 140.0 + uAlt*3.0;
  float tSea = rd.y < 0.0 ? (sea - ro.y)/rd.y : 1e9;
  float tEnd = min(tMax, tSea);
  float t = 0.05, hit = 0.0;
  for (int i = 0; i < 140; i++){
    vec3 p = ro + rd*t;
    float h = p.y - groundY(p.xz, 5);
    if (h < 0.0015*t){ hit = 1.0; break; }
    if (t > tEnd || (rd.y > 0.0 && p.y > a*1.8)) break;
    t += max(0.02 + uAlt*0.002, h*0.45);
  }

  vec3 col;
  float dist = tMax;
  float sunIn = sunlight(uO, true);
  vec3 ambient = skyBase(vec3(0.0, 1.0, 0.0))*0.9 + skyBase(normalize(vec3(L.x, 0.2, L.z)))*0.25 + 0.012;
  if (uMode > 1.5) ambient += uP1*0.05;

  if (hit > 0.5 && t < tSea){
    dist = min(t, tMax*0.999);   // a last step can overshoot the far plane: still fog it
    vec3 p = ro + rd*t;
    float e = 0.004*t + 0.01;
    float hc = groundY(p.xz, 7);
    vec3 n = normalize(vec3(hc - groundY(p.xz + vec2(e, 0.0), 7), e, hc - groundY(p.xz + vec2(0.0, e), 7)));
    float H = hc/a;
    vec3 base = groundColor(p, n, H);
    float dif = max(dot(n, L), 0.0);
    float sh = dif > 0.0 ? softShadow(p + n*0.02, L) : 0.0;
    col = base*(dif*sh*1.25*cloudShadow(p, L)*sunIn*vec3(1.0, 0.93, 0.85) + ambient*(0.5 + 0.5*n.y));
    if (uMode > 0.5 && uMode < 1.5){
      // Lava: glowing cracks in a dark crust.
      vec2 q = p.xz*0.25 + uSeed.zy;
      float cr = 1.0 - abs(2.0*n2(q) - 1.0);
      cr = max(cr, 1.0 - abs(2.0*n2(q*2.3 + 5.0) - 1.0));
      float glow = smoothstep(0.92, 0.99, cr)*(0.6 + 0.4*sin(uTime*1.5 + n2(q*0.5)*6.0));
      col += uG5*glow*1.4*smoothstep(0.5, 0.0, H - uSea);
    }
  } else if (tSea < tMax){
    dist = tSea;
    vec3 p = ro + rd*tSea;
    float depth = (sea - groundY(p.xz, 4))/a;
    if (uMode > 0.5 && uMode < 1.5){
      float crust = smoothstep(0.55, 0.75, fbm3(vec3(p.xz*0.4, uTime*0.05)));
      col = uG5*(1.3 + 0.4*n2(p.xz*2.0 + uTime*0.3))*(1.0 - crust*0.85) + uG1*crust*0.4;
    } else {
      vec2 w = p.xz*1.3 + vec2(uTime*0.35, uTime*0.2);
      vec3 n = normalize(vec3((n2(w) - 0.5)*0.12, 1.0, (n2(w.yx + 9.0) - 0.5)*0.12));
      vec3 rf = reflect(rd, n); rf.y = abs(rf.y);
      float fres = 0.04 + 0.96*pow(1.0 - max(dot(-rd, n), 0.0), 5.0);
      vec3 water = mix(uG1, uG0, smoothstep(0.0, 0.25, depth))*(ambient*1.2 + max(L.y, 0.0)*0.6*sunIn);
      col = mix(water, sky(rf), fres);
      col += vec3(1.0, 0.9, 0.75)*pow(max(dot(rf, L), 0.0), 300.0)*3.0*sunIn*smoothstep(-0.02, 0.05, L.y);
      col = mix(col, vec3(0.9)*(ambient + max(L.y, 0.0)*0.8), smoothstep(0.02, 0.0, depth)*0.5); // surf
    }
  } else {
    col = sky(rd);
    if (rd.y < 0.0) dist = tMax*0.9;   // past the far plane: fade into the haze
  }
  // Aerial perspective toward the world's own sky colour (thinner looking down from altitude).
  if (dist < tMax){
    float thick = 1.0/(1.0 + uAlt*0.04*max(-rd.y, 0.0)*6.0);
    float fog = max(1.0 - exp(-(dist*0.012*uSky + dist*0.002)*thick), smoothstep(0.6*tMax, tMax, dist));
    col = mix(col, skyBase(normalize(vec3(rd.x, 0.03, rd.z))) + ambient*0.05, fog);
  }
  // Descending: the top of the cloud deck, lit from above, with the ground showing through the gaps.
  if (uCloud > 0.0 && ro.y > gCloudY && rd.y < 0.0){
    float tc = (ro.y - gCloudY)/(-rd.y);
    if (tc < dist){
      float cov = cloudCov(ro.xz + rd.xz*tc, 1);
      vec3 top = uCloudCol*(0.3 + 1.0*smoothstep(-0.1, 0.4, L.y))*mix(vec3(1.0), vec3(1.0, 0.75, 0.55), 1.0 - smoothstep(0.05, 0.45, L.y));
      top = mix(top, skyBase(normalize(vec3(rd.x, 0.03, rd.z))), 1.0 - exp(-tc*0.006));
      col = mix(col, top*uSky + ambient*0.1, cov*0.92);
    }
  }

  col = col/(1.0 + col*0.35);
  col = pow(col, vec3(0.92));
  col *= 1.0 - 0.3*dot(uv, uv);
  col = mix(uAtmo*0.6 + 0.3, col, uFade);
  gl_FragColor = vec4(col, 1.0);
}`;

  const norm = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
  const cross = (a, b) => [a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2], a[0]*b[1] - a[1]*b[0]];
  const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
  const add = (...vs) => [0, 1, 2].map((i) => vs.reduce((s, v) => s + v[i], 0));
  const sc = (v, k) => v.map((x) => x * k);

  // A float32 copy of the shader's terrain, used once per world to land on a hilltop with a view
  // instead of at the foot of a cliff. If GPU and JS disagree slightly, only the choice of spot changes.
  const F = Math.fround;
  const fract = (x) => F(x - Math.floor(x));
  function hash(x, y, z) {
    x = F(fract(F(F(x * F(0.3183099)) + F(0.1))) * 17); y = F(fract(F(F(y * F(0.3183099)) + F(0.1))) * 17);
    z = F(fract(F(F(z * F(0.3183099)) + F(0.1))) * 17);
    return fract(F(F(F(x * y) * z) * F(F(x + y) + z)));
  }
  const mix = (a, b, t) => a + (b - a) * t;
  function noise(x, y, z) {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    let fx = x - ix, fy = y - iy, fz = z - iz;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
    const h = (a, b, c) => hash(ix + a, iy + b, iz + c);
    return mix(mix(mix(h(0, 0, 0), h(1, 0, 0), fx), mix(h(0, 1, 0), h(1, 1, 0), fx), fy),
      mix(mix(h(0, 0, 1), h(1, 0, 1), fx), mix(h(0, 1, 1), h(1, 1, 1), fx), fy), fz);
  }
  const n2 = (x, y) => noise(x, 0.5, y);
  function terrainH(x, z, g) {
    let px = x * 0.05 * g.scale + g.seed[0], py = z * 0.05 * g.scale + g.seed[1];
    const w = n2(px * 0.5 + 7, py * 0.5 + 7);
    px += w * 1.2; py += w * 1.2;
    let a = 0.5, s = 0, r = 0;
    for (let i = 0; i < 6; i++) {
      const v = n2(px, py);
      s += a * v; r += a * (1 - Math.abs(2 * v - 1));
      [px, py] = [(0.8 * px + 0.6 * py) * 2.03, (-0.6 * px + 0.8 * py) * 2.03];
      a *= 0.5;
    }
    return (mix(s, s * 0.5 + r * r * 0.62, g.rough) - 0.3) / 0.42;
  }
  const spots = new Map();
  function landingSpot(world) {
    const key = world.name.toLowerCase();
    if (spots.has(key)) return spots.get(key);
    const r = world.render, gas = r.kind === 2;
    const g = { seed: r.seed, scale: gas ? 1.6 : r.scale, rough: gas ? 0.7 : r.rough };
    let best = [0, 0], top = -Infinity;
    for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) {
      const h = terrainH(i * 3, j * 3, g) - Math.hypot(i, j) * 0.02;   // prefer nearby among equals
      if (h > top) { top = h; best = [i * 3, j * 3]; }
    }
    spots.set(key, best);
    return best;
  }

  const MOON_PACE = 0.33;   // moons cross the sky at a third of the orbit view's pace
  function moonPos(m, time) {
    const a = m.phase + time * m.speed;
    return [Math.cos(a) * m.orbit, Math.sin(a) * Math.sin(m.inclination) * m.orbit, Math.sin(a) * Math.cos(m.inclination) * m.orbit];
  }
  // Where you stand and which way is up, in planet space. Pure: tested in Node.
  // Rocky worlds: on the surface at 22° latitude, facing the equator, so rings arch across the southern sky.
  // Gas giants: on the first moon (lifted out of the ring plane so the rings show), facing the giant.
  function site(world, t0 = 0) {
    const r = world.render;
    const L0 = (U, N, E, elev, az) => norm(add(sc(U, Math.sin(elev)), sc(N, Math.cos(elev) * Math.cos(az)), sc(E, Math.cos(elev) * Math.sin(az))));
    if (r.kind === 2) {
      const m = r.moons[0] || { orbit: (r.ring ? r.ringOut + 0.35 : 1.5) + 0.1, phase: 0.8, radius: 0.14, color: [0.6, 0.58, 0.55] };
      const dir = norm([Math.cos(m.phase), 0.42, Math.sin(m.phase)]);
      const centre = sc(dir, Math.max(m.orbit, 2.4));          // far enough to frame the giant
      const T = sc(dir, -1);                                   // toward the giant
      const yAxis = [0, 1, 0];
      const P = norm(add(yAxis, sc(T, -dot(yAxis, T))));
      const elev = 0.5;                                        // giant's centre ~29° up
      const U = norm(add(sc(T, Math.sin(elev)), sc(P, Math.cos(elev))));
      const N = norm(add(T, sc(U, -dot(T, U))));
      const E = cross(U, N);
      const O = add(centre, sc(U, m.radius));
      // Sun low and behind your right shoulder, so the giant shows a bright gibbous face.
      return { O, U, N, E, L: L0(U, N, E, 0.2, 2.25), lat: 0, moon: m, yaw: 0, pitch: 0.3 };
    }
    let lat = 0.38;
    const frame = (lon) => {
      const O = [Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)];
      const N = [-Math.sin(lat) * Math.cos(lon), Math.cos(lat), -Math.sin(lat) * Math.sin(lon)]; // toward the north pole
      return { O, U: O.slice(), N, E: cross(O, N) };
    };
    const m = r.moons[0];
    if (!m) {
      // Face the equator (tangent -N), with the low sun ahead and to the left.
      const f = frame(0);
      return { ...f, L: L0(f.U, f.N, f.E, 0.2, Math.PI - 0.55), lat: Math.abs(Math.sin(lat)), moon: null, yaw: Math.PI, pitch: r.ring ? 0.24 : 0.06 };
    }
    // Close moons pass nearly overhead. Stand at the longitude where the first moon, a few seconds
    // after landing, hangs about 22° up toward the equator, and look at it.
    const P = moonPos(m, (t0 + 4) * MOON_PACE);
    if (P[1] < -0.15) lat = -lat;                              // the moon is in the southern sky: stand south
    let best = null;
    for (let k = 0; k <= 40; k++) {
      const lon = Math.atan2(P[2], P[0]) + (k - 20) * 0.075;
      const f = frame(lon);
      const rel = norm(add(P, sc(f.O, -1)));
      const elev = Math.asin(dot(rel, f.U)), az = Math.atan2(dot(rel, f.E), dot(rel, f.N));
      const score = Math.abs(elev - 0.38) + (Math.cos(az) * lat > 0 ? 0.5 : 0);   // prefer facing the equator
      if (!best || score < best.score) best = { ...f, score, elev, az };
    }
    const { O, U, N, E, elev, az } = best;
    // Sun low, well to the left of the moon: a lit half-moon over a sunset.
    return { O, U, N, E, L: L0(U, N, E, 0.2, az - 1.25), lat: Math.abs(Math.sin(lat)), moon: null, yaw: az - 0.25,
      pitch: Math.max(0.05, Math.min(0.4, elev - 0.2)) };
  }

  // Where a friend's world hangs in this world's sky: in the first view, clear of the first moon and
  // the giant, away from the low sun so it shows a lit face. Directions are in the shader's tangent
  // frame (x east, y up, z north; yaw grows to the right). 'sun' is the light in the sprite's own frame.
  // 'aspect' (width / height): on narrow phones 'look' turns the view so the twin and the moon both fit.
  function companion(world, friend, t0 = 0, aspect = 1.7) {
    const s = site(world, t0), r = world.render, fr = friend.render;
    const R = Math.max(1.15, fr.ring ? fr.ringOut : 0), size = 0.14 * R / 1.15, own = Math.atan(size);
    const focal = aspect < 1 / 1.1 ? 0.75 : 1, halfFov = Math.atan(0.5 * aspect / focal);
    const T = (v) => [dot(v, s.E), dot(v, s.U), dot(v, s.N)];
    let yaw, el;
    if (r.kind === 2) {
      // Beside the giant, on the side away from the sun (which is behind your right shoulder).
      el = 0.45; yaw = s.yaw - (Math.asin(1 / Math.hypot(...s.O)) + own * 0.9 + 0.04) / Math.cos(el);
    } else if (r.moons[0]) {
      // Just right of the first moon; the low sun is far to the left.
      const m = r.moons[0], rel = add(moonPos(m, (t0 + 4) * MOON_PACE), sc(s.O, -1)), dist = Math.hypot(...rel);
      const d = T(sc(rel, 1 / dist)), mEl = Math.asin(d[1]), mAz = Math.atan2(d[0], d[2]);
      el = Math.max(0.32, mEl + 0.06);
      yaw = mAz + (Math.asin(Math.min(1, m.radius / dist)) + own * 0.85 + 0.03) / Math.cos(el);
    } else {
      el = Math.max(0.32, s.pitch + 0.2); yaw = s.yaw + Math.min(0.5, halfFov * 0.6);
    }
    el = Math.max(0.28, Math.min(el, s.pitch + Math.atan(0.5 / focal) - own * 0.85));   // inside the first view
    const dir = [Math.sin(yaw) * Math.cos(el), Math.sin(el), Math.cos(yaw) * Math.cos(el)];
    const rt = norm([Math.cos(yaw), 0, -Math.sin(yaw)]);
    const up = cross(dir, rt);
    const L = T(s.L);
    const right = yaw + own * 0.7 - (s.yaw + halfFov * 0.92), left = yaw - own * 0.7 - (s.yaw - halfFov * 0.92);
    const look = right > 0 ? right : Math.min(0, left);
    return { dir, rt, up, size, look, sun: norm([dot(L, rt), dot(L, up), -dot(L, dir)]) };
  }

  function createSurface(gl) {
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
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "a");
    const U = {};
    const u = (n) => U[n] || (U[n] = gl.getUniformLocation(prog, n));

    return {
      draw(state) {
        const canvas = gl.canvas;
        const r = state.world.render;
        const s = site(state.world, state.landTime || 0);
        gl.useProgram(prog);
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.uniform2f(u("uRes"), canvas.width, canvas.height);
        gl.uniform2fv(u("uSpot"), landingSpot(state.world));
        gl.uniform1f(u("uTime"), state.time);
        // Portrait screens are narrow: widen the lens so the sky still fits side to side.
        gl.uniform1f(u("uFocal"), (state.focal || 1) * (canvas.height > canvas.width * 1.1 ? 0.75 : 1));
        gl.uniform1f(u("uFade"), state.fade == null ? 1 : state.fade);
        // Arrival: 'descent' runs 1 → 0. The camera drops from high above, tilted down at the land,
        // and levels out to the composed first view as it reaches the ground.
        const dsc = state.descent || 0;
        gl.uniform1f(u("uAlt"), 60 * dsc * dsc);
        gl.uniform1f(u("uYaw"), s.yaw + (state.lookYaw || 0) + (state.drift || 0) + (state.comp ? state.comp.look : 0) - 0.5 * dsc);
        gl.uniform1f(u("uPitch"), Math.max(-0.6, Math.min(1.35, s.pitch + (state.lookPitch || 0))) - 0.75 * dsc);
        for (const k of ["O", "E", "U", "N", "L"]) gl.uniform3fv(u("u" + k), s[k]);
        gl.uniform3fv(u("uSeed"), r.seed);
        const gas = r.kind === 2;
        let ground = r.pal;
        if (gas) {
          const c = s.moon.color;
          ground = [0.3, 0.42, 0.62, 0.8, 0.95, 1.15].map((k) => c.map((x) => Math.min(1, x * k)));
        }
        const f = (k, v) => gl.uniform1f(u(k), v);
        f("uMode", gas ? 2 : r.kind === 1 ? 1 : 0);
        f("uSea", gas ? -1 : r.sea > 0 ? r.sea : -1);
        f("uCloud", gas ? 0 : r.cloud);
        f("uIce", gas ? 2 : r.ice);
        f("uCity", r.cities);
        f("uRough", gas ? 0.7 : r.rough);
        f("uScale", gas ? 1.6 : r.scale);
        f("uLat", s.lat);
        f("uBands", r.bands);
        f("uSky", gas ? 0 : r.kind === 1 ? 0.45 : 1);
        f("uRing", r.ring); f("uRingIn", r.ringIn); f("uRingOut", r.ringOut);
        ground.forEach((c, i) => gl.uniform3fv(u("uG" + i), c));
        r.pal.forEach((c, i) => gl.uniform3fv(u("uP" + i), c));
        gl.uniform3fv(u("uAtmo"), r.atmo);
        gl.uniform3fv(u("uCloudCol"), r.cloudCol);
        gl.uniform3fv(u("uRingCol"), r.ringCol);
        const moons = [], colors = [];
        for (let i = 0; i < 3; i++) {
          const m = r.moons[i];
          if (!m || (gas && i === 0)) { moons.push(0, 0, 0, 0); colors.push(0, 0, 0); continue; }
          moons.push(...moonPos(m, state.time * MOON_PACE), m.radius);
          colors.push(...m.color);
        }
        gl.uniform4fv(u("uMoons[0]"), moons);
        gl.uniform3fv(u("uMoonColors[0]"), colors);
        const comp = state.comp;
        gl.activeTexture(gl.TEXTURE0);
        if (comp) gl.bindTexture(gl.TEXTURE_2D, comp.tex);
        gl.uniform1i(u("uComp"), 0);
        gl.uniform1f(u("uCompSize"), comp ? comp.size : 0);
        if (comp) for (const k of ["Dir", "Rt", "Up"]) gl.uniform3fv(u("uComp" + k), comp[k.toLowerCase()]);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
    };
  }

  const api = { createSurface, site, terrainH, landingSpot, companion };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else window.Surface = api;
})();
