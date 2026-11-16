/* Modelo: materiais, ambientes, constantes físicas e a fronteira de inflamabilidade.
   Os parâmetros de material e as constantes físicas são provisórios (ajustados à mão, sem medida).
   A fronteira não é ajuste nosso: é a curva que a NASA publicou para o BASS-II. */
(function () {
  const FL = (window.FL = window.FL || {});

  // s: O2 consumido por unidade de combustível · pyrK: temperatura de pirólise (K)
  // M: taxa de pirólise (1/s por unidade de θ) · L: calor de gaseificação (θ por unidade de vapor)
  // bnd: fronteira de inflamabilidade publicada, ou null quando não há curva para o material.
  //   Forma "nasa-6.1" (BASS-II, NASA/TM-20210011385, Eq. 6.1, p. 75): X_min = A·exp(−k·a) + B·a + C, em % de O2,
  //   com a taxa de estiramento a = 3/2 · (U/r) · (r/r0)^½ em 1/s (U em cm/s, r = raio da amostra em cm).
  //   band: quanto os testes se espalham em volta da curva, em pontos de O2.
  const NASA61 = { form: 'nasa-6.1', A: 6, k: 0.5, B: 0.0167, C: 13.4, r0: 0.318, band: 0.5, source: 'NASA/TM-20210011385, Eq. (6.1), p. 75' };
  FL.MATS = [
    { id: 'pmma', n: 'PMMA (acrílico)', aliases: [], s: 1.92, pyrK: 650, M: 70, L: 0.6, soot: 1.0, inhib: 1.0, col: [0.80, 0.84, 0.82], bnd: NASA61 },
    { id: 'algodao', n: 'Tecido de algodão com fibra de vidro', aliases: ['sibal'], s: 1.18, pyrK: 600, M: 90, L: 0.45, soot: 0.6, inhib: 1.0, col: [0.88, 0.84, 0.74], bnd: null },
    { id: 'retard', n: 'Tecido retardante (hipotético)', aliases: ['nomex'], status: 'hipotético', s: 1.5, pyrK: 780, M: 30, L: 1.0, soot: 1.3, inhib: 0.3, col: [0.56, 0.62, 0.68], bnd: null }
  ];
  // Vento natural que a gravidade cria junto à chama, somado ao vento forçado (soma linear, como o relatório do
  // BASS-II faz na Fig. 6.22). f1g: faixa em 1 g, em cm/s: 20 (o próprio relatório, p. 89) a 35 (estimativa de
  // Takahashi, NTRS 20250002114). Em gravidade parcial ninguém mediu: a faixa vai de zero ao valor da Terra.
  FL.BUOY = { f1g: [20, 35] };

  FL.HABS = [
    { n: 'Estação ou nave', g: 0, o2: 21, press: 14.7, wind: 10 },
    { n: 'Ventilação cortada', g: 0, o2: 21, press: 14.7, wind: 0 },
    { n: 'Base lunar', g: 0.165, o2: 30, press: 10.2, wind: 10 },
    { n: 'Rover pressurizado', g: 0.165, o2: 34, press: 8.2, wind: 10 },
    { n: 'Base em Marte', g: 0.378, o2: 34, press: 8.2, wind: 10 },
    { n: 'Terra (1 g)', g: 1, o2: 21, press: 14.7, wind: 0 }
  ];

  // cp: capacidade térmica relativa ao N2 · d: fator de difusividade · rad: fator de perda radiativa
  FL.DILS = {
    N2: { n: 'Nitrogênio (N₂)', cp: 1.0, d: 1.0, rad: 1.0, sup: 0 },
    CO2: { n: 'Dióxido de carbono (CO₂)', cp: 1.65, d: 0.8, rad: 2.2, sup: 0 },
    He: { n: 'Hélio (He)', cp: 0.65, d: 3.0, rad: 1.0, sup: 0 }
  };
  // sup: quanto o O2 mínimo sobe (pontos percentuais) por 1% de supressor na atmosfera, além da diluição.
  // Fica em zero: não há dado da NASA para sólidos, então o veredito conta só a diluição do oxigênio
  // (os valores antigos, 0,05 / 0,12 / 0,09, eram palpite). No solver 3D o gás continua agindo por cp, d e rad.
  FL.SUP_TAU = 0.6;   // s: constante de tempo da descarga de supressor

  FL.QUALITY = {
    min: { n: 'Mínima', cells: 24000, part: 64, vc: 1, steps: 48, scale: 0.5 },
    leve: { n: 'Leve', cells: 60000, part: 96, vc: 1, steps: 64, scale: 0.75 },
    padrao: { n: 'Padrão', cells: 180000, part: 128, vc: 1, steps: 96, scale: 1 },
    alto: { n: 'Alto', cells: 450000, part: 176, vc: 1, steps: 128, scale: 1 }
  };

  FL.PHYS = {
    DT: 0.006,        // s: unidade de tempo do quadro (quadro = DT × subpassos escolhidos)
    STRIDE: 2,        // o solver avança STRIDE × DT por passo interno enquanto o Courant do ar não passa de CFL
    CFL: 1.25,        // acima disso o passo interno volta a ser DT (ver Sim.pace)
    WIND_TAU: 0.25,   // s: tempo para o ar da câmara acompanhar uma mudança do ventilador (corte, religação)
    // fator pré-exponencial (1/s) numa célula de HREF cm; o solver usa K0·HREF/h, porque a zona de reação tem a
    // espessura de uma célula e sem isso o limite de extinção muda com a resolução. Com o solver antigo foi preciso
    // subir de 3e8 para 4,5e9 para compensar a difusão numérica; sem ela, 2,1e8 (3e8 na resolução Padrão) já sustenta
    // a chama de PMMA em 1 g com 21% de O2 e a 50 cm/s em 0 g. O O2 mínimo em 0 g a 10 cm/s fica em 13,8%
    // (a fronteira analítica dá 17%). Acima de 1e9 a química deixa de limitar e o mínimo cai para 11,4%.
    K0: 2.1e8,
    HREF: 0.19,       // cm: célula de referência das normalizações por resolução (cinética e pirólise)
    TA: 15000,        // temperatura de ativação (K)
    RAD: 2.0,         // perda radiativa (θ/s a 2200 K)
    BETA: 450,        // empuxo (cm/s² por unidade de θ a 1 g)
    D0: 1.0,          // difusividade de referência (cm²/s)
    EXP: 0.1,         // expansão térmica
    BLOW: 1.0,        // sopro de pirólise
    PR: 0.7,          // número de Prandtl: viscosidade = PR × difusividade térmica
    MAC: 1,           // 1: advecção MacCormack de 2ª ordem · 0: semi-lagrangiana de 1ª ordem
    RSUB: 4,          // subpassos da integração da reação dentro de cada subpasso
    MG: { nu: 2, nuL: 2, nuC: 8 },   // multigrid: passadas de suavização no nível fino, nos intermediários e no mais grosso
    HC_O2: 13.1,      // kJ liberados por grama de O2 consumido
    MEM_MB: 240,      // orçamento de memória da linha do tempo
    MAX_FRAMES: 240
  };

  FL.DEFAULTS = {
    o2: 21, press: 14.7, dil: 'N2', g: 0,
    wind: 10, wdir: [1, 0, 0], sealed: false,
    mat: 0, shape: 'sphere', size: 0.6, spos: [-2.5, 0, 0], igoff: null, igdur: 0.8,
    dims: [12, 6, 6], quality: 'auto', dur: 4,
    sup: { agent: 'CO2', frac: 0.3, on: false },   // descarga de supressor: fração-alvo na atmosfera
    view: 'flame', particles: true, slice: false, sliceAxis: 2, slicePos: 0
  };

  /* ---------- configuração por dados ----------
     Materiais, gases, cenários e constantes físicas podem vir de fora (arquivo ou API), no formato
     "lab3d.config/1". Os valores acima são só o padrão para quando não há fonte externa.
     FL.config() devolve a configuração em uso nesse formato; FL.configure(cfg, origem) confere e aplica
     outra. Cada valor fora do tipo ou da faixa é recusado com um aviso e o valor anterior fica. */
  FL.SCHEMA = 'lab3d.config/1';
  FL.CONFIG = { source: 'embutido', problems: [] };
  // faixas aceitas: [mínimo, máximo]
  const R_MAT = { s: [0.2, 5], pyrK: [350, 1200], M: [1, 500], L: [0, 5], soot: [0, 5], inhib: [0.01, 1.5] };
  const R_BND = { A: [0, 50], k: [0.01, 5], B: [0, 1], C: [5, 60], r0_cm: [0.05, 5] };
  const R_DIL = { cp: [0.2, 3], d: [0.2, 5], rad: [0, 5], sup: [0, 1] };
  const R_HAB = { g: [0, 3], o2: [10, 60], press: [3, 20], wind: [0, 100] };
  const R_PHYS = {
    DT: [0.001, 0.02], CFL: [0.25, 4], WIND_TAU: [0.02, 5], K0: [1e6, 1e11], HREF: [0.05, 1], TA: [5000, 30000],
    RAD: [0, 20], BETA: [0, 10000], D0: [0.05, 10], EXP: [0, 1], BLOW: [0, 5], PR: [0.1, 5], RSUB: [1, 8], HC_O2: [5, 20]
  };
  const isNum = (v, r) => typeof v === 'number' && isFinite(v) && v >= r[0] && v <= r[1];
  const copy = (v) => JSON.parse(JSON.stringify(v));
  const txt = (v, n) => String(v).replace(/[<>&"'`]/g, '').slice(0, n || 80);
  const clean = (list) => list.slice(0, 40).map((m) => txt(m, 300));

  FL.config = function () {
    const phys = {};
    Object.keys(R_PHYS).forEach((k) => { phys[k] = FL.PHYS[k]; });
    return {
      schema: FL.SCHEMA, source: FL.CONFIG.source,
      materials: FL.MATS.map((m) => ({
        id: m.id, name: m.n, aliases: m.aliases || [], status: m.status || 'provisório',
        s: m.s, pyrK: m.pyrK, M: m.M, L: m.L, soot: m.soot, inhib: m.inhib, color: m.col.slice(),
        boundary: m.bnd ? { form: m.bnd.form, A: m.bnd.A, k: m.bnd.k, B: m.bnd.B, C: m.bnd.C, r0_cm: m.bnd.r0, band_o2: m.bnd.band, source: m.bnd.source } : null
      })),
      buoyancy: { flow_1g_cm_s: FL.BUOY.f1g.slice(), superposition: 'linear' },
      diluents: copy(FL.DILS),
      habitats: copy(FL.HABS).map((h) => ({ name: h.n, g: h.g, o2: h.o2, press: h.press, wind: h.wind })),
      physics: phys, suppressant_tau_s: FL.SUP_TAU
    };
  };

  FL.configure = function (cfg, source) {
    const problems = [], bad = (m) => { problems.push(m); };
    if (!cfg || typeof cfg !== 'object') return { ok: false, problems: ['a configuração não é um objeto JSON'] };
    if (cfg.schema !== FL.SCHEMA) return { ok: false, problems: ['formato "' + cfg.schema + '" não reconhecido; esperado "' + FL.SCHEMA + '"'] };
    // confere um grupo de números contra as faixas; devolve só os aceitos
    const nums = (obj, ranges, where) => {
      const out = {};
      Object.keys(ranges).forEach((k) => {
        if (obj[k] === undefined) return;
        if (isNum(obj[k], ranges[k])) out[k] = obj[k];
        else bad(where + '.' + k + ' = ' + JSON.stringify(obj[k]) + ' fora de ' + ranges[k][0] + ' a ' + ranges[k][1]);
      });
      return out;
    };
    const full = (o, ranges) => Object.keys(ranges).every((k) => o[k] !== undefined);

    if (Array.isArray(cfg.materials)) {
      const mats = [], seen = {};
      cfg.materials.forEach((m, i) => {
        const w = 'materials[' + i + ']';
        if (!m || typeof m.id !== 'string' || !/^[a-z0-9_-]{1,32}$/.test(m.id) || seen[m.id]) return bad(w + ': id ausente, inválido ou repetido');
        const p = nums(m, R_MAT, w);
        const col = Array.isArray(m.color) && m.color.length === 3 && m.color.every((v) => isNum(v, [0, 1])) ? m.color.slice() : null;
        if (!full(p, R_MAT) || !col) return bad(w + ' (' + m.id + '): faltam campos válidos; material ignorado');
        // fronteira: opcional. Só a forma publicada é aceita; qualquer outra coisa deixa o material sem veredito analítico
        let bnd = null;
        if (m.boundary && typeof m.boundary === 'object') {
          const b = m.boundary.form === 'nasa-6.1' ? nums(m.boundary, R_BND, w + '.boundary') : {};
          if (full(b, R_BND)) bnd = { form: 'nasa-6.1', A: b.A, k: b.k, B: b.B, C: b.C, r0: b.r0_cm, band: isNum(m.boundary.band_o2, [0, 5]) ? m.boundary.band_o2 : 0, source: txt(m.boundary.source || '', 120) };
          else bad(w + '.boundary: só a forma "nasa-6.1" é aceita; ' + m.id + ' fica sem fronteira');
        }
        seen[m.id] = 1;
        mats.push(Object.assign({ id: m.id, n: txt(m.name || m.id), aliases: (Array.isArray(m.aliases) ? m.aliases : []).map(txt), status: txt(m.status || 'provisório'), col, bnd }, p));
      });
      if (mats.length) FL.MATS = mats; else bad('materials: nenhum material válido; mantidos os atuais');
    }
    if (cfg.diluents && typeof cfg.diluents === 'object') {
      Object.keys(cfg.diluents).forEach((k) => {
        if (!/^[A-Za-z][A-Za-z0-9]{0,11}$/.test(k)) return bad('diluents: chave "' + k + '" inválida; ignorada');
        const d = cfg.diluents[k] || {}, p = nums(d, R_DIL, 'diluents.' + k);
        if (Object.prototype.hasOwnProperty.call(FL.DILS, k)) Object.assign(FL.DILS[k], p, d.n ? { n: txt(d.n) } : {});
        else if (full(p, R_DIL)) FL.DILS[k] = Object.assign({ n: txt(d.n || k) }, p);
        else bad('diluents.' + k + ': gás novo com campos faltando; ignorado');
      });
    }
    if (Array.isArray(cfg.habitats)) {
      const habs = [];
      cfg.habitats.forEach((h, i) => {
        const p = nums(h || {}, R_HAB, 'habitats[' + i + ']');
        if (full(p, R_HAB)) habs.push(Object.assign({ n: txt(h.name || 'Cenário ' + (i + 1)) }, p));
        else bad('habitats[' + i + ']: faltam campos válidos; ignorado');
      });
      if (habs.length) FL.HABS = habs;
    }
    if (cfg.physics && typeof cfg.physics === 'object') {
      Object.keys(cfg.physics).forEach((k) => { if (!Object.prototype.hasOwnProperty.call(R_PHYS, k)) bad('physics.' + k + ': constante desconhecida; ignorada'); });
      Object.assign(FL.PHYS, nums(cfg.physics, R_PHYS, 'physics'));
    }
    if (cfg.buoyancy && typeof cfg.buoyancy === 'object') {
      const f = cfg.buoyancy.flow_1g_cm_s;
      if (Array.isArray(f) && f.length === 2 && isNum(f[0], [0, 200]) && isNum(f[1], [0, 200]) && f[0] <= f[1]) FL.BUOY = { f1g: f.slice() };
      else bad('buoyancy.flow_1g_cm_s: esperados dois números de 0 a 200, em ordem; mantida a faixa atual');
    }
    if (cfg.suppressant_tau_s !== undefined) {
      if (isNum(cfg.suppressant_tau_s, [0.05, 10])) FL.SUP_TAU = cfg.suppressant_tau_s; else bad('suppressant_tau_s fora de 0,05 a 10');
    }
    FL.CONFIG = { source: txt(source || cfg.source || 'externo'), problems: clean(problems) };
    return { ok: true, problems: FL.CONFIG.problems };
  };
  // índice do material pelo id ou por um apelido (o nome que outro sistema usa para ele); −1 se não existe
  FL.matIndex = function (id) {
    return FL.MATS.findIndex((m) => m.id === id || (m.aliases || []).indexOf(id) >= 0);
  };
  // busca a configuração numa URL e aplica; em qualquer falha fica o padrão embutido
  FL.loadConfig = function (url, source, ms) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), ms || 2500);
    return fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' } })
      .then((r) => { if (!r.ok) throw new Error('resposta ' + r.status); return r.json(); })
      .then((cfg) => FL.configure(cfg, source || (cfg && cfg.source) || url))
      .catch((e) => ({ ok: false, problems: ['não foi possível ler ' + url + ' (' + (e.name === 'AbortError' ? 'tempo esgotado' : e.message) + ')'] }))
      .then((res) => { clearTimeout(timer); if (!res.ok) FL.CONFIG = { source: 'embutido', problems: clean(res.problems) }; return res; });
  };

  /* Ponto de partida das páginas: lê a configuração de ?config=<endereço> (ou do padrão que a página indicar)
     e só então roda fn. Só aceita endereço da mesma origem da página; "none" força o padrão embutido. */
  FL.ready = function (fn, defUrl) {
    let url = null;
    try { url = new URLSearchParams(location.search).get('config') || defUrl || null; } catch (e) { /* sem location */ }
    if (url && url !== 'none') {
      try { if (new URL(url, location.href).origin !== location.origin) { FL.CONFIG.problems = ['endereço de configuração de outra origem; ignorado']; url = null; } } catch (e) { url = null; }
    }
    if (!url || url === 'none') return fn();
    FL.loadConfig(url).then(fn);
  };

  /* ---------- fronteira de inflamabilidade (curva publicada) ----------
     A curva e o veredito (O₂ mínimo, "queima / no limite / não sustenta") são calculados só pela API do Atlas
     (/api/flammability/assess). Aqui fica apenas o vento natural, que o simulador usa para posicionar o ignitor. */
  // vento natural da gravidade g (em g da Terra): faixa [lo, hi] em cm/s e, só como referência,
  // a faixa de 1 g escalada por g^(1/3)
  FL.buoy = function (g) {
    const f = FL.BUOY.f1g;
    if (!(g > 0.005)) return { lo: 0, hi: 0, est: [0, 0] };
    if (g >= 0.95) return { lo: f[0], hi: f[1], est: f.slice() };
    const k = Math.cbrt(g);
    return { lo: 0, hi: f[1], est: [f[0] * k, f[1] * k] };
  };
  /* ---------- geometria da amostra ---------- */
  // meias-dimensões (cm) da forma, dado o tamanho e o domínio
  FL.sampleDim = function (P, h) {
    const r = P.size;
    if (P.shape === 'cyl') return [r, r, Math.max(r, Math.min(P.dims[2] / 2 - 0.8, 4 * r))];
    if (P.shape === 'slab') return [1.8 * r, Math.max(0.12, 1.3 * h), 1.8 * r];
    return [r, r, r];
  };
  FL.shapeId = function (s) { return s === 'cyl' ? 1 : s === 'slab' ? 2 : 0; };
  // distância do centro até a superfície na direção d
  FL.support = function (P, e, d) {
    if (P.shape === 'sphere') return e[0];
    if (P.shape === 'cyl') return Math.hypot(d[0], d[1]) * e[0] + Math.abs(d[2]) * e[2];
    return Math.abs(d[0]) * e[0] + Math.abs(d[1]) * e[1] + Math.abs(d[2]) * e[2];
  };
  FL.igniterPos = function (P, h) {
    const e = FL.sampleDim(P, h);
    let off = P.igoff;
    if (!off) {
      // lado de onde o gás chega: vento forçado somado à subida por empuxo (meio da faixa de referência de FL.buoy)
      const w = P.sealed ? 0 : P.wind, be = FL.buoy(P.g).est, ub = (be[0] + be[1]) / 2;
      let f = [P.wdir[0] * w, P.wdir[1] * w + ub, P.wdir[2] * w];
      const fl = Math.hypot(f[0], f[1], f[2]);
      f = fl > 1e-6 ? f.map((v) => v / fl) : P.wdir;
      const d = [-f[0], -f[1], -f[2]];
      const s = FL.support(P, e, d) + 0.05;
      off = [d[0] * s, d[1] * s, d[2] * s];
    }
    return [P.spos[0] + off[0], P.spos[1] + off[1], P.spos[2] + off[2]];
  };
  FL.clampSample = function (P, h) {
    const e = FL.sampleDim(P, h);
    for (let i = 0; i < 3; i++) {
      const lim = Math.max(0, P.dims[i] / 2 - e[i] - 3 * h);
      P.spos[i] = Math.max(-lim, Math.min(lim, P.spos[i]));
    }
  };

  FL.fmt = function (v, d) {
    return v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  };
})();
