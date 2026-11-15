/* Câmera orbital, render volumétrico + partículas e gizmos de arrastar (sobreposição 2D). */
(function () {
  const FL = (window.FL = window.FL || {});
  const V = FL.V, M = FL.M;
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

  // rampas sequenciais (escuro → claro, um matiz); a legenda em CSS usa as mesmas paradas
  FL.RAMPS = {
    temp: ['#0a0a0a', '#a3200c', '#f5901e', '#fff3c4'],
    o2: ['#06121a', '#0f4c75', '#3aa0d8', '#d6f3ff'],
    soot: ['#0b0f0e', '#4a4f4c', '#9aa39e', '#f0f2f0']
  };
  FL.VIEWS = {
    flame: { id: 0, n: 'Chama' },
    temp: { id: 1, n: 'Temperatura', ramp: 'temp', lo: '300 K', hi: '3150 K' },
    o2: { id: 2, n: 'Oxigênio', ramp: 'o2', lo: 'O₂ ambiente', hi: 'O₂ esgotado' },
    soot: { id: 3, n: 'Fuligem', ramp: 'soot', lo: 'sem fuligem', hi: 'densa' }
  };

  FL.View = class {
    constructor(gl, glc, ov) {
      this.gl = gl; this.glc = glc; this.ov = ov; this.ctx = ov.getContext('2d');
      this.vol = FL.program(gl, FL.VS_QUAD, FL.FS_VOLUME, 'volume');
      this.part = FL.program(gl, FL.VS_PART, FL.FS_PARTDRAW, 'particles');
      this.post = FL.program(gl, FL.VS_QUAD, FL.FS_POST, 'post');
      this.avg = FL.program(gl, FL.VS_QUAD, FL.FS_AVG, 'avg');
      this.tAvg = FL.tex(gl, 1, 1, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.NEAREST);
      this.fAvg = FL.fbo(gl, [this.tAvg]);
      this.shift = [0, 0];                 // desloca o centro da cena na tela (fração da meia largura e meia altura)
      this.pad = 1;                        // folga extra do enquadramento (1,2 = câmera 20% mais longe)
      this.cam = { yaw: -0.62, pitch: 0.3, dist: 24 };
      // fundo: gradiente de baixo para cima e o clareado de dentro do duto (a página que embute pode trocar)
      this.bg = [[0.020, 0.045, 0.038], [0.036, 0.078, 0.064], [0.007, 0.013, 0.011]];
      this.light = 0;                      // luz da chama nas paredes, suavizada entre quadros
      this.zoomed = false;                 // o usuário aproximou ou afastou: a câmera deixa de se reenquadrar
      this.scale = 1; this.w = 1; this.h = 1;
      this.hover = null; this.drag = null; this.preview = null;
      this.onEdit = function () { };
      this.bind();
    }

    /* enquadra o duto: a distância sai do tamanho da caixa e da proporção da tela (campo de visão de 32°) */
    fit(L) { this.fitL = L.slice(); this.zoomed = false; this.refit(); }
    refit() {
      const L = this.fitL;
      if (!L || this.zoomed) return;
      const tan = Math.tan(16 * Math.PI / 180), asp = Math.max(0.3, this.w / Math.max(1, this.h));
      const hh = L[1] / 2 + 1.6, hw = Math.hypot(L[0], L[2]) / 2 + 2.6;   // folga para a seta do ar e os rótulos
      this.cam.dist = Math.max(hh / (tan * (1 - Math.abs(this.shift[1]))), hw / (tan * asp * (1 - Math.abs(this.shift[0])))) + Math.min(L[0], L[2]) / 2;
      this.cam.dist *= this.pad;
    }

    /* alvos em meia precisão: cena (cor, transmitância) e a luz da chama com mipmaps */
    target() {
      const gl = this.gl, w = this.glc.width, h = this.glc.height;
      if (this.tw === w && this.th === h) return;
      if (this.fb) { gl.deleteFramebuffer(this.fb); gl.deleteTexture(this.tScene); gl.deleteTexture(this.tGlow); }
      this.tScene = FL.tex(gl, w, h, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.LINEAR);
      this.tGlow = FL.tex(gl, w, h, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.LINEAR);
      this.fb = FL.fbo(gl, [this.tScene, this.tGlow]);
      gl.bindTexture(gl.TEXTURE_2D, this.tGlow);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      this.tw = w; this.th = h;
    }

    resize(scale) {
      if (scale) this.scale = scale;
      const r = this.ov.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
      const s = Math.min(dpr, 1) * this.scale;
      const gw = Math.max(1, Math.round(this.w * s)), gh = Math.max(1, Math.round(this.h * s));
      if (this.glc.width !== gw || this.glc.height !== gh) { this.glc.width = gw; this.glc.height = gh; }
      const ow = Math.round(this.w * dpr), oh = Math.round(this.h * dpr);
      if (this.ov.width !== ow || this.ov.height !== oh) { this.ov.width = ow; this.ov.height = oh; }
      this.dpr = dpr;
      this.refit();
    }

    update() {
      const c = this.cam;
      this.eye = [c.dist * Math.cos(c.pitch) * Math.sin(c.yaw), c.dist * Math.sin(c.pitch), c.dist * Math.cos(c.pitch) * Math.cos(c.yaw)];
      const view = M.look(this.eye, [0, 0, 0], [0, 1, 0]);
      const pr = M.persp(32 * Math.PI / 180, this.w / this.h, 0.5, 600);
      // deslocamento na tela: soma shift·w a x e y de recorte (linha 0 += sx·linha 3; linha 1 += sy·linha 3)
      for (let c = 0; c < 4; c++) { pr[c * 4] += this.shift[0] * pr[c * 4 + 3]; pr[c * 4 + 1] += this.shift[1] * pr[c * 4 + 3]; }
      this.vp = M.mul(pr, view);
      this.ivp = M.inv(this.vp);
    }
    proj(p) {
      const c = M.xf(this.vp, p);
      if (c[3] <= 0.01) return null;
      return [(c[0] / c[3] * 0.5 + 0.5) * this.w, (1 - (c[1] / c[3] * 0.5 + 0.5)) * this.h];
    }
    ray(x, y) {
      const nx = x / this.w * 2 - 1, ny = 1 - y / this.h * 2;
      const b = M.xf(this.ivp, [nx, ny, 1]);
      return { o: this.eye, d: V.norm(V.sub([b[0] / b[3], b[1] / b[3], b[2] / b[3]], this.eye)) };
    }

    render(sim, f, P) {
      const gl = this.gl;
      this.update();
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.glc.width, this.glc.height);
      gl.disable(gl.BLEND);
      const fr = sim.frames[f];
      if (!fr || f >= sim.count) { gl.clearColor(0.03, 0.06, 0.05, 1); gl.clear(gl.COLOR_BUFFER_BIT); return; }
      gl.bindVertexArray(sim.vao);
      const base = sim.base(P), vw = FL.VIEWS[P.view];
      const ramp = [].concat(...FL.RAMPS[vw.ramp || 'temp'].map(hex));
      // luz da chama: cresce com a raiz do calor liberado e fica um pouco a jusante da amostra
      const m = sim.metrics[f] || sim.latest, res = [this.glc.width, this.glc.height];
      this.light += (Math.min(1.6, Math.sqrt(Math.max(m ? m.hrr : 0, 0) / 60)) - this.light) * 0.2;
      const wv = P.sealed ? 0 : P.wind, flow = [P.wdir[0] * wv, P.wdir[1] * wv + 30 * Math.cbrt(Math.max(P.g, 0)), P.wdir[2] * wv];
      const fl = V.len(flow), lpos = V.add(P.spos, V.mul(fl > 1e-6 ? V.mul(flow, 1 / fl) : [0, 0, 0], 1 + P.size));
      this.target();
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb);
      FL.use(gl, this.vol, Object.assign({}, base, {
        uSnap: fr.snap, uInvVP: this.ivp, uCam: this.eye, uRes: res,
        uView: vw.id, uSlice: P.slice && vw.id > 0 ? 1 : 0, uSliceAxis: P.sliceAxis, uSlicePos: P.slicePos,
        uSteps: sim.q.steps, uSeed: f % 61, uO2: P.o2 / 100, uRamp: ramp, uMatCol: FL.MATS[P.mat].col,
        uLightPos: lpos, uAvg: this.tAvg, uLight: vw.id === 0 ? this.light : 0, uBgIn: this.bg[2]
      }));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindTexture(gl.TEXTURE_2D, this.tGlow);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fAvg); gl.viewport(0, 0, 1, 1);
      FL.use(gl, this.avg, { uGlow: this.tGlow }); gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, res[0], res[1]);
      FL.use(gl, this.post, { uScene: this.tScene, uGlow: this.tGlow, uRes: res, uBg0: this.bg[0], uBg1: this.bg[1], uBloom: vw.id === 0 ? 1 : 0 });
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (P.particles) {
        const n = sim.PS * sim.PS;
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
        FL.use(gl, this.part, Object.assign({}, base, {
          uCur: fr.part, uPrev: f > 0 ? sim.frames[f - 1].part : fr.part, uSnap: fr.snap,
          uVP: this.vp, uPSize: [sim.PS, sim.PS], uPoints: 0, uAlpha: 0.09
        }));
        gl.drawArrays(gl.LINES, 0, n * 2);
        FL.use(gl, this.part, { uPoints: 1, uAlpha: 0.05 });
        gl.drawArrays(gl.POINTS, 0, n);
        gl.disable(gl.BLEND);
      }
    }

    /* ---------- gizmos ---------- */
    handles(P, sim) {
      const L = this.preview || P.dims, d = P.wdir;
      // a seta do ar fica logo fora da face por onde o ar entra
      const R = (Math.abs(d[0]) * L[0] + Math.abs(d[1]) * L[1] + Math.abs(d[2]) * L[2]) / 2 + 0.3;
      const hs = [
        { id: 'igniter', p: FL.igniterPos(P, sim.h) },
        { id: 'sample', p: P.spos },
        { id: 'wind', p: V.mul(d, -(R + 2.2)), tip: V.mul(d, -R), R: R + 2.2 },
        { id: 'dim0', p: [L[0] / 2, 0, 0] }, { id: 'dim1', p: [0, L[1] / 2, 0] }, { id: 'dim2', p: [0, 0, L[2] / 2] }
      ];
      hs.forEach((h) => { h.s = this.proj(h.p); });
      return hs;
    }

    overlay(P, sim) {
      const c = this.ctx, L = this.preview || P.dims;
      this.update();
      c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      c.clearRect(0, 0, this.w, this.h);
      c.lineCap = 'round'; c.lineJoin = 'round';
      c.font = '600 12px "Red Hat Display", system-ui, sans-serif';
      const line = (a, b) => { const p = this.proj(a), q = this.proj(b); if (p && q) { c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); c.stroke(); } };
      const label = (s, txt, dx, dy, hot) => {
        if (!s) return;
        const w = c.measureText(txt).width + 12, x = s[0] + dx, y = s[1] + dy;
        c.fillStyle = hot ? '#BAE64F' : 'rgba(8,17,14,0.78)';
        c.beginPath(); c.roundRect(x - w / 2, y - 10, w, 20, 10); c.fill();
        c.fillStyle = hot ? '#12241D' : '#E9F2EC'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(txt, x, y + 0.5);
      };
      // caixa do domínio
      const hx = L[0] / 2, hy = L[1] / 2, hz = L[2] / 2;
      c.strokeStyle = this.preview ? 'rgba(186,230,79,0.9)' : 'rgba(207,224,215,0.38)'; c.lineWidth = this.preview ? 1.6 : 1;
      for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) {
        line([-hx, s1 * hy, s2 * hz], [hx, s1 * hy, s2 * hz]);
        line([s1 * hx, -hy, s2 * hz], [s1 * hx, hy, s2 * hz]);
        line([s1 * hx, s2 * hy, -hz], [s1 * hx, s2 * hy, hz]);
      }
      const hs = this.handles(P, sim), by = {};
      hs.forEach((h) => { by[h.id] = h; });
      const act = (id) => this.hover === id || (this.drag && this.drag.id === id);

      // seta do ar
      const wd = by.wind, a = wd.s, b = this.proj(wd.tip), off = P.sealed || P.wind <= 0;
      if (a && b) {
        c.strokeStyle = off ? 'rgba(207,224,215,0.45)' : '#BAE64F'; c.fillStyle = c.strokeStyle; c.lineWidth = act('wind') ? 5 : 3.5;
        c.setLineDash(off ? [6, 6] : []);
        c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); c.setLineDash([]);
        const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
        c.beginPath(); c.moveTo(b[0] + 13 * Math.cos(ang), b[1] + 13 * Math.sin(ang));
        c.lineTo(b[0] + 9 * Math.cos(ang + 2.3), b[1] + 9 * Math.sin(ang + 2.3));
        c.lineTo(b[0] + 9 * Math.cos(ang - 2.3), b[1] + 9 * Math.sin(ang - 2.3)); c.closePath(); c.fill();
        c.beginPath(); c.arc(a[0], a[1], act('wind') ? 9 : 7, 0, 6.283); c.fill();
        label(a, P.sealed ? 'câmara selada' : P.wind <= 0 ? 'ar parado' : 'ar ' + FL.fmt(P.wind, 1) + ' cm/s', 0, -22, act('wind'));
      }
      // gravidade
      const g0 = [hx + 1.4, hy * 0.6, 0], g1 = [hx + 1.4, hy * 0.6 - (0.7 + 2.2 * P.g), 0], ga = this.proj(g0), gb = this.proj(g1);
      if (ga && gb) {
        c.strokeStyle = c.fillStyle = 'rgba(233,242,236,0.8)'; c.lineWidth = 2;
        if (P.g > 0) {
          c.beginPath(); c.moveTo(ga[0], ga[1]); c.lineTo(gb[0], gb[1]); c.stroke();
          c.beginPath(); c.moveTo(gb[0], gb[1] + 9); c.lineTo(gb[0] - 5, gb[1]); c.lineTo(gb[0] + 5, gb[1]); c.closePath(); c.fill();
        } else { c.beginPath(); c.arc(ga[0], ga[1], 5, 0, 6.283); c.stroke(); }
        label(ga, P.g > 0 ? FL.fmt(P.g, 3) + ' g' : 'microgravidade', 0, -20, false);
      }
      // alças de dimensão
      ['dim0', 'dim1', 'dim2'].forEach((id, i) => {
        const s = by[id].s; if (!s) return;
        const on = act(id), r = on ? 7 : 5;
        c.fillStyle = on ? '#BAE64F' : '#E9F2EC'; c.strokeStyle = '#08110E'; c.lineWidth = 1.5;
        c.beginPath(); c.rect(s[0] - r, s[1] - r, 2 * r, 2 * r); c.fill(); c.stroke();
        label(s, FL.fmt(L[i], 1) + ' cm', 0, 20, on);
      });
      // amostra e ignitor
      const ss = by.sample.s, is = by.igniter.s;
      if (ss) {
        const on = act('sample');
        c.strokeStyle = on ? '#BAE64F' : '#E9F2EC'; c.lineWidth = 2;
        c.beginPath(); c.arc(ss[0], ss[1], on ? 9 : 7, 0, 6.283); c.stroke();
        c.beginPath(); c.moveTo(ss[0] - 3, ss[1]); c.lineTo(ss[0] + 3, ss[1]); c.moveTo(ss[0], ss[1] - 3); c.lineTo(ss[0], ss[1] + 3); c.stroke();
        if (on) label(ss, 'amostra', 0, -22, true);
      }
      if (is) {
        const on = act('igniter'), r = on ? 8 : 6;
        c.fillStyle = '#FF8A5C'; c.strokeStyle = '#08110E'; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(is[0], is[1] - r); c.lineTo(is[0] + r, is[1]); c.lineTo(is[0], is[1] + r); c.lineTo(is[0] - r, is[1]); c.closePath(); c.fill(); c.stroke();
        if (on) label(is, 'ignitor', 0, -22, true);
      }
    }

    /* ---------- interação ---------- */
    bind() {
      const ov = this.ov;
      const pos = (e) => { const r = ov.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
      const pick = (m) => {
        let best = null, bd = 17;
        for (const h of this.handles(this.P, this.sim)) {
          if (!h.s) continue;
          const d = Math.hypot(h.s[0] - m[0], h.s[1] - m[1]);
          if (d < bd) { bd = d; best = h; }
        }
        return best;
      };
      ov.addEventListener('pointerdown', (e) => {
        if (!this.sim) return;
        const m = pos(e), h = pick(m), P = this.P;
        try { ov.setPointerCapture(e.pointerId); } catch (err) { /* ponteiro sintético */ }
        ov.focus({ preventScroll: true });
        this.update();
        if (!h) { this.drag = { id: 'orbit', m }; }
        else if (h.id === 'wind') this.drag = { id: 'wind', R: h.R };
        else if (h.id.startsWith('dim')) {
          const i = +h.id[3], ax = [0, 0, 0]; ax[i] = 1;
          const s1 = this.proj(V.add(h.p, ax));
          this.drag = { id: h.id, i, m, L0: P.dims[i], s: s1 ? [s1[0] - h.s[0], s1[1] - h.s[1]] : [1, 0] };
          this.preview = P.dims.slice();
        } else {
          const n = V.norm(V.mul(this.eye, -1)), r = this.ray(m[0], m[1]);
          const t = V.dot(V.sub(h.p, r.o), n) / V.dot(r.d, n);
          this.drag = { id: h.id, n, p0: h.p.slice(), grab: V.sub(h.p, V.add(r.o, V.mul(r.d, t))) };
        }
        ov.style.cursor = 'grabbing';
        e.preventDefault();
      });
      ov.addEventListener('pointermove', (e) => {
        if (!this.sim) return;
        const m = pos(e), d = this.drag, P = this.P;
        if (!d) {
          const h = pick(m), id = h ? h.id : null;
          if (id !== this.hover) { this.hover = id; ov.style.cursor = id ? 'grab' : 'default'; this.onEdit('hover'); }
          return;
        }
        if (d.id === 'orbit') {
          this.cam.yaw -= (m[0] - d.m[0]) * 0.008;
          this.cam.pitch = Math.max(-1.45, Math.min(1.45, this.cam.pitch + (m[1] - d.m[1]) * 0.008));
          d.m = m; this.onEdit('camera');
        } else if (d.id === 'wind') {
          const r = this.ray(m[0], m[1]);
          const tc = -V.dot(r.o, r.d), cp = V.add(r.o, V.mul(r.d, tc)), dist = V.len(cp);
          let hit = dist >= d.R ? V.mul(V.norm(cp), d.R) : V.add(r.o, V.mul(r.d, tc - Math.sqrt(d.R * d.R - dist * dist)));
          let dir = V.norm(V.mul(hit, -1));
          for (let i = 0; i < 3; i++) if (Math.abs(dir[i]) > 0.975) { const s = Math.sign(dir[i]); dir = [0, 0, 0]; dir[i] = s; }
          P.wdir = dir; this.onEdit('wind');
        } else if (d.id.startsWith('dim')) {
          const k = ((m[0] - d.m[0]) * d.s[0] + (m[1] - d.m[1]) * d.s[1]) / (d.s[0] * d.s[0] + d.s[1] * d.s[1] || 1);
          this.preview[d.i] = Math.max(3, Math.min(30, Math.round((d.L0 + 2 * k) * 2) / 2));
          this.onEdit('hover');
        } else {
          const r = this.ray(m[0], m[1]);
          const t = V.dot(V.sub(d.p0, r.o), d.n) / V.dot(r.d, d.n);
          const p = V.add(V.add(r.o, V.mul(r.d, t)), d.grab);
          if (d.id === 'sample') { P.spos = p; FL.clampSample(P, this.sim.h); }
          else {
            const lim = P.dims.map((l) => l / 2 - 0.3);
            P.igoff = V.sub(p.map((v, i) => Math.max(-lim[i], Math.min(lim[i], v))), P.spos);
          }
          this.onEdit(d.id);
        }
      });
      const end = (e) => {
        const d = this.drag;
        if (!d) return;
        this.drag = null; ov.style.cursor = this.hover ? 'grab' : 'default';
        if (d.id.startsWith('dim')) { const L = this.preview; this.preview = null; this.onEdit('dims', L); }
        else this.onEdit(d.id === 'orbit' ? 'camera' : d.id, true);
      };
      ov.addEventListener('pointerup', end);
      ov.addEventListener('pointercancel', end);
      // a rolagem só aproxima depois de um clique na cena; fora disso, rola a página
      ov.addEventListener('wheel', (e) => {
        if (document.activeElement !== ov) return;
        e.preventDefault();
        this.cam.dist = Math.max(4, Math.min(160, this.cam.dist * Math.exp(e.deltaY * 0.0012))); this.zoomed = true;
        this.onEdit('camera');
      }, { passive: false });
      ov.addEventListener('keydown', (e) => {
        const k = e.key, c = this.cam;
        if (k === 'ArrowLeft') c.yaw -= 0.1; else if (k === 'ArrowRight') c.yaw += 0.1;
        else if (k === 'ArrowUp') c.pitch = Math.min(1.45, c.pitch + 0.08); else if (k === 'ArrowDown') c.pitch = Math.max(-1.45, c.pitch - 0.08);
        else if (k === '+' || k === '=') { c.dist = Math.max(4, c.dist * 0.9); this.zoomed = true; } else if (k === '-') { c.dist = Math.min(160, c.dist * 1.1); this.zoomed = true; }
        else return;
        e.preventDefault(); e.stopPropagation(); this.onEdit('camera');
      });
    }
  };
})();
