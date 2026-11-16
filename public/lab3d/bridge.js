/* Ponte entre o Atlas e o Laboratório de chama 3D (lab3d).
   Esta página roda dentro de um iframe no palco. O Atlas manda o cenário por postMessage
   (atmosfera, gravidade, material, supressor, ventilação) e recebe de volta o estado da chama.
   O laço e o ajuste automático de resolução seguem o compact.js do lab3d.
   Materiais, gases e constantes físicas vêm da API do Atlas (/api/sim/config, formato lab3d.config/1).
   Quem busca é o Atlas (a página de fora), com o cliente da API dele, e entrega aqui por postMessage: em produção
   a API fica em outra origem, e FL.ready (model.js) só aceita endereço de configuração da mesma origem desta
   página. Essa trava continua valendo; o que mudou foi só o caminho por onde a configuração chega.
   Se ela não chegar a tempo ou vier inválida, vale o padrão embutido em model.js, e o Atlas fica sabendo pela
   mensagem de pronto (de onde veio a configuração em uso e o que a validação recusou).
   Com ?embed=1 a página vira uma camada da cena 3D do habitat: fundo preto (o Atlas a compõe por cima da cena
   somando a luz), sem a caixa do duto nem a seta do ar, e com a câmera que o Atlas mandar (window.atlasCam),
   em centímetros a partir do centro do duto. Assim a chama simulada aparece dentro da câmara de teste da cena.
   Every text this page sends to the Atlas (error messages, the label of the last action, configuration problems)
   is shown on screen there, so it is written in English. */

/* ---------- de onde vem a configuração ----------
   Dentro do Atlas:   esta página pede      { type: 'atlas:config-request' }   (repete até ser atendida)
                      o Atlas responde      { type: 'atlas:config', config: {...} | null, error?: '...' }
                      FL.configure confere campo a campo e aplica; só então a simulação é construída.
   Sem resposta em WAIT_MS, com config nula ou recusada: segue com a configuração embutida.
   Aberta sozinha (fora de um iframe) ou com ?config=: o caminho antigo, FL.ready, só com endereço da mesma origem.
   fn recebe { from, reason }: from = 'api' (entregue pelo Atlas), 'embedded' (padrão de model.js) ou 'url'
   (lida pela própria página); reason = por que ficou a embutida ('timeout', 'unavailable', 'invalid') ou null. */
(function () {
  const FL = window.FL, ORIGIN = location.origin;
  const WAIT_MS = 5000;   // quanto esperar pela configuração do Atlas antes de seguir com a embutida
  const ASK_MS = 300;     // o pedido é repetido: o Atlas pode ainda não estar ouvindo quando esta página carrega
  const short = (list) => (Array.isArray(list) ? list : []).slice(0, 40).map((m) => String(m).slice(0, 300));
  FL.fromAtlas = function (fn) {
    let qs = null;
    try { qs = new URLSearchParams(location.search); } catch (e) { /* sem location */ }
    const framed = !!window.parent && window.parent !== window;
    if (!framed || (qs && qs.get('config'))) {
      const def = ((qs && qs.get('api')) || '/api').replace(/\/+$/, '') + '/sim/config';
      FL.ready(function () { fn({ from: FL.CONFIG.source === 'embutido' ? 'embedded' : 'url', reason: null }); }, def);
      return;
    }
    let done = false, timer = 0, asker = 0;
    const finish = (from, reason) => {
      if (done) return;
      done = true; clearTimeout(timer); clearInterval(asker); window.removeEventListener('message', onConfig);
      fn({ from: from, reason: reason });
    };
    const embedded = (reason, problems) => {
      if (done) return;
      FL.CONFIG = { source: 'embutido', problems: short(problems) };
      finish('embedded', reason);
    };
    function onConfig(e) {
      if (e.source !== parent || e.origin !== ORIGIN) return;
      const d = e.data || {};
      if (d.type !== 'atlas:config') return;
      if (!d.config) { embedded('unavailable', ['the Atlas API did not deliver its configuration' + (d.error ? ' (' + d.error + ')' : '')]); return; }
      let res;
      try { res = FL.configure(d.config, (typeof d.config.source === 'string' && d.config.source) || 'Atlas API'); }
      catch (err) { res = { ok: false, problems: ['error applying the Atlas API configuration: ' + err.message] }; }
      if (!res.ok) { embedded('invalid', res.problems); return; }
      finish('api', null);
    }
    window.addEventListener('message', onConfig);
    const ask = () => { try { parent.postMessage({ type: 'atlas:config-request' }, ORIGIN); } catch (e) { /* sem acesso à página de fora */ } };
    ask(); asker = setInterval(ask, ASK_MS);
    timer = setTimeout(() => embedded('timeout', ['the Atlas API configuration did not arrive within ' + WAIT_MS / 1000 + ' s']), WAIT_MS);
  };
})();

(function () {
const FL = window.FL;
function main(cfgFrom) {
  const $ = (id) => document.getElementById(id);
  const ORIGIN = location.origin;
  const EMBED = new URLSearchParams(location.search).get('embed') === '1';
  const post = (m) => { try { parent.postMessage(m, ORIGIN); } catch (e) { /* fora de um iframe */ } };
  const P = JSON.parse(JSON.stringify(FL.DEFAULTS));
  P.igdur = 0;                          // nada acende até o Atlas pedir
  const WIND = 10;                      // ventilação forçada de cabine, cm/s (o mesmo valor dos cenários do lab3d)
  const SHORT = { CO2: 'CO₂', He: 'helium', N2: 'nitrogen' };

  const res = FL.createGL($('gl'));
  if (res.error) { post({ type: 'atlas:lab', status: 'error', message: res.error }); return; }
  const gl = res.gl;
  const software = /basic render|swiftshader|llvmpipe|software/i.test(res.gpu);

  let sim = null, view, dead = false, lit = false, seq = 0, n = 0;
  let action = null, out = null, wasBurning = false;
  let acc = 0, lastStep = 0, redraw = true, paused = false;
  // Sem chama pedida, o solver só aquece o escoamento por WARM quadros depois de cada reinício e para:
  // a página do simulador divide a thread com o Atlas (iframe da mesma origem) e não deve pesar à toa.
  const WARM = 30;
  let warm = 0;
  const TIERS = ['min', 'leve', 'padrao'];
  let tier = software ? 'min' : 'padrao';
  let autoDone = software, aN = 0, aSum = 0, lastT = 0, avgMs = 0;

  function fail(msg) { dead = true; post({ type: 'atlas:lab', status: 'error', message: msg }); }
  $('gl').addEventListener('webglcontextlost', (e) => { e.preventDefault(); fail('The graphics card closed the 3D context, so the flame is illustrated.'); });

  function build() {
    try {
      if (sim) sim.dispose();
      FL.clampSample(P, Math.cbrt(P.dims[0] * P.dims[1] * P.dims[2] / FL.QUALITY[tier].cells));
      sim = new FL.Sim(gl, P, tier);
      sim.cap = 4;                      // modo contínuo: só os quadros mais recentes ficam na memória
      view.sim = sim; view.P = P;
      view.resize(sim.q.scale);
      restart();
    } catch (err) {
      console.error(err);
      fail('The 3D simulator could not start on this graphics card: ' + err.message);
    }
  }
  function autoQuality(now) {
    const dt = now - lastT; lastT = now;
    if (sim.time < 0.3 || dt > 500) return;
    aSum += dt; aN++;
    if (aN < 40) return;
    avgMs = aSum / aN; aN = aSum = 0;
    const i = TIERS.indexOf(tier);
    if (!autoDone && avgMs > 30 && i > 0) { tier = TIERS[avgMs > 120 ? 0 : i - 1]; avgMs = 0; build(); return; }
    // já na qualidade mínima e ainda lento: o Atlas troca pela chama ilustrada (modo leve)
    if (!autoDone && avgMs > 50 && i === 0) { fail('Light mode: the 3D simulator ran too slowly on this device, so the flame is illustrated.'); return; }
    autoDone = true;
  }
  function restart() {
    P.igdur = lit ? 0.8 : 0;            // com a chama pedida, o ignitor liga no começo do teste
    sim.reset(P);
    sim.stepFrame(P);
    action = P.sup.on ? { label: 'the ' + SHORT[P.sup.agent] + ' discharge', t: 0 } : null;
    out = null; wasBurning = false; redraw = true; warm = 0;
  }

  /* ---------- o que o Atlas pede ---------- */
  window.addEventListener('message', (e) => {
    if (e.source !== parent || e.origin !== ORIGIN || dead || !sim) return;
    const d = e.data || {};
    if (d.type === 'atlas:pause') { paused = !!d.paused; return; }
    if (d.type !== 'atlas:set') return;
    let again = false;
    const near = (a, b) => Math.abs(a - b) < 1e-6;
    // material pelo id (ou apelido) da configuração; o índice antigo ainda vale se o id não vier
    const mi = typeof d.material === 'string' ? FL.matIndex(d.material) : -1;
    const mat = mi >= 0 ? mi : Number.isInteger(d.mat) && d.mat >= 0 && d.mat < FL.MATS.length ? d.mat : P.mat;
    const num = (v, lo, hi, def) => (typeof v === 'number' && isFinite(v) ? Math.max(lo, Math.min(hi, v)) : def);
    const o2 = num(d.o2, 5, 60, P.o2), press = num(d.press, 3, 20, P.press), g = num(d.g, 0, 3, P.g);
    if (!near(P.o2, o2) || !near(P.press, press) || !near(P.g, g) || P.mat !== mat) {
      P.o2 = o2; P.press = press; P.g = g; P.mat = mat; P.igoff = null; again = true;
    }
    // ar forçado: velocidade em cm/s se o Atlas mandar; senão, ligado ou cortado
    const wind = num(d.wind, 0, 100, d.vent ? WIND : 0);
    if (P.wind !== wind) {
      P.wind = wind; P.igoff = null;
      if (wind === 0) action = { label: 'the ventilation cut-off', t: sim.time };
    }
    const key = d.agent === 'co2' ? 'CO2' : d.agent === 'he' ? 'He' : null;
    if (key && key !== P.sup.agent) {
      if (sim.agent > 0.01) again = true;   // trocar de gás com o ar já diluído recomeça o teste
      P.sup.agent = key;
    }
    if (key) P.sup.frac = num(d.frac, 0, 0.6, P.sup.frac);
    if (!!key !== P.sup.on) {
      P.sup.on = !!key;
      if (key) action = { label: 'the ' + SHORT[key] + ' discharge', t: sim.time };
    }
    if (!!d.lit !== lit) {
      lit = !!d.lit;
      if (lit && !again) { P.igdur = 0.8; sim.ignite(P); out = null; }
      if (!lit) again = true;
    }
    if (d.seq !== seq) {
      seq = d.seq;
      if (lit && !again) { sim.ignite(P); out = null; }
    }
    if (again) restart();
    redraw = true;
  });

  /* ---------- o que o Atlas recebe ---------- */
  function report() {
    const m = sim.latest, t = sim.time;
    const igniting = sim.ign.some((w) => t >= w[0] && t < w[1] + 0.05);
    const burning = !!m && m.hrr > 1 && m.tk > 1200;
    if (m) {
      if (burning) out = null;
      else if (wasBurning && !igniting) out = { dt: action ? t - action.t : null, label: action && action.label, agent: sim.agent };
      wasBurning = burning;
    }
    post({
      type: 'atlas:metrics', lit, igniting, burning, measured: !!m,
      hrr: m ? m.hrr : 0, tk: m ? m.tk : 0, agent: sim.agent, agentKey: P.sup.agent, supOn: P.sup.on,
      o2eff: P.o2 * (1 - sim.agent), wind: P.wind, out,
      material: FL.MATS[P.mat].n, tier: sim.q.n, fps: avgMs ? Math.round(1000 / avgMs) : 0
    });
  }

  /* ---------- sobreposição: só a caixa do duto e a seta do ar ---------- */
  function overlay() {
    const c = view.ctx, L = P.dims;
    view.update();
    c.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    c.clearRect(0, 0, view.w, view.h);
    if (EMBED) return;                  // na cena do habitat a caixa e a seta são desenhadas pela própria cena
    c.lineCap = 'round';
    const line = (a, b) => { const p = view.proj(a), q = view.proj(b); if (p && q) { c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); c.stroke(); } };
    const hx = L[0] / 2, hy = L[1] / 2, hz = L[2] / 2;
    c.strokeStyle = 'rgba(163,177,198,0.22)'; c.lineWidth = 1;
    for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) {
      line([-hx, s1 * hy, s2 * hz], [hx, s1 * hy, s2 * hz]);
      line([s1 * hx, -hy, s2 * hz], [s1 * hx, hy, s2 * hz]);
      line([s1 * hx, s2 * hy, -hz], [s1 * hx, s2 * hy, hz]);
    }
    const a = view.proj([-hx - 2.4, 0, 0]), b = view.proj([-hx - 0.3, 0, 0]);
    if (a && b) {
      const on = P.wind > 0;
      c.strokeStyle = c.fillStyle = on ? 'rgba(233,239,248,0.85)' : 'rgba(163,177,198,0.45)'; c.lineWidth = 2.5;
      c.setLineDash(on ? [] : [5, 6]);
      c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); c.setLineDash([]);
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      c.beginPath(); c.moveTo(b[0] + 10 * Math.cos(ang), b[1] + 10 * Math.sin(ang));
      c.lineTo(b[0] + 7 * Math.cos(ang + 2.3), b[1] + 7 * Math.sin(ang + 2.3));
      c.lineTo(b[0] + 7 * Math.cos(ang - 2.3), b[1] + 7 * Math.sin(ang - 2.3)); c.closePath(); c.fill();
      c.font = '500 12px "IBM Plex Sans", system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'bottom';
      c.fillText(on ? 'cabin air, ' + FL.fmt(P.wind, 0) + ' cm/s' : 'ventilation off', (a[0] + b[0]) / 2, Math.min(a[1], b[1]) - 8);
    }
  }

  function tick(now) {
    requestAnimationFrame(tick);
    if (dead || !sim || document.hidden || paused) { lastT = lastStep = now; return; }
    if (!lit && warm >= WARM) {         // sem chama: nada a calcular; só redesenha se a câmera mudou
      lastT = lastStep = now;
      if (redraw) { view.render(sim, sim.count - 1, P); overlay(); redraw = false; }
      return;
    }
    autoQuality(now);
    acc += Math.min(now - lastStep, 100) / 1000; lastStep = now;
    let stepped = false;
    if (acc >= sim.dtFrame) {
      acc = Math.min(acc - sim.dtFrame, sim.dtFrame);
      if (sim.count >= sim.cap) sim.wrap();
      sim.stepFrame(P);
      stepped = true;
      if (!lit) warm++;
    }
    sim.poll();
    if (stepped || redraw) { view.render(sim, sim.count - 1, P); overlay(); redraw = false; }
    if (stepped && n++ % 4 === 0) report();
  }

  view = new FL.View(gl, $('gl'), $('ov'));
  view.handles = function () { return []; };   // no palco só se gira a câmera; amostra, ignitor e caixa ficam fixos
  view.bg = [[0.027, 0.043, 0.067], [0.050, 0.080, 0.118], [0.007, 0.011, 0.018]];   // fundo no tom do palco do Atlas
  view.pad = 1.25;                              // o palco do Atlas tem título em cima e leituras embaixo
  view.fit(P.dims);                             // a câmera se enquadra sozinha pela proporção do palco
  view.onEdit = function () { redraw = true; };
  if (EMBED) {
    document.documentElement.style.background = document.body.style.background = '#000';
    view.bg = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    let ext = null;
    // câmera da cena 3D: {eye, target, up} em cm no referencial do duto e fov vertical em graus
    window.atlasCam = function (c) {
      if (!c || !Array.isArray(c.eye) || !Array.isArray(c.target) || !(c.fov > 1 && c.fov < 170)) return;
      ext = { eye: c.eye.slice(0, 3), target: c.target.slice(0, 3), up: Array.isArray(c.up) ? c.up.slice(0, 3) : [0, 1, 0], fov: c.fov };
      redraw = true;
    };
    const own = view.update.bind(view);
    view.update = function () {
      if (!ext) return own();
      this.eye = ext.eye;
      const pr = FL.M.persp(ext.fov * Math.PI / 180, this.w / this.h, 0.2, 6000);
      this.vp = FL.M.mul(pr, FL.M.look(ext.eye, ext.target, ext.up));
      this.ivp = FL.M.inv(this.vp);
    };
  }
  new ResizeObserver(() => { if (sim) { view.resize(); redraw = true; } }).observe($('viewport'));
  build();
  if (!dead) {
    post({
      type: 'atlas:lab', status: 'ready', gpu: res.gpu,
      materials: FL.MATS.map((m) => ({ id: m.id, name: m.n, aliases: m.aliases || [], status: m.status || 'provisório' })),
      // from: 'api' = a configuração entregue pelo Atlas; 'embedded' = a embutida em model.js (reason diz por quê)
      config: { schema: FL.SCHEMA, source: FL.CONFIG.source, from: cfgFrom.from, reason: cfgFrom.reason, problems: FL.CONFIG.problems }
    });
    requestAnimationFrame(tick);
  }
}

/* Where the physical parameters come from: the Atlas (the page around this iframe) reads <api>/sim/config and
   hands it over by postMessage (FL.fromAtlas, above). The published site calls the API on another origin, and
   FL.ready only reads a configuration from the page's own origin, so the page never fetches it by itself there. */
FL.fromAtlas(main);
})();
