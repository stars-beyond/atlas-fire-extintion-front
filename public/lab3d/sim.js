/* Solver 3D na GPU: fluido incompressível + combustão de um passo.
   Por subpasso: advecção MacCormack (2ª ordem) · difusão conservativa em RKL2 · reação integrada em
   subpassos · pressão por multigrid · projeção. Estado em ponto flutuante de 32 bits.
   Cada quadro simulado é gravado na linha do tempo (campos em 8 bits + partículas),
   então o que se vê na tela é sempre um quadro gravado. */
(function () {
  const FL = (window.FL = window.FL || {});

  // coeficientes [μ, ν, μ̃, γ̃] do Runge-Kutta-Legendre de 2ª ordem com s estágios (Meyer, Balsara e Aslam 2014)
  const RKL = {};
  function rkl(s) {
    if (RKL[s]) return RKL[s];
    const b = [1 / 3, 1 / 3, 1 / 3];
    for (let j = 3; j <= s; j++) b[j] = (j * j + j - 2) / (2 * j * (j + 1));
    const w1 = 4 / (s * s + s - 2), c = [null, [0, 0, b[1] * w1, 0]];
    for (let j = 2; j <= s; j++) {
      const mu = (2 * j - 1) / j * b[j] / b[j - 1], nu = -(j - 1) / j * b[j] / b[j - 2], mt = mu * w1;
      c[j] = [mu, nu, mt, -(1 - b[j - 1]) * mt];
    }
    return (RKL[s] = c);
  }
  FL.rkl = rkl;
  // pesos de Jacobi para n passadas: raízes do polinômio de Chebyshev no intervalo [1/3, 2] de D⁻¹A,
  // que é onde estão os modos que a grade mais grossa não enxerga (n = 1 dá o clássico 6/7).
  // No nível mais grosso o intervalo desce até 0,04 para resolver também os modos longos.
  const CHEB = {};
  function cheb(n, a) {
    a = a || 1 / 3;
    const key = n + ':' + a;
    if (CHEB[key]) return CHEB[key];
    const b = 2, w = [];
    for (let k = 0; k < n; k++) w.push(1 / ((a + b) / 2 - (b - a) / 2 * Math.cos(Math.PI * (2 * k + 1) / (2 * n))));
    return (CHEB[key] = w);
  }
  const SMAX = 32;   // teto de estágios; acima disso a difusividade é reduzida para o passo continuar estável
  // ladrilhos do atlas 2D para uma grade n (uma fatia z por ladrilho)
  function atlas(n, maxTex) {
    let tx = Math.max(1, Math.round(Math.sqrt(n[2] * n[1] / n[0])));
    while (tx * n[0] > maxTex) tx--;
    return [tx, Math.ceil(n[2] / tx)];
  }

  FL.Sim = class {
    constructor(gl, P, qualityKey) {
      this.gl = gl;
      const q = (this.q = FL.QUALITY[qualityKey]);
      this.qualityKey = qualityKey;
      const L = (this.L = P.dims.slice());
      const h0 = Math.cbrt(L[0] * L[1] * L[2] / q.cells);
      const N = (this.N = L.map((l) => Math.max(10, Math.round(l / h0))));
      this.hv = [L[0] / N[0], L[1] / N[1], L[2] / N[2]];
      this.h = (this.hv[0] + this.hv[1] + this.hv[2]) / 3;
      this.cells = N[0] * N[1] * N[2];
      this.w = this.hv.map((v) => 1 / (v * v));   // pesos do laplaciano por eixo
      const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      this.tiles = atlas(N, maxTex);
      const tx = this.tiles[0], ty = this.tiles[1];
      this.W = N[0] * tx; this.H = N[1] * ty;
      this.PS = q.part;
      this.dur = P.dur;
      this.dtFrame = FL.PHYS.DT * P.dur;
      this.pace(P);
      this.frameBytes = this.W * this.H * 4 + this.PS * this.PS * 16;
      this.cap = Math.max(40, Math.min(FL.PHYS.MAX_FRAMES, Math.floor(FL.PHYS.MEM_MB * 1048576 / this.frameBytes)));

      const T = (int, fmt, type) => FL.tex(gl, this.W, this.H, int, fmt, type, gl.NEAREST);
      const hf = FL.PHYS.FP === 16;   // 16: meia precisão no estado (mais leve, mas perde processos lentos)
      const V4 = () => (hf ? T(gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT) : T(gl.RGBA32F, gl.RGBA, gl.FLOAT)), R1 = () => T(gl.R32F, gl.RED, gl.FLOAT);
      // estado: vel[0] e sc. Y0 = campo advectado; L = Δt·L(Y0); st = três pares que giram entre os estágios
      this.vel = [V4(), V4()]; this.sc = V4(); this.scB = V4();
      this.Ls = V4();
      this.st = [0, 1, 2].map(() => ({ v: V4(), s: V4() }));
      this.st.forEach((p) => { p.f = FL.fbo(gl, [p.v, p.s]); p.fs = FL.fbo(gl, [p.s]); });
      this.aux = V4();
      this.p = [R1(), R1()];
      this.div = R1();
      this.red = FL.tex(gl, tx, ty, gl.RGBA32F, gl.RGBA, gl.FLOAT, gl.NEAREST);
      this.fInit = FL.fbo(gl, [this.vel[0], this.sc]);
      this.fAdv = FL.fbo(gl, [this.vel[1], this.scB]);
      this.fRk1 = FL.fbo(gl, [this.st[0].v, this.st[0].s, this.Ls]);
      this.fReact = FL.fbo(gl, [this.sc, this.aux, this.div]);
      this.fP = [FL.fbo(gl, [this.p[0]]), FL.fbo(gl, [this.p[1]])];
      this.fProj = FL.fbo(gl, [this.vel[0]]);
      this.fRed = FL.fbo(gl, [this.red]);
      this.fFrame = gl.createFramebuffer();

      // níveis grossos do multigrid: agregados 2×2×2 das células interiores, até a grade caber em 6 células
      this.mg = [];
      let nl = N.map((v) => v - 2);
      while (this.mg.length < 6 && Math.max(...nl) > 6) {
        nl = nl.map((v) => Math.ceil(v / 2));
        const t = atlas(nl, maxTex), w = nl[0] * t[0], h = nl[1] * t[1];
        const R = () => FL.tex(gl, w, h, gl.R32F, gl.RED, gl.FLOAT, gl.NEAREST);
        // agregados: full células finas por eixo, menos o último (last). σ e λ: posição do último centro e da face de saída
        const full = Math.pow(2, this.mg.length + 1), last = nl.map((v, a) => N[a] - 2 - full * (v - 1));
        const lv = { full, last, sg: last.map((v) => (full + v) / (2 * full)), lam: last.map((v) => v / (2 * full)), n: nl, tiles: t, w, h, e: [R(), R()], b: R(), K: FL.tex(gl, w, h, gl.RGBA32F, gl.RGBA, gl.FLOAT, gl.NEAREST), c: 0 };
        lv.fe = lv.e.map((e) => FL.fbo(gl, [e])); lv.fb = FL.fbo(gl, [lv.b]); lv.fK = FL.fbo(gl, [lv.K]);
        this.mg.push(lv);
      }

      const mk = (fs, name) => FL.program(gl, FL.VS_QUAD, fs, name);
      this.pr = {
        init: mk(FL.FS_INIT, 'init'), adv: mk(FL.FS_ADV, 'advect'), adv3: mk(FL.FS_ADV3, 'correct'),
        rk1: mk(FL.FS_RKL1, 'rkl1'), rkv: mk(FL.FS_RKLV, 'rkl2'), rk: mk(FL.FS_RKL, 'rkl'), react: mk(FL.FS_REACT, 'react'),
        sm0: mk(FL.FS_MG_SM0, 'mg-smooth0'), rs0: mk(FL.FS_MG_RS0, 'mg-restrict0'), pr0: mk(FL.FS_MG_PR0, 'mg-prolong0'),
        k1: mk(FL.FS_MG_K1, 'mg-coef1'), kL: mk(FL.FS_MG_KL, 'mg-coef'), smL: mk(FL.FS_MG_SML, 'mg-smooth'),
        rsL: mk(FL.FS_MG_RSL, 'mg-restrict'), prL: mk(FL.FS_MG_PRL, 'mg-prolong'),
        proj: mk(FL.FS_PROJECT, 'project'), snap: mk(FL.FS_SNAP, 'snap'), red: mk(FL.FS_REDUCE, 'reduce'),
        part: mk(FL.FS_PART, 'part')
      };
      this.vao = gl.createVertexArray();

      // semente das partículas: posição aleatória no domínio, idade aleatória
      const n = this.PS * this.PS, seed = new Float32Array(n * 4);
      let s = 12345;
      const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
      for (let i = 0; i < n; i++) {
        seed[i * 4] = (rnd() - 0.5) * L[0] * 0.98; seed[i * 4 + 1] = (rnd() - 0.5) * L[1] * 0.98;
        seed[i * 4 + 2] = (rnd() - 0.5) * L[2] * 0.98; seed[i * 4 + 3] = rnd() * 3;
      }
      this.partSeed = FL.tex(gl, this.PS, this.PS, gl.RGBA32F, gl.RGBA, gl.FLOAT, gl.NEAREST, seed);

      this.frames = [];      // {snap, part}
      this.count = 0;
      this.metrics = [];     // por quadro: {hrr, tk, o2, vol}
      this.pending = [];
      this.ign = [];         // janelas de ignição [t0, t1]
      this.marks = [];       // {f, label}
      this.time = 0;
    }

    /* Passo interno: STRIDE × DT enquanto o ar andar no máximo CFL células por passo; senão DT.
       A velocidade vem só dos parâmetros (vento e subida por empuxo, U_b = 30·g^(1/3) cm/s), então a
       mesma entrada dá sempre o mesmo passo. O quadro continua valendo DT × P.dur. */
    pace(P) {
      const C = FL.PHYS;
      const u = Math.hypot(P.sealed ? 0 : P.wind, 30 * Math.cbrt(Math.max(P.g, 0)));
      const ok = this.dur % C.STRIDE === 0 && u * C.DT * C.STRIDE / Math.min(...this.hv) <= C.CFL;
      this.stride = ok ? C.STRIDE : 1;
      this.substeps = this.dur / this.stride;
      this.dt = this.dtFrame / this.substeps;
      this.stride = this.dt / C.DT;
    }

    /* uniformes compartilhados (grade, amostra, contorno) */
    base(P) {
      const e = FL.sampleDim(P, this.h);
      // escoamento imposto: o ar forçado (this.wf), já aplicado ao campo inteiro
      const w = P.sealed || !this.wf ? [0, 0, 0] : this.wf;
      // pressão: entrada de ar e parede não trocam (1); saída fica em p = 0 (0)
      return {
        uN: this.N, uTiles: this.tiles, uL: this.L,
        uShape: FL.shapeId(P.shape), uSPos: P.spos, uSDim: e,
        uSealed: P.sealed ? 1 : 0, uWind: w,
        uW: this.w, uNeuLo: w.map((v) => (P.sealed || v > 1e-3 ? 1 : 0)), uNeuHi: w.map((v) => (P.sealed || v < -1e-3 ? 1 : 0))
      };
    }

    derive(P) {
      const C = FL.PHYS, m = FL.MATS[P.mat], dil = FL.DILS[P.dil];
      // atmosfera: O2, gás de balanço e supressor descarregado (fração ag do total)
      const ag = this.agent || 0, sup = FL.DILS[(P.sup && P.sup.agent) || 'CO2'];
      const x0 = P.o2 / 100, pf = P.press / 14.7;
      const x = x0 * (1 - ag), fb = (1 - x0) * (1 - ag);
      const cpAir = 0.21 * 1.05 + 0.79, cp = x * 1.05 + fb * dil.cp + ag * sup.cp;
      const dmix = 1 + (dil.d - 1) * fb + (sup.d - 1) * ag;
      const rmix = 1 + (dil.rad - 1) * fb + (sup.rad - 1) * ag;
      const t = this.time;
      // difusão: número de estágios do RKL2 para o passo Δt ficar dentro do limite de estabilidade,
      // com o maior coeficiente possível (O2 em gás a θ = 1,5) e 10% de folga
      let Dk = C.D0 * dmix / pf;
      const sw = this.w[0] + this.w[1] + this.w[2], gmax = 2.1 * 1.05;
      const need = (D) => 1.1 * 2 * this.dt * D * gmax * sw;   // Δt / Δt de Euler explícito
      let s = 2;
      while ((s * s + s - 2) / 4 < need(Dk) && s < SMAX) s++;
      this.diffClamp = Math.min(1, (s * s + s - 2) / 4 / need(Dk));
      Dk *= this.diffClamp;
      this.stages = s;
      return {
        uDk: [Dk, 0.7 * Dk, 1.05 * Dk, 0.05 * Dk], uPr: C.PR, uMac: C.MAC, uMacD: 1.01 * Math.max(...this.hv), uRsub: (this.rsub = Math.max(1, Math.min(8, Math.round(C.RSUB * this.stride)))), uDragE: this.dt / 0.006,
        uFD: this.uD || [0, 0, 0],
        uFlood: this.flood || 0,
        uDt: this.dt, uO2: x, uInvH: this.hv.map((v) => 1 / v),
        uNear: 1.8 * Math.max(...this.hv), uShell: 1.7 * Math.max(...this.hv),
        uBuoy: C.BETA * P.g,
        uK: C.K0 * (C.HREF / this.h) * pf * m.inhib, uTa: C.TA, uStoich: m.s,
        uQ: (m.s / 0.21) * (cpAir / cp),
        uRad: C.RAD * rmix,
        uPyrT: (m.pyrK - 300) / 1900, uPyrM: m.M * 2 * (C.HREF / this.h), uPyrL: m.L, uSootF: 6 * m.soot,
        uIgPos: FL.igniterPos(P, this.h), uIgR: Math.max(0.35, 2.2 * this.h),
        uIgOn: this.ign.some((w) => t >= w[0] && t < w[1]) ? 1 : 0,
        uExp: P.sealed ? 0 : C.EXP, uBlow: P.sealed ? 0 : C.BLOW
      };
    }

    draw(fbo, w, h) {
      const gl = this.gl;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.viewport(0, 0, w || this.W, h || this.H);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    reset(P) {
      const gl = this.gl;
      for (const pd of this.pending) { gl.deleteSync(pd.sync); gl.deleteBuffer(pd.pbo); }
      this.pending = []; this.metrics = []; this.marks = [];
      this.count = 0; this.time = 0;
      this.agent = 0; this.flood = 0; this.agentLog = [];
      this.carry = false; this.latest = null;
      this.ign = P.igdur > 0 ? [[0, P.igdur]] : [];
      // escoamento imposto no campo: começa estabelecido no ar forçado
      this.wf = P.sealed ? [0, 0, 0] : FL.V.mul(P.wdir, P.wind); this.uD = [0, 0, 0];
      gl.disable(gl.BLEND);
      gl.bindVertexArray(this.vao);
      this.geo = null;
      gl.clearColor(0, 0, 0, 0);
      for (const f of [this.fP[0], this.fP[1], this.fReact, this.fAdv]) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, f);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
      FL.use(gl, this.pr.init, Object.assign(this.base(P), { uO2: P.o2 / 100 }));
      this.draw(this.fInit);
    }

    ignite(P) {
      this.ign.push([this.time, this.time + Math.max(P.igdur, 0.4)]);
      this.mark('ignição');
    }
    mark(label) {
      const m = this.marks[this.marks.length - 1];
      if (m && m.f === this.count) { if (m.label.indexOf(label) < 0) m.label += ', ' + label; return; }
      this.marks.push({ f: this.count, label });
    }
    igniting(f) {
      const t = f * this.dtFrame;
      return this.ign.some((w) => t + this.dtFrame > w[0] && t < w[1]);
    }

    substep(P) {
      // descarga de supressor: a fração na atmosfera tende ao alvo com constante de tempo SUP_TAU;
      // ao desligar, o ar fresco só volta se houver troca de ar (câmara não selada)
      const S = P.sup || { on: false, frac: 0 };
      let dd = ((S.on ? S.frac : 0) - this.agent) * (1 - Math.exp(-this.dt / FL.SUP_TAU));
      if (dd < 0 && P.sealed) dd = 0;
      this.flood = dd > 0 ? dd / ((1 - this.agent) * this.dt) : 0;
      this.agent += dd;
      this.force(P);
      const gl = this.gl, pr = this.pr, st = this.st, BD = Object.assign(this.base(P), this.derive(P));
      const U = (prog, extra) => { FL.use(gl, prog, BD); FL.use(gl, prog, extra); };
      const V0 = this.vel[0], S0 = this.sc, VA = this.vel[1], SA = this.scB;
      // advecção: previsão, viagem de volta, correção limitada (+ empuxo, arrasto e contorno)
      U(pr.adv, { uVtr: V0, uVel: V0, uSc: S0, uDir: 1 }); this.draw(st[0].f);
      U(pr.adv, { uVtr: V0, uVel: st[0].v, uSc: st[0].s, uDir: -1 }); this.draw(st[1].f);
      U(pr.adv3, { uVel: V0, uSc: S0, uVelH: st[0].v, uScH: st[0].s, uVelB: st[1].v, uScB: st[1].s }); this.draw(this.fAdv);
      // difusão: escalares em RKL2 com this.stages estágios; a viscosidade vai nos dois primeiros
      const k = rkl(this.stages), Ls = this.Ls;
      U(pr.rk1, { uYv: VA, uYs: SA, uCo: k[1] }); this.draw(this.fRk1);
      U(pr.rkv, { uYv: st[0].v, uYs: st[0].s, uPs: SA, u0v: VA, u0s: SA, uLs: Ls, uCo: k[2] }); this.draw(st[1].f);
      const VD = st[1].v;   // velocidade difundida
      let j1 = 1, j2 = 0;
      FL.use(gl, pr.rk, BD);
      for (let j = 3; j <= this.stages; j++) {
        const o = (j1 + 1) % 3;
        FL.use(gl, pr.rk, { uYs: st[j1].s, uPs: st[j2].s, u0s: SA, uLs: Ls, uCo: k[j] });
        this.draw(st[o].fs);
        j2 = j1; j1 = o;
      }
      // reação (também devolve a divergência com as fontes de volume)
      U(pr.react, { uX: st[j1].s, uX0: SA, uVel: VD }); this.draw(this.fReact);
      // pressão e projeção
      const geo = [P.shape, P.spos, BD.uSDim, BD.uNeuLo, BD.uNeuHi].join();
      this.neu = [BD.uNeuLo, BD.uNeuHi];
      for (const g of [pr.sm0, pr.rs0, pr.pr0, pr.k1]) FL.use(gl, g, BD);
      if (geo !== this.geo) { this.geo = geo; this.coefs(); }
      for (let i = 0; i < this.q.vc; i++) this.vcycle();
      U(pr.proj, { uVel: VD, uP: this.p[0] }); this.draw(this.fProj);
      this.time += this.dt;
    }

    /* Escoamento imposto. O ar forçado é um movimento de conjunto do gás: quando o ventilador muda, o campo
       inteiro acompanha (em escoamento incompressível a pressão transmite isso na hora). Impor a velocidade só
       na face de entrada não serve: as outras faces são abertas e a variação escapa pelos lados antes de chegar
       à amostra. Aqui sai o incremento deste passo (this.uD), somado a todas as células de gás na advecção.
       O ar forçado segue o ventilador com constante de tempo WIND_TAU. */
    force(P) {
      const C = FL.PHYS, V = FL.V;
      const wt = P.sealed ? [0, 0, 0] : V.mul(P.wdir, P.wind);
      const k = 1 - Math.exp(-this.dt / C.WIND_TAU), d = V.sub(wt, this.wf);
      const wn = V.len(d) < 0.02 ? wt : V.add(this.wf, V.mul(d, k));
      this.uD = V.sub(wn, this.wf);
      this.wf = wn;
    }

    /* coeficientes de face dos níveis grossos; refeitos só quando a geometria ou o contorno mudam */
    coefs() {
      const gl = this.gl, pr = this.pr, M = this.mg;
      FL.use(gl, pr.k1, { uNc: M[0].n, uTc: M[0].tiles }); this.draw(M[0].fK, M[0].w, M[0].h);
      for (let l = 0; l < M.length - 1; l++) {
        FL.use(gl, pr.kL, { uK: M[l].K, uNl: M[l].n, uTl: M[l].tiles, uNc: M[l + 1].n, uTc: M[l + 1].tiles });
        this.draw(M[l + 1].fK, M[l + 1].w, M[l + 1].h);
      }
    }

    /* um ciclo V sobre a pressão, partindo do valor do subpasso anterior (this.p[0]) */
    vcycle() {
      const gl = this.gl, pr = this.pr, M = this.mg, C = FL.PHYS.MG, last = M.length - 1;
      const dir = { uDirLo: this.neu[0].map((v) => 1 - v), uDirHi: this.neu[1].map((v) => 1 - v) };
      const lvU = (lv) => ({ uFull: lv.full, uLast: lv.last, uWl: this.w });
      const cU = (c) => ({ uNc: c.n, uTc: c.tiles, uSg: c.sg, uLam: c.lam });
      let pc = 0;
      const sm0 = (n) => {
        const om = cheb(n);
        FL.use(gl, pr.sm0, { uDiv: this.div });
        for (let i = 0; i < n; i++) { FL.use(gl, pr.sm0, { uP: this.p[pc], uOmega: om[i] }); this.draw(this.fP[1 - pc]); pc = 1 - pc; }
      };
      const smL = (lv, n, zero, lo) => {
        const om = cheb(n, lo);
        FL.use(gl, pr.smL, Object.assign({ uB: lv.b, uK: lv.K, uNl: lv.n, uTl: lv.tiles }, lvU(lv), dir));
        for (let i = 0; i < n; i++) {
          FL.use(gl, pr.smL, { uE: lv.e[lv.c], uZero: zero && i === 0 ? 1 : 0, uOmega: om[i] });
          this.draw(lv.fe[1 - lv.c], lv.w, lv.h); lv.c = 1 - lv.c;
        }
      };
      sm0(C.nu);
      FL.use(gl, pr.rs0, { uP: this.p[pc], uDiv: this.div, uNc: M[0].n, uTc: M[0].tiles }); this.draw(M[0].fb, M[0].w, M[0].h);
      for (let l = 0; l < last; l++) {
        const a = M[l], c = M[l + 1];
        smL(a, C.nuL, true);
        FL.use(gl, pr.rsL, Object.assign({ uE: a.e[a.c], uB: a.b, uK: a.K, uNl: a.n, uTl: a.tiles, uNc: c.n, uTc: c.tiles }, lvU(a), dir));
        this.draw(c.fb, c.w, c.h);
      }
      smL(M[last], C.nuC, true, 0.04);
      for (let l = last - 1; l >= 0; l--) {
        const a = M[l], c = M[l + 1];
        FL.use(gl, pr.prL, Object.assign({ uE: a.e[a.c], uEc: c.e[c.c], uNl: a.n, uTl: a.tiles, uHalf: a.lam }, cU(c), dir));
        this.draw(a.fe[1 - a.c], a.w, a.h); a.c = 1 - a.c;
        smL(a, C.nuL, false);
      }
      FL.use(gl, pr.pr0, Object.assign({ uP: this.p[pc], uEc: M[0].e[M[0].c] }, cU(M[0]), dir)); this.draw(this.fP[1 - pc]); pc = 1 - pc;
      sm0(C.nu);
      if (pc === 1) { const t = this.p[0]; this.p[0] = this.p[1]; this.p[1] = t; const f = this.fP[0]; this.fP[0] = this.fP[1]; this.fP[1] = f; }
    }

    /* simula um quadro e grava na linha do tempo; devolve false se ela está cheia */
    stepFrame(P) {
      if (this.count >= this.cap) return false;
      const gl = this.gl;
      gl.disable(gl.BLEND);
      gl.bindVertexArray(this.vao);
      this.pace(P);
      for (let i = 0; i < this.substeps; i++) this.substep(P);
      const f = this.count;
      let fr = this.frames[f];
      if (!fr) {
        fr = this.frames[f] = {
          snap: FL.tex(gl, this.W, this.H, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR),
          part: FL.tex(gl, this.PS, this.PS, gl.RGBA32F, gl.RGBA, gl.FLOAT, gl.NEAREST)
        };
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fFrame);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fr.snap, 0);
      FL.use(gl, this.pr.snap, { uSc: this.sc, uAux: this.aux });
      this.draw(this.fFrame);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fr.part, 0);
      FL.use(gl, this.pr.part, Object.assign(this.base(P), {
        uPart: f > 0 ? this.frames[f - 1].part : (this.carry ? this.partCarry : this.partSeed), uVel: this.vel[0], uDtF: this.dtFrame, uSeed: (f % 997) + 1
      }));
      this.draw(this.fFrame, this.PS, this.PS);
      this.kickMetrics(f, P);
      this.agentLog[f] = this.agent;
      this.count++;
      return true;
    }

    /* modo contínuo (sem linha do tempo): volta ao quadro 0 e segue a simulação do ponto em que está.
       As partículas do último quadro viram a semente do próximo ciclo. */
    wrap() {
      if (!this.count) return;
      const gl = this.gl, last = this.frames[this.count - 1];
      if (!this.partCarry) this.partCarry = FL.tex(gl, this.PS, this.PS, gl.RGBA32F, gl.RGBA, gl.FLOAT, gl.NEAREST);
      const t = last.part; last.part = this.partCarry; this.partCarry = t;
      this.carry = true; this.count = 0; this.marks = [];
    }

    kickMetrics(f, P) {
      const gl = this.gl, n = this.tiles[0] * this.tiles[1];
      FL.use(gl, this.pr.red, { uN: this.N, uTiles: this.tiles, uSc: this.sc, uAux: this.aux });
      this.draw(this.fRed, this.tiles[0], this.tiles[1]);
      const pbo = gl.createBuffer();
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbo);
      gl.bufferData(gl.PIXEL_PACK_BUFFER, n * 16, gl.STREAM_READ);
      gl.readPixels(0, 0, this.tiles[0], this.tiles[1], gl.RGBA, gl.FLOAT, 0);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const vc = this.hv[0] * this.hv[1] * this.hv[2];
      this.pending.push({ f, t: this.time, pbo, sync, n, k: vc * (P.press / 14.7) * FL.PHYS.HC_O2 * FL.MATS[P.mat].s * 1000, vc });
    }

    /* recolhe leituras assíncronas já concluídas; devolve true se chegou algo novo */
    poll() {
      const gl = this.gl;
      let got = false;
      while (this.pending.length) {
        const pd = this.pending[0];
        const st = gl.clientWaitSync(pd.sync, 0, 0);
        if (st === gl.TIMEOUT_EXPIRED) break;
        this.pending.shift();
        if (st !== gl.WAIT_FAILED) {
          const a = new Float32Array(pd.n * 4);
          gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pd.pbo);
          gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, a);
          gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
          let w = 0, tm = 0, o = 0, c = 0;
          for (let i = 0; i < pd.n; i++) { w += a[i * 4]; tm = Math.max(tm, a[i * 4 + 1]); o += a[i * 4 + 2]; c += a[i * 4 + 3]; }
          this.latest = this.metrics[pd.f] = { t: pd.t, hrr: w * pd.k, tk: 300 + 1900 * tm, o2: 100 * o / ((this.N[0] - 2) * (this.N[1] - 2) * (this.N[2] - 2)), vol: c * pd.vc };
          got = true;
        }
        gl.deleteSync(pd.sync); gl.deleteBuffer(pd.pbo);
      }
      return got;
    }

    dispose() {
      const gl = this.gl;
      for (const pd of this.pending) { gl.deleteSync(pd.sync); gl.deleteBuffer(pd.pbo); }
      [...this.vel, this.sc, this.scB, this.Ls, this.aux, ...this.p, this.div, this.red, this.partSeed].forEach((t) => gl.deleteTexture(t));
      this.st.forEach((p) => { gl.deleteTexture(p.v); gl.deleteTexture(p.s); gl.deleteFramebuffer(p.f); gl.deleteFramebuffer(p.fs); });
      this.mg.forEach((lv) => { [...lv.e, lv.b, lv.K].forEach((t) => gl.deleteTexture(t)); [...lv.fe, lv.fb, lv.fK].forEach((f) => gl.deleteFramebuffer(f)); });
      this.frames.forEach((fr) => { gl.deleteTexture(fr.snap); gl.deleteTexture(fr.part); });
      [this.fInit, this.fAdv, this.fRk1, this.fReact, ...this.fP, this.fProj, this.fRed, this.fFrame].forEach((f) => gl.deleteFramebuffer(f));
      Object.values(this.pr).forEach((p) => gl.deleteProgram(p.p));
      if (this.partCarry) gl.deleteTexture(this.partCarry);
      gl.deleteVertexArray(this.vao);
    }
  };
})();
