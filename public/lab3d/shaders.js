/* Shaders GLSL ES 3.00.
   A grade 3D (nx,ny,nz) fica achatada num atlas 2D: cada fatia z é um ladrilho nx×ny.
   Texturas: vel (xyz, cm/s) · sc (θ temperatura, F vapor de combustível, O oxigênio, S fuligem)
             aux (taxa de reação, taxa de pirólise) · p (pressão) · div (divergência)
   O estado fica em 32 bits e toda interpolação do solver é feita à mão (texelFetch): o filtro
   bilinear da placa usa pesos de 8 bits, o que trava o transporte em ar lento. */
(function () {
  const FL = (window.FL = window.FL || {});
  const HEAD = '#version 300 es\nprecision highp float; precision highp int; precision highp sampler2D;\n';

  const COMMON = `
uniform ivec3 uN; uniform ivec2 uTiles; uniform vec3 uL;
uniform int uShape; uniform vec3 uSPos; uniform vec3 uSDim;
uniform int uSealed; uniform vec3 uWind;
ivec3 cellOf(ivec2 fc){ ivec2 t = fc / uN.xy; return ivec3(fc - t*uN.xy, t.x + t.y*uTiles.x); }
ivec2 texelOf(ivec3 c){ return ivec2(c.x + (c.z % uTiles.x)*uN.x, c.y + (c.z / uTiles.x)*uN.y); }
vec4 fetchC(sampler2D s, ivec3 c){ return texelFetch(s, texelOf(c), 0); }
// amostra trilinear; g em unidades de célula (centros em i+0.5)
vec4 sample3(sampler2D s, vec3 g){
  g = clamp(g, vec3(0.5), vec3(uN) - 0.5);
  float z = g.z - 0.5; float z0 = floor(z); float f = z - z0;
  int i0 = int(z0); int i1 = min(i0 + 1, uN.z - 1);
  vec2 inv = 1.0 / vec2(uN.xy * uTiles);
  vec2 o0 = vec2(float(i0 % uTiles.x), float(i0 / uTiles.x)) * vec2(uN.xy);
  vec2 o1 = vec2(float(i1 % uTiles.x), float(i1 / uTiles.x)) * vec2(uN.xy);
  // textureLod: sem derivadas, o compilador não precisa desenrolar os laços de marcha de raios
  return mix(textureLod(s, (o0 + g.xy) * inv, 0.0), textureLod(s, (o1 + g.xy) * inv, 0.0), f);
}
vec3 worldOf(vec3 g){ return (g / vec3(uN) - 0.5) * uL; }
vec3 cellsOf(vec3 p){ return (p / uL + 0.5) * vec3(uN); }
float sdf(vec3 p){
  vec3 q = p - uSPos;
  if(uShape == 0) return length(q) - uSDim.x;
  if(uShape == 1){ vec2 d = vec2(length(q.xy) - uSDim.x, abs(q.z) - uSDim.z); return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)); }
  vec3 d = abs(q) - uSDim; return min(max(d.x, max(d.y, d.z)), 0.0) + length(max(d, 0.0));
}
float sdfCell(ivec3 c){ return sdf(worldOf(vec3(c) + 0.5)); }
bool isBnd(ivec3 c){ return any(equal(c, ivec3(0))) || any(equal(c, uN - 1)); }
vec3 outN(ivec3 c){ return vec3(equal(c, uN - 1)) - vec3(equal(c, ivec3(0))); }
bool inflow(ivec3 c){ return dot(uWind, outN(c)) < -1e-3; }
// trilinear com pesos em ponto flutuante (sem o filtro da placa); g em unidades de célula
vec4 tri(sampler2D s, vec3 g){
  g = clamp(g, vec3(0.5), vec3(uN) - 0.5) - 0.5;
  vec3 fl = floor(g), f = g - fl; ivec3 a = ivec3(fl), b = min(a + 1, uN - 1);
  ivec2 ta = ivec2((a.z % uTiles.x) * uN.x, (a.z / uTiles.x) * uN.y), tb = ivec2((b.z % uTiles.x) * uN.x, (b.z / uTiles.x) * uN.y);
  vec4 lo = mix(mix(texelFetch(s, ta + ivec2(a.x, a.y), 0), texelFetch(s, ta + ivec2(b.x, a.y), 0), f.x),
                mix(texelFetch(s, ta + ivec2(a.x, b.y), 0), texelFetch(s, ta + ivec2(b.x, b.y), 0), f.x), f.y);
  vec4 hi = mix(mix(texelFetch(s, tb + ivec2(a.x, a.y), 0), texelFetch(s, tb + ivec2(b.x, a.y), 0), f.x),
                mix(texelFetch(s, tb + ivec2(a.x, b.y), 0), texelFetch(s, tb + ivec2(b.x, b.y), 0), f.x), f.y);
  return mix(lo, hi, f.z);
}
// mínimo e máximo dos 8 vizinhos usados por tri() (limitador do MacCormack)
void triMM(sampler2D s, vec3 g, out vec4 mn, out vec4 mx){
  g = clamp(g, vec3(0.5), vec3(uN) - 0.5) - 0.5;
  ivec3 a = ivec3(floor(g)), b = min(a + 1, uN - 1);
  ivec2 ta = ivec2((a.z % uTiles.x) * uN.x, (a.z / uTiles.x) * uN.y), tb = ivec2((b.z % uTiles.x) * uN.x, (b.z / uTiles.x) * uN.y);
  vec4 v = texelFetch(s, ta + ivec2(a.x, a.y), 0); mn = v; mx = v;
  v = texelFetch(s, ta + ivec2(b.x, a.y), 0); mn = min(mn, v); mx = max(mx, v);
  v = texelFetch(s, ta + ivec2(a.x, b.y), 0); mn = min(mn, v); mx = max(mx, v);
  v = texelFetch(s, ta + ivec2(b.x, b.y), 0); mn = min(mn, v); mx = max(mx, v);
  v = texelFetch(s, tb + ivec2(a.x, a.y), 0); mn = min(mn, v); mx = max(mx, v);
  v = texelFetch(s, tb + ivec2(b.x, a.y), 0); mn = min(mn, v); mx = max(mx, v);
  v = texelFetch(s, tb + ivec2(a.x, b.y), 0); mn = min(mn, v); mx = max(mx, v);
  v = texelFetch(s, tb + ivec2(b.x, b.y), 0); mn = min(mn, v); mx = max(mx, v);
}
float hash3(vec3 p){ p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y) * p.z); }
`;

  FL.VS_QUAD = HEAD + `void main(){ vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;

  /* estado inicial: escoamento estabelecido e atmosfera ambiente */
  FL.FS_INIT = HEAD + COMMON + `
uniform float uO2;
layout(location=0) out vec4 oVel; layout(location=1) out vec4 oSc;
void main(){
  ivec3 c = cellOf(ivec2(gl_FragCoord.xy));
  oVel = vec4(0.0); oSc = vec4(0.0);
  if(c.z >= uN.z) return;
  oSc = vec4(0.0, 0.0, uO2, 0.0);
  if(sdfCell(c) < 0.0) return;
  if(uSealed == 0) oVel = vec4(uWind, 0.0);
}`;

  /* ---------- advecção: MacCormack incondicionalmente estável (Selle et al. 2008) ----------
     1) previsão semi-lagrangiana  2) a mesma viagem de volta  3) correção com metade do erro medido,
     limitada ao intervalo dos vizinhos de partida. Segunda ordem no espaço e no tempo. */
  FL.FS_ADV = HEAD + COMMON + `
uniform sampler2D uVtr, uVel, uSc; uniform float uDt, uDir; uniform vec3 uInvH;
layout(location=0) out vec4 oVel; layout(location=1) out vec4 oSc;
void main(){
  ivec3 c = cellOf(ivec2(gl_FragCoord.xy));
  oVel = vec4(0.0); oSc = vec4(0.0);
  if(c.z >= uN.z) return;
  ivec3 ce = isBnd(c) ? clamp(c, ivec3(1), uN - 2) : c;
  if(sdfCell(ce) < 0.0){ oSc = fetchC(uSc, ce); return; }
  vec3 gp = vec3(ce) + 0.5 - uDir * uDt * fetchC(uVtr, ce).xyz * uInvH;
  oVel = vec4(tri(uVel, gp).xyz, 0.0); oSc = tri(uSc, gp);
}`;

  /* correção + limitador + empuxo + arrasto junto à parede + contorno */
  FL.FS_ADV3 = HEAD + COMMON + `
uniform sampler2D uVel, uSc, uVelH, uScH, uVelB, uScB;
uniform float uDt, uBuoy, uNear, uMacD, uDragE; uniform vec3 uInvH, uFD; uniform int uMac;
layout(location=0) out vec4 oVel; layout(location=1) out vec4 oSc;
void main(){
  ivec3 c = cellOf(ivec2(gl_FragCoord.xy));
  oVel = vec4(0.0); oSc = vec4(0.0);
  if(c.z >= uN.z) return;
  bool b = isBnd(c);
  ivec3 ce = b ? clamp(c, ivec3(1), uN - 2) : c;
  float d = sdfCell(ce);
  if(d < 0.0){ oSc = fetchC(uSc, ce); return; }
  vec4 v0 = fetchC(uVel, ce);
  vec4 v = fetchC(uVelH, ce), s = fetchC(uScH, ce);
  vec3 gp = vec3(ce) + 0.5 - uDt * v0.xyz * uInvH;
  // junto ao sólido, na borda ou com a partida fora do domínio fica a previsão de primeira ordem
  bool hi = uMac == 1 && d > uMacD && all(greaterThan(ce, ivec3(1))) && all(lessThan(ce, uN - 2))
         && all(greaterThanEqual(gp, vec3(1.0))) && all(lessThanEqual(gp, vec3(uN) - 1.0));
  if(hi){
    vec4 mn, mx;
    triMM(uSc, gp, mn, mx); s = clamp(s + 0.5 * (fetchC(uSc, ce) - fetchC(uScB, ce)), mn, mx);
    triMM(uVel, gp, mn, mx); v = clamp(v + 0.5 * (v0 - fetchC(uVelB, ce)), mn, mx);
  }
  v.y += uDt * uBuoy * s.x;
  v.xyz += uFD;   // variação do escoamento imposto (ar forçado) neste passo, igual em todo o gás
  // arrasto junto à parede: emula a camada-limite (cerca de duas células) onde a chama se ancora.
  // O fator vale para 6 ms; uDragE = Δt / 6 ms mantém o mesmo arrasto por segundo com outro passo.
  v.xyz *= pow(1.0 - 0.85 * (1.0 - smoothstep(uNear * 0.3, uNear * 1.25, d)), uDragE);
  if(b){ if(uSealed == 1) v.xyz = vec3(0.0); else if(inflow(c)) v.xyz = uWind; }
  oVel = vec4(clamp(v.xyz, vec3(-400.0), vec3(400.0)), 0.0);
  oSc = s;
}`;

  /* ---------- difusão ----------
     Escalares: forma de fluxo (conservativa) + Runge-Kutta-Legendre de 2ª ordem. O coeficiente na face é a
     média dos dois lados, então o que sai de uma célula entra na vizinha. O RKL2 (Meyer, Balsara e Aslam 2014)
     é explícito e estável até (s²+s−2)/4 passos de Euler em s estágios. Sem fluxo pela borda do domínio;
     o sólido troca só calor (30%, camada sub-grade).
     Velocidade: viscosidade ν = Pr·D, implícita, duas passadas de Jacobi embutidas nos dois primeiros estágios
     (incondicionalmente estável; resolve bem as escalas curtas, que são as que a viscosidade amortece). */
  const RKL = `
uniform sampler2D uYv, uYs; uniform vec4 uDk; uniform vec3 uW; uniform float uPr, uNear, uDt;
float gth(float th){ return 0.3 + 1.2 * clamp(th, 0.0, 1.5); }
// ls = Δt·L(s). Com VEL: av = Σ a·v_viz e ad = Σ a, onde a = Δt·w·ν na face
void lapl(ivec3 c, float d0, vec4 s0, out vec4 ls, out vec4 av, out float ad){
  float g0 = gth(s0.x); bool near = d0 < uNear;
  ls = vec4(0.0); av = vec4(0.0); ad = 0.0;
  for(int i = 0; i < 6; i++){
    int ax = i >> 1; ivec3 o = ivec3(0); o[ax] = (i & 1) == 0 ? -1 : 1;
    ivec3 cn = c + o; float w = uW[ax], gf = g0;
    if(!isBnd(cn)){
      vec4 sn = fetchC(uYs, cn);
      if(near && sdfCell(cn) < 0.0) ls.x += w * g0 * 0.3 * (sn.x - s0.x);
      else { gf = 0.5 * (g0 + gth(sn.x)); ls += w * gf * (sn - s0); }
    }
#ifdef VEL
    av += w * gf * fetchC(uYv, cn); ad += w * gf;
#endif
  }
  ls *= uDt * uDk;
  float kv = uDt * uDk.x * uPr; av *= kv; ad *= kv;
}`;

  /* primeiro estágio: Y1 = Y0 + μ̃1·Δt·L(Y0); guarda Δt·L(Y0). Velocidade: 1ª passada de Jacobi */
  FL.FS_RKL1 = HEAD + '#define VEL\n' + COMMON + RKL + `
uniform vec4 uCo;
layout(location=0) out vec4 oVel; layout(location=1) out vec4 oSc; layout(location=2) out vec4 oLs;
void main(){
  ivec3 c = cellOf(ivec2(gl_FragCoord.xy));
  oVel = vec4(0.0); oSc = vec4(0.0); oLs = vec4(0.0);
  if(c.z >= uN.z) return;
  vec4 v0 = fetchC(uYv, c), s0 = fetchC(uYs, c);
  oVel = v0; oSc = s0;
  if(isBnd(c)) return;
  float d = sdfCell(c);
  if(d < 0.0) return;
  vec4 ls, av; float ad; lapl(c, d, s0, ls, av, ad);
  oVel = (v0 + av) / (1.0 + ad); oSc = s0 + uCo.z * ls; oLs = ls;
}`;

  /* estágio j ≥ 2: Yj = μ·Yj−1 + ν·Yj−2 + (1−μ−ν)·Y0 + μ̃·Δt·L(Yj−1) + γ̃·Δt·L(Y0).
     Com VEL (só o estágio 2) sai também a 2ª passada de Jacobi da velocidade. */
  const RKLJ = RKL + `
uniform sampler2D uPs, u0v, u0s, uLs; uniform vec4 uCo;
#ifdef VEL
layout(location=0) out vec4 oVel; layout(location=1) out vec4 oSc;
#else
layout(location=0) out vec4 oSc;
#endif
void main(){
  ivec2 fc = ivec2(gl_FragCoord.xy);
  ivec3 c = cellOf(fc);
  oSc = vec4(0.0);
#ifdef VEL
  oVel = vec4(0.0);
#endif
  if(c.z >= uN.z) return;
  vec4 y0s = texelFetch(u0s, fc, 0);
  oSc = y0s;
#ifdef VEL
  vec4 y0v = texelFetch(u0v, fc, 0);
  oVel = y0v;
#endif
  if(isBnd(c)) return;
  float d = sdfCell(c);
  if(d < 0.0) return;
  vec4 s1 = texelFetch(uYs, fc, 0);
  vec4 ls, av; float ad; lapl(c, d, s1, ls, av, ad);
  oSc = uCo.x * s1 + uCo.y * texelFetch(uPs, fc, 0) + (1.0 - uCo.x - uCo.y) * y0s + uCo.z * ls + uCo.w * texelFetch(uLs, fc, 0);
#ifdef VEL
  oVel = (y0v + av) / (1.0 + ad);
#endif
}`;
  FL.FS_RKLV = HEAD + '#define VEL\n' + COMMON + RKLJ;
  FL.FS_RKL = HEAD + COMMON + RKLJ;

  /* ---------- ignitor + pirólise + reação de um passo + fuligem + radiação + contorno ----------
     A reação é integrada em subpassos, com a temperatura atualizada a cada um e a solução exata da cinética
     bimolecular (taxa = k·F·O/s). O que o transporte fez neste passo (difusão, ignitor, pirólise) entra aos
     poucos, um pedaço por subpasso, junto com a perda radiativa: assim a célula não reage "isolada" durante
     o passo inteiro e o limite de extinção deixa de depender do tamanho do passo.
     Também sai daqui a divergência menos as fontes de volume. */
  FL.FS_REACT = HEAD + COMMON + `
uniform sampler2D uX, uX0, uVel;
uniform float uDt, uO2, uK, uTa, uStoich, uQ, uRad, uPyrT, uPyrM, uPyrL, uSootF, uShell, uFlood, uExp, uBlow;
uniform vec3 uIgPos, uInvH; uniform float uIgR, uIgOn; uniform int uRsub;
layout(location=0) out vec4 oSc; layout(location=1) out vec4 oAux; layout(location=2) out vec4 oDiv;
void main(){
  ivec3 c = cellOf(ivec2(gl_FragCoord.xy));
  oSc = vec4(0.0); oAux = vec4(0.0); oDiv = vec4(0.0);
  if(c.z >= uN.z) return;
  bool b = isBnd(c);
  ivec3 ce = b ? clamp(c, ivec3(1), uN - 2) : c;
  vec3 wp = worldOf(vec3(ce) + 0.5);
  float d = sdf(wp);
  float ig = uIgOn * (1.0 - smoothstep(uIgR * 0.5, uIgR, length(wp - uIgPos)));
  vec4 s1 = fetchC(uX, ce);   // depois da difusão
  if(d < 0.0){
    // sólido: aquece pelos vizinhos e pelo ignitor, limitado à temperatura de pirólise
    // as espécies guardam a média dos vizinhos gasosos (valor fantasma), para a advecção não criar sumidouro
    float T = s1.x, avg = 0.0, ng = 0.0; vec3 sp = vec3(0.0);
    for(int i = 0; i < 6; i++){
      ivec3 o = ivec3(0); o[i >> 1] = (i & 1) == 0 ? -1 : 1;
      vec4 nb = fetchC(uX, ce + o); avg += nb.x;
      if(sdfCell(ce + o) >= 0.0){ sp += nb.yzw; ng += 1.0; }
    }
    T += uDt * 6.0 * (avg / 6.0 - T);
    T += ig * (1.0 - exp(-uDt * 25.0)) * (uPyrT - T);
    oSc = vec4(min(T, uPyrT), ng > 0.0 ? sp / ng : s1.yzw);
    return;
  }
  s1.x += ig * (1.0 - exp(-uDt * 80.0)) * max(1.1 - s1.x, 0.0);
  float md = 0.0;
  if(d < uShell){
    float ex = max(s1.x - uPyrT, 0.0);
    float dF = max(0.7 - s1.y, 0.0) * (1.0 - exp(-uDt * uPyrM * ex));
    s1.y += dF;
    s1.x = max(s1.x - uPyrL * dF, min(s1.x, uPyrT));
    md = dF / uDt;
  }
  vec4 s = fetchC(uX0, ce);   // antes da difusão (campo advectado)
  vec4 ds = (s1 - s) / float(uRsub);
  float r = 0.0, dts = uDt / float(uRsub);
  for(int i = 0; i < 8; i++){
    if(i >= uRsub) break;
    s += ds;
    float x = uK * exp(-uTa / (300.0 + 1900.0 * s.x)) * dts;
    float ox = s.z / uStoich;
    float m = min(s.y, ox), o = max(s.y, ox), dl = o - m;
    // m' = −k·m·o com o − m constante: m(t) = m·Δ / (o·e^(kΔt) − m); se Δ → 0, m / (1 + k·m·t)
    float m1 = dl > 1e-5 * o ? m * dl / (o * exp(min(x * dl, 60.0)) - m) : m / (1.0 + x * m);
    float dr = clamp(m - m1, 0.0, m);
    s.y -= dr; s.z -= uStoich * dr; s.x += uQ * dr; r += dr;
    s.x -= dts * uRad * (1.0 + 6.0 * s.w) * (pow((300.0 + 1900.0 * s.x) / 2200.0, 4.0) - 3.5e-4);
  }
  float hot = max(s.x - 0.55, 0.0);
  s.w += uDt * uSootF * s.y * hot * hot;
  s.w -= s.w * (1.0 - exp(-uDt * 30.0 * s.z * smoothstep(0.4, 0.8, s.x)));
  s.z *= exp(-uDt * uFlood);   // descarga de supressor: dilui o O2 em todo o volume
  s = clamp(s, vec4(0.0), vec4(1.8, 1.0, 1.0, 1.0));
  if(b){
    if(uSealed == 0){
      vec3 v = fetchC(uVel, c).xyz;
      if(inflow(c) || dot(v, outN(c)) < 0.0) s = vec4(0.0, 0.0, uO2, 0.0);
    }
    oSc = s; oAux = vec4(r / uDt, md, 0.0, 0.0);
    return;
  }
  float dv = 0.5 * ((fetchC(uVel, c + ivec3(1,0,0)).x - fetchC(uVel, c - ivec3(1,0,0)).x) * uInvH.x
                  + (fetchC(uVel, c + ivec3(0,1,0)).y - fetchC(uVel, c - ivec3(0,1,0)).y) * uInvH.y
                  + (fetchC(uVel, c + ivec3(0,0,1)).z - fetchC(uVel, c - ivec3(0,0,1)).z) * uInvH.z);
  oSc = s; oAux = vec4(r / uDt, md, 0.0, 0.0);
  oDiv = vec4(dv - uExp * (r / uDt) * uQ * 1900.0 / (300.0 + 1900.0 * s.x) - uBlow * md);
}`;

  /* ---------- pressão: multigrid geométrico (ciclo V) ----------
     Nível 0 = a grade do solver (contorno e sólido calculados na hora, como antes).
     Níveis grossos = agregados 2×2×2 das células interiores, com coeficientes de face guardados em
     textura (soma das faces finas abertas, dividida por 2 a cada nível) e prolongamento trilinear.
     Equação: Σ w·(p_viz − p) = div.  Contorno: p = 0 na face de saída · entrada, parede e sólido sem fluxo.
     Suavização: Jacobi com pesos de Chebyshev (uOmega muda a cada passada). */
  const MG0 = `
uniform sampler2D uP, uDiv; uniform vec3 uW, uNeuLo, uNeuHi; uniform float uNear;
void stencil0(ivec3 c, float d, out float sum, out float diag){
  ivec2 fc = texelOf(c);
  vec3 lo = vec3(texelFetch(uP, fc - ivec2(1, 0), 0).x, texelFetch(uP, fc - ivec2(0, 1), 0).x, fetchC(uP, c - ivec3(0, 0, 1)).x);
  vec3 hi = vec3(texelFetch(uP, fc + ivec2(1, 0), 0).x, texelFetch(uP, fc + ivec2(0, 1), 0).x, fetchC(uP, c + ivec3(0, 0, 1)).x);
  vec3 bl = vec3(equal(c, ivec3(1))), bh = vec3(equal(c, uN - 2));
  // face de saída: p = 0 na face, isto é, fantasma = −p (peso 2w na diagonal); sem fluxo: peso 0
  vec3 wl = uW * (1.0 + bl * (1.0 - 2.0 * uNeuLo)), wh = uW * (1.0 + bh * (1.0 - 2.0 * uNeuHi));
  lo *= 1.0 - bl; hi *= 1.0 - bh;
  if(d < uNear){
    if(sdfCell(c - ivec3(1, 0, 0)) < 0.0) wl.x = 0.0;
    if(sdfCell(c + ivec3(1, 0, 0)) < 0.0) wh.x = 0.0;
    if(sdfCell(c - ivec3(0, 1, 0)) < 0.0) wl.y = 0.0;
    if(sdfCell(c + ivec3(0, 1, 0)) < 0.0) wh.y = 0.0;
    if(sdfCell(c - ivec3(0, 0, 1)) < 0.0) wl.z = 0.0;
    if(sdfCell(c + ivec3(0, 0, 1)) < 0.0) wh.z = 0.0;
  }
  sum = dot(wl, lo) + dot(wh, hi);
  diag = wl.x + wl.y + wl.z + wh.x + wh.y + wh.z;
}`;
  /* Níveis grossos. Todo agregado tem uFull células finas por eixo, menos o último de cada eixo, que tem
     uLast (grade ímpar). Áreas e distâncias saem daí, então a grade não precisa ser potência de 2. */
  const MGL = `
uniform float uFull; uniform vec3 uLast, uDirLo, uDirHi, uWl;   // do nível onde o estêncil é avaliado
uniform vec3 uSg, uLam;                                          // do nível grosso de onde se prolonga
ivec3 cellL(ivec2 fc, ivec3 n, ivec2 t){ ivec2 q = fc / n.xy; return ivec3(fc - q * n.xy, q.x + q.y * t.x); }
ivec2 texL(ivec3 c, ivec3 n, ivec2 t){ return ivec2(c.x + (c.z % t.x) * n.x, c.y + (c.z / t.x) * n.y); }
float fetchL(sampler2D s, ivec3 c, ivec3 n, ivec2 t){ return texelFetch(s, texL(clamp(c, ivec3(0), n - 1), n, t), 0).x; }
void stencilL(sampler2D E, sampler2D K, ivec3 c, ivec3 n, ivec2 t, out float sum, out float diag){
  vec3 k = texelFetch(K, texL(c, n, t), 0).xyz;
  vec3 km = vec3(c.x > 0 ? texelFetch(K, texL(c - ivec3(1, 0, 0), n, t), 0).x : 0.0,
                 c.y > 0 ? texelFetch(K, texL(c - ivec3(0, 1, 0), n, t), 0).y : 0.0,
                 c.z > 0 ? texelFetch(K, texL(c - ivec3(0, 0, 1), n, t), 0).z : 0.0);
  // a face entre a penúltima e a última célula liga centros mais próximos que uFull
  vec3 sc = 2.0 * uFull / (uFull + uLast);
  k *= mix(vec3(1.0), sc, vec3(equal(c, n - 2)));
  km *= mix(vec3(1.0), sc, vec3(equal(c, n - 1)));
  vec3 lo = vec3(fetchL(E, c - ivec3(1, 0, 0), n, t), fetchL(E, c - ivec3(0, 1, 0), n, t), fetchL(E, c - ivec3(0, 0, 1), n, t));
  vec3 hi = vec3(fetchL(E, c + ivec3(1, 0, 0), n, t), fetchL(E, c + ivec3(0, 1, 0), n, t), fetchL(E, c + ivec3(0, 0, 1), n, t));
  sum = dot(km, lo) + dot(k, hi);
  // saída: p = 0 na face, a ext/2 células finas do centro do agregado
  vec3 ext = mix(vec3(uFull), uLast, vec3(equal(c, n - 1)));
  vec3 dir = vec3(equal(c, ivec3(0))) * uDirLo + vec3(equal(c, n - 1)) * uDirHi;
  diag = km.x + km.y + km.z + k.x + k.y + k.z + dot(dir * ext.yzx * ext.zxy * 2.0 * uWl / ext, vec3(1.0));
}
// um eixo do prolongamento; g em unidades de célula grossa (centros em inteiros, o último em n−2+σ).
// Além do primeiro e do último centro o valor segue reto até zerar na face de saída (ou fica constante sem fluxo).
void ax(float g, int n, float sg, float lam, float dLo, float dHi, out int i0, out int i1, out float f, out float q){
  q = 1.0; f = 0.0;
  if(g <= 0.0){ i0 = 0; i1 = 0; q = 1.0 + dLo * 2.0 * g; return; }
  float t = g - float(n - 2);
  if(n == 1){ i0 = 0; i1 = 0; q = 1.0 - dHi * g / lam; return; }
  if(t <= 0.0){ i0 = int(floor(g)); i1 = i0 + 1; f = g - float(i0); return; }
  if(t <= sg){ i0 = n - 2; i1 = n - 1; f = t / sg; return; }
  i0 = n - 1; i1 = n - 1; q = 1.0 - dHi * (t - sg) / lam;
}
float prol(sampler2D E, vec3 g, ivec3 n, ivec2 t){
  ivec3 a, b; vec3 f, q;
  ax(g.x, n.x, uSg.x, uLam.x, uDirLo.x, uDirHi.x, a.x, b.x, f.x, q.x);
  ax(g.y, n.y, uSg.y, uLam.y, uDirLo.y, uDirHi.y, a.y, b.y, f.y, q.y);
  ax(g.z, n.z, uSg.z, uLam.z, uDirLo.z, uDirHi.z, a.z, b.z, f.z, q.z);
  return q.x * q.y * q.z * mix(
    mix(mix(fetchL(E, ivec3(a.x, a.y, a.z), n, t), fetchL(E, ivec3(b.x, a.y, a.z), n, t), f.x),
        mix(fetchL(E, ivec3(a.x, b.y, a.z), n, t), fetchL(E, ivec3(b.x, b.y, a.z), n, t), f.x), f.y),
    mix(mix(fetchL(E, ivec3(a.x, a.y, b.z), n, t), fetchL(E, ivec3(b.x, a.y, b.z), n, t), f.x),
        mix(fetchL(E, ivec3(a.x, b.y, b.z), n, t), fetchL(E, ivec3(b.x, b.y, b.z), n, t), f.x), f.y), f.z);
}`;

  /* nível 0: Jacobi com peso uOmega */
  FL.FS_MG_SM0 = HEAD + COMMON + MG0 + `
uniform float uOmega;
out vec4 oP;
void main(){
  ivec2 fc = ivec2(gl_FragCoord.xy);
  ivec3 c = cellOf(fc);
  oP = vec4(0.0);
  if(c.z >= uN.z || isBnd(c)) return;
  float d = sdfCell(c);
  if(d < 0.0) return;
  float sum, diag; stencil0(c, d, sum, diag);
  float pc = texelFetch(uP, fc, 0).x;
  oP = vec4(diag > 0.0 ? mix(pc, (sum - texelFetch(uDiv, fc, 0).x) / diag, uOmega) : pc);
}`;

  /* nível 0 → 1: soma dos resíduos das (até) 8 células filhas */
  FL.FS_MG_RS0 = HEAD + COMMON + MG0 + MGL + `
uniform ivec3 uNc; uniform ivec2 uTc;
out vec4 oB;
void main(){
  ivec3 I = cellL(ivec2(gl_FragCoord.xy), uNc, uTc);
  oB = vec4(0.0);
  if(I.z >= uNc.z) return;
  float acc = 0.0;
  for(int k = 0; k < 8; k++){
    ivec3 f = 1 + 2 * I + ivec3(k & 1, (k >> 1) & 1, k >> 2);
    if(any(greaterThan(f, uN - 2))) continue;
    float d = sdfCell(f);
    if(d < 0.0) continue;
    float sum, diag; stencil0(f, d, sum, diag);
    acc += fetchC(uDiv, f).x - (sum - diag * fetchC(uP, f).x);
  }
  oB = vec4(acc);
}`;

  /* nível 1 → 0: p += prolongamento do erro */
  FL.FS_MG_PR0 = HEAD + COMMON + MGL + `
uniform sampler2D uP, uEc; uniform ivec3 uNc; uniform ivec2 uTc;
out vec4 oP;
void main(){
  ivec2 fc = ivec2(gl_FragCoord.xy);
  ivec3 c = cellOf(fc);
  oP = vec4(0.0);
  if(c.z >= uN.z || isBnd(c) || sdfCell(c) < 0.0) return;
  oP = vec4(texelFetch(uP, fc, 0).x + prol(uEc, (vec3(c - 1) + 0.5) * 0.5 - 0.5, uNc, uTc));
}`;

  /* coeficientes do nível 1 a partir da geometria: faces +x, +y, +z abertas para o agregado vizinho */
  FL.FS_MG_K1 = HEAD + COMMON + MGL + `
uniform vec3 uW; uniform ivec3 uNc; uniform ivec2 uTc;
out vec4 oK;
bool fluid(ivec3 f){ return all(greaterThanEqual(f, ivec3(1))) && all(lessThanEqual(f, uN - 2)) && sdfCell(f) >= 0.0; }
void main(){
  ivec3 I = cellL(ivec2(gl_FragCoord.xy), uNc, uTc);
  oK = vec4(0.0);
  if(I.z >= uNc.z) return;
  vec4 acc = vec4(0.0);
  for(int k = 0; k < 8; k++){
    ivec3 o = ivec3(k & 1, (k >> 1) & 1, k >> 2), f = 1 + 2 * I + o;
    if(!fluid(f)) continue;
    for(int a = 0; a < 3; a++){
      ivec3 e = ivec3(0); e[a] = 1;
      if(o[a] == 1 && fluid(f + e)) acc[a] += uW[a];
    }
  }
  oK = 0.5 * acc;
}`;

  /* coeficientes do nível l+1 a partir do nível l */
  FL.FS_MG_KL = HEAD + MGL + `
uniform sampler2D uK; uniform ivec3 uNl, uNc; uniform ivec2 uTl, uTc;
out vec4 oK;
void main(){
  ivec3 I = cellL(ivec2(gl_FragCoord.xy), uNc, uTc);
  oK = vec4(0.0);
  if(I.z >= uNc.z) return;
  vec4 acc = vec4(0.0);
  for(int k = 0; k < 8; k++){
    ivec3 o = ivec3(k & 1, (k >> 1) & 1, k >> 2), f = 2 * I + o;
    if(any(greaterThanEqual(f, uNl))) continue;
    vec4 kf = texelFetch(uK, texL(f, uNl, uTl), 0);
    acc += vec4(kf.xyz * vec3(o), 0.0);
  }
  oK = 0.5 * acc;
}`;

  /* níveis grossos: Jacobi com peso uOmega (uZero = 1 parte de erro nulo) */
  FL.FS_MG_SML = HEAD + MGL + `
uniform sampler2D uE, uB, uK; uniform ivec3 uNl; uniform ivec2 uTl; uniform float uOmega; uniform int uZero;
out vec4 oE;
void main(){
  ivec2 fc = ivec2(gl_FragCoord.xy);
  ivec3 c = cellL(fc, uNl, uTl);
  oE = vec4(0.0);
  if(c.z >= uNl.z) return;
  float b = texelFetch(uB, fc, 0).x;
  float sum, diag; stencilL(uE, uK, c, uNl, uTl, sum, diag);
  if(diag <= 0.0) return;
  oE = vec4(uZero == 1 ? -uOmega * b / diag : mix(texelFetch(uE, fc, 0).x, (sum - b) / diag, uOmega));
}`;

  /* nível l → l+1: soma dos resíduos das filhas */
  FL.FS_MG_RSL = HEAD + MGL + `
uniform sampler2D uE, uB, uK; uniform ivec3 uNl, uNc; uniform ivec2 uTl, uTc;
out vec4 oB;
void main(){
  ivec3 I = cellL(ivec2(gl_FragCoord.xy), uNc, uTc);
  oB = vec4(0.0);
  if(I.z >= uNc.z) return;
  float acc = 0.0;
  for(int k = 0; k < 8; k++){
    ivec3 f = 2 * I + ivec3(k & 1, (k >> 1) & 1, k >> 2);
    if(any(greaterThanEqual(f, uNl))) continue;
    float sum, diag; stencilL(uE, uK, f, uNl, uTl, sum, diag);
    ivec2 tf = texL(f, uNl, uTl);
    if(diag > 0.0) acc += texelFetch(uB, tf, 0).x - (sum - diag * texelFetch(uE, tf, 0).x);
  }
  oB = vec4(acc);
}`;

  /* nível l+1 → l: e += prolongamento */
  FL.FS_MG_PRL = HEAD + MGL + `
uniform sampler2D uE, uEc; uniform ivec3 uNl, uNc; uniform ivec2 uTl, uTc; uniform vec3 uHalf;
out vec4 oE;
void main(){
  ivec2 fc = ivec2(gl_FragCoord.xy);
  ivec3 c = cellL(fc, uNl, uTl);
  oE = vec4(0.0);
  if(c.z >= uNl.z) return;
  // centro desta célula em unidades do nível grosso (a última de cada eixo pode ser mais curta)
  vec3 off = mix(vec3(0.5), uHalf, vec3(equal(c, uNl - 1)));
  oE = vec4(texelFetch(uE, fc, 0).x + prol(uEc, (vec3(c) + off) * 0.5 - 0.5, uNc, uTc));
}`;

  /* projeção: subtrai o gradiente de pressão. O valor de p fora do fluido vem do contorno, não da textura */
  FL.FS_PROJECT = HEAD + COMMON + `
uniform sampler2D uVel, uP; uniform vec3 uInvH, uNeuLo, uNeuHi; uniform float uNear;
out vec4 oVel;
float pr(ivec3 cn, int a, float pc, bool near){
  if(cn[a] == 0) return uNeuLo[a] > 0.5 ? pc : -pc;
  if(cn[a] == uN[a] - 1) return uNeuHi[a] > 0.5 ? pc : -pc;
  return (near && sdfCell(cn) < 0.0) ? pc : fetchC(uP, cn).x;
}
void main(){
  ivec3 c = cellOf(ivec2(gl_FragCoord.xy));
  oVel = vec4(0.0);
  if(c.z >= uN.z) return;
  bool b = isBnd(c);
  ivec3 ce = b ? clamp(c, ivec3(1), uN - 2) : c;
  float d = sdfCell(ce);
  if(d < 0.0) return;
  bool near = d < uNear;
  float pc = fetchC(uP, ce).x;
  vec3 g = 0.5 * uInvH * vec3(
    pr(ce + ivec3(1,0,0), 0, pc, near) - pr(ce - ivec3(1,0,0), 0, pc, near),
    pr(ce + ivec3(0,1,0), 1, pc, near) - pr(ce - ivec3(0,1,0), 1, pc, near),
    pr(ce + ivec3(0,0,1), 2, pc, near) - pr(ce - ivec3(0,0,1), 2, pc, near));
  vec3 v = fetchC(uVel, ce).xyz - g;
  if(b){ if(uSealed == 1) v = vec3(0.0); else if(inflow(c)) v = uWind; }
  oVel = vec4(v, 0.0);
}`;

  /* quadro da linha do tempo: (θ/1.6, taxa de reação, O2/0.5, fuligem) em 8 bits */
  FL.FS_SNAP = HEAD + `
uniform sampler2D uSc, uAux;
out vec4 o;
void main(){
  ivec2 fc = ivec2(gl_FragCoord.xy);
  vec4 s = texelFetch(uSc, fc, 0); float w = texelFetch(uAux, fc, 0).x;
  o = vec4(s.x / 1.6, 1.0 - exp(-w / 1.5), s.z / 0.5, s.w);
}`;

  /* métricas: um texel por fatia z (Σ taxa·densidade, θ máx, Σ O2, células em chamas), só células interiores */
  FL.FS_REDUCE = HEAD + `
uniform ivec3 uN; uniform ivec2 uTiles; uniform sampler2D uSc, uAux;
out vec4 o;
void main(){
  ivec2 t = ivec2(gl_FragCoord.xy);
  o = vec4(0.0);
  int z = t.x + t.y * uTiles.x;
  if(z < 1 || z >= uN.z - 1) return;   // a camada de borda repete a célula vizinha (contorno) e fica fora da soma
  vec4 acc = vec4(0.0);
  for(int y = 1; y < uN.y - 1; y++) for(int x = 1; x < uN.x - 1; x++){
    ivec2 tc = t * uN.xy + ivec2(x, y);
    vec4 s = texelFetch(uSc, tc, 0); float w = texelFetch(uAux, tc, 0).x;
    acc.x += w * 1.2e-3 * 300.0 / (300.0 + 1900.0 * s.x);
    acc.y = max(acc.y, s.x);
    acc.z += s.z;
    acc.w += step(0.3, w);
  }
  o = acc;
}`;

  /* partículas traçadoras: posição em cm (xyz) e idade em s (w) */
  FL.FS_PART = HEAD + COMMON + `
uniform sampler2D uPart, uVel; uniform float uDtF, uSeed;
out vec4 o;
void main(){
  ivec2 ic = ivec2(gl_FragCoord.xy);
  vec4 p = texelFetch(uPart, ic, 0);
  vec3 v1 = tri(uVel, cellsOf(p.xyz)).xyz;
  vec3 v2 = tri(uVel, cellsOf(p.xyz + 0.5 * uDtF * v1)).xyz;
  p.xyz += uDtF * v2; p.w += uDtF;
  float life = 1.5 + 3.5 * hash3(vec3(ic, 7.0));
  if(any(greaterThan(abs(p.xyz), 0.495 * uL)) || sdf(p.xyz) < 0.0 || p.w > life){
    vec3 r = vec3(hash3(vec3(ic, uSeed)), hash3(vec3(ic.yx, uSeed + 3.1)), hash3(vec3(ic, uSeed + 7.7)));
    p = vec4((r - 0.5) * uL * 0.98, 0.0);
  }
  o = p;
}`;

  FL.VS_PART = HEAD + COMMON + `
uniform sampler2D uCur, uPrev, uSnap; uniform mat4 uVP; uniform ivec2 uPSize; uniform int uPoints; uniform float uAlpha;
out vec4 vCol;
void main(){
  int id = uPoints == 1 ? gl_VertexID : gl_VertexID >> 1;
  int end = uPoints == 1 ? 0 : gl_VertexID & 1;
  ivec2 ic = ivec2(id % uPSize.x, id / uPSize.x);
  vec4 c = texelFetch(uCur, ic, 0); vec4 q = texelFetch(uPrev, ic, 0);
  vec3 d = c.w > 0.0 ? c.xyz - q.xyz : vec3(0.0);
  vec3 pos = end == 0 ? c.xyz : c.xyz - d * 3.0;
  gl_Position = uVP * vec4(pos, 1.0);
  gl_PointSize = 1.5;
  ivec3 cell = clamp(ivec3(cellsOf(c.xyz)), ivec3(0), uN - 1);
  float th = texelFetch(uSnap, texelOf(cell), 0).r * 1.6;
  vec3 col = mix(vec3(0.62, 0.78, 0.80), vec3(1.0, 0.62, 0.28), smoothstep(0.08, 0.6, th));
  vCol = vec4(col, (end == 0 ? 1.0 : 0.0) * uAlpha * smoothstep(0.0, 0.25, c.w));
}`;
  FL.FS_PARTDRAW = HEAD + `in vec4 vCol; out vec4 o; void main(){ o = vec4(vCol.rgb * vCol.a, 1.0); }`;

  /* render volumétrico por marcha de raios + amostra sólida + plano de corte + paredes do duto.
     Sai em faixa dinâmica alta: (cor emitida, transmitância) e, à parte, só a luz da chama, que o
     pós-processamento espalha em volta dela (FS_POST). O que aparece é sempre um campo do solver:
     azul = taxa de reação · amarelo-alaranjado = fuligem quente (cor de corpo negro pela temperatura) ·
     cinza = fuligem fria. */
  FL.FS_VOLUME = HEAD + COMMON + `
uniform sampler2D uSnap; uniform mat4 uInvVP; uniform vec3 uCam; uniform vec2 uRes;
uniform int uView, uSlice, uSliceAxis; uniform float uSlicePos, uSteps, uSeed, uO2;
uniform vec3 uRamp[4]; uniform vec3 uMatCol;
uniform vec3 uLightPos, uBgIn; uniform float uLight; uniform sampler2D uAvg;
layout(location=0) out vec4 o; layout(location=1) out vec4 oGlow;
vec3 uLightCol;   // cor média da luz que a chama emitiu no quadro anterior (FS_AVG)
vec3 ramp(float t){
  t = clamp(t, 0.0, 1.0) * 3.0;
  return t < 1.0 ? mix(uRamp[0], uRamp[1], t) : t < 2.0 ? mix(uRamp[1], uRamp[2], t - 1.0) : mix(uRamp[2], uRamp[3], t - 2.0);
}
float fieldVal(vec4 d){
  if(uView == 1) return d.r * 1.6 / 1.5;
  if(uView == 2) return 1.0 - d.b * 0.5 / uO2;
  return d.a;
}
// cor de um corpo incandescente entre 900 e 2400 K (curva de corpo negro aproximada, vermelho = 1)
vec3 glowCol(float T){
  float t = clamp((T - 900.0) / 1500.0, 0.0, 1.0);
  return vec3(1.0, 0.22 + 0.62 * t, 0.02 + 0.40 * t * t);
}
void shade(vec4 d, out vec3 em, out float ab){
  if(uView == 0){
    float th = d.r * 1.6, w = d.g, S = d.a, T = 300.0 + 1900.0 * th;
    float inc = pow(clamp(T / 1900.0, 0.0, 1.3), 3.0);
    em = vec3(0.10, 0.34, 1.0) * w * 1.7 + vec3(0.30, 0.55, 1.0) * w * w * 1.2
       + glowCol(T) * S * inc * smoothstep(0.25, 0.6, th) * 12.0
       + vec3(1.0, 0.30, 0.08) * pow(max(th - 0.45, 0.0), 2.0) * 0.14
       + (uLightCol * uLight * 0.5 + 0.03) * S * (1.0 - smoothstep(0.15, 0.5, th)) * 0.9;
    ab = S * 5.0;
  } else {
    float v = clamp(fieldVal(d), 0.0, 1.0);
    em = ramp(v) * v * 2.4; ab = v * v * 1.6;
  }
}
// parede do duto onde o raio sai: luz da chama e um quadriculado de 1 cm que dá a escala
vec3 wall(vec3 p, vec3 fw){
  vec3 a = abs(p) / (0.5 * uL);
  vec3 n = a.x > a.y && a.x > a.z ? vec3(-sign(p.x), 0.0, 0.0) : a.y > a.z ? vec3(0.0, -sign(p.y), 0.0) : vec3(0.0, 0.0, -sign(p.z));
  vec3 l = uLightPos - p; float r2 = dot(l, l);
  float lit = uLight * max(dot(n, l) * inversesqrt(r2), 0.0) / (1.0 + 0.10 * r2);
  vec3 g = abs(fract(p + 0.5) - 0.5) / max(fw, vec3(1e-4)), m = 1.0 - abs(n);
  float line = clamp(1.0 - min(min(mix(1e3, g.x, m.x), mix(1e3, g.y, m.y)), mix(1e3, g.z, m.z)), 0.0, 1.0);
  return uLightCol * lit * (0.6 + 0.4 * line) + vec3(0.016, 0.022, 0.024) * line;
}
void main(){
  vec2 uv = gl_FragCoord.xy / uRes * 2.0 - 1.0;
  vec4 a = uInvVP * vec4(uv, -1.0, 1.0), b = uInvVP * vec4(uv, 1.0, 1.0);
  vec3 ro = uCam, rd = normalize(b.xyz / b.w - a.xyz / a.w);
  vec3 lc = texelFetch(uAvg, ivec2(0), 0).rgb;
  uLightCol = mix(vec3(1.0, 0.8, 0.7), lc / max(max(lc.r, max(lc.g, lc.b)), 1e-4), 0.85);
  vec3 hb = 0.5 * uL;
  vec3 t0 = (-hb - ro) / rd, t1 = (hb - ro) / rd, tmn = min(t0, t1), tmx = max(t0, t1);
  float tn = max(max(tmn.x, tmn.y), max(tmn.z, 0.0)), tf = min(tmx.x, min(tmx.y, tmx.z));
  vec3 pe = ro + rd * tf, fw = fwidth(pe);   // derivadas fora dos desvios
  vec3 col = vec3(0.0), glow = vec3(0.0); float tr = 1.0;
  if(tf > tn){
    float ts = tn; bool hit = false;
    for(int i = 0; i < 56; i++){ float d = sdf(ro + rd * ts); if(d < 0.004){ hit = true; break; } ts += d; if(ts > tf) break; }
    float tend = hit ? ts : tf;
    float tsl = -1.0;
    if(uSlice == 1){ float tt = (uSlicePos - ro[uSliceAxis]) / rd[uSliceAxis]; if(tt > tn && tt < tend) tsl = tt; }
    float dt = (tf - tn) / uSteps;
    float t = tn + dt * hash3(vec3(gl_FragCoord.xy, uSeed));
    for(int i = 0; i < 200; i++){
      if(t >= tend || tr < 0.01) break;
      if(tsl > 0.0 && t >= tsl){
        col += tr * ramp(fieldVal(sample3(uSnap, cellsOf(ro + rd * tsl)))) * 0.92; tr *= 0.08; tsl = -1.0;
      }
      vec3 em; float ab;
      shade(sample3(uSnap, cellsOf(ro + rd * t)), em, ab);
      col += tr * em * dt; if(uView == 0) glow += tr * em * dt;
      tr *= exp(-ab * dt);
      t += dt;
    }
    if(tsl > 0.0){ col += tr * ramp(fieldVal(sample3(uSnap, cellsOf(ro + rd * tsl)))) * 0.92; tr *= 0.08; }
    if(hit && tr > 0.01){
      vec3 p = ro + rd * ts; vec2 e = vec2(0.01, 0.0);
      vec3 n = normalize(vec3(sdf(p + e.xyy) - sdf(p - e.xyy), sdf(p + e.yxy) - sdf(p - e.yxy), sdf(p + e.yyx) - sdf(p - e.yyx)));
      float dif = max(dot(n, normalize(vec3(0.5, 0.8, 0.45))), 0.0);
      vec4 g = sample3(uSnap, cellsOf(p + n * 0.25));
      vec3 lf = uLightPos - p;
      float fl = uLight * max(dot(n, normalize(lf)), 0.0) / (1.0 + 0.25 * dot(lf, lf));
      vec3 lit = vec3(1.0, 0.55, 0.25) * g.r * 1.6 * 0.5 + vec3(0.2, 0.4, 1.0) * g.g * 0.5 + uLightCol * fl * 0.8;
      vec3 sc = uMatCol * (0.14 + 0.42 * dif + 0.2 * pow(1.0 - max(dot(n, -rd), 0.0), 2.0)) + uMatCol * lit;
      col += tr * sc * 0.9; tr = 0.0;
    }
    if(!hit){ col += tr * wall(pe, fw); }
    col += tr * uBgIn;
  }
  o = vec4(col, tr); oGlow = vec4(glow, 1.0);
}`;

  /* cor média da luz da chama: o último nível de mipmap, guardado num texel para o quadro seguinte */
  FL.FS_AVG = HEAD + `uniform sampler2D uGlow; out vec4 o; void main(){ o = vec4(textureLod(uGlow, vec2(0.5), 20.0).rgb, 1.0); }`;

  /* pós-processamento: espalha a luz da chama (níveis de mipmap da textura de brilho), comprime a faixa
     dinâmica preservando parte do matiz, soma o fundo e pontilha para não aparecerem degraus nos tons escuros */
  FL.FS_POST = HEAD + `
uniform sampler2D uScene, uGlow; uniform vec2 uRes; uniform vec3 uBg0, uBg1; uniform float uBloom;
out vec4 o;
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec4 s = texture(uScene, uv);
  vec3 g = textureLod(uGlow, uv, 1.5).rgb * 0.30 + textureLod(uGlow, uv, 3.0).rgb * 0.30
         + textureLod(uGlow, uv, 4.5).rgb * 0.25 + textureLod(uGlow, uv, 6.0).rgb * 0.15;
  vec3 c = s.rgb + g * uBloom;
  float m = max(c.r, max(c.g, c.b));
  vec3 hue = m > 1e-5 ? c * ((1.0 - exp(-1.5 * m)) / m) : vec3(0.0);
  c = mix(1.0 - exp(-1.5 * c), hue, 0.45);
  c += s.a * mix(uBg0, uBg1, uv.y);
  c += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  o = vec4(c, 1.0);
}`;
})();
