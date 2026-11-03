(function () {
  const CATS = [
    { key: '전체', icon: '📍' },
    { key: '음식점', icon: '🍚' },
    { key: '카페', icon: '☕' },
    { key: '숨은장소', icon: '🌿' },
    { key: '생활꿀팁', icon: '💡' },
    { key: '자유', icon: '📝' },
  ];
  const ICON = Object.fromEntries(CATS.map((c) => [c.key, c.icon]));
  const TIPS_SHOWN = 3;
  const SIMILAR_MAX = 12;
  const QUICK = ['학식', '짜장면', '부리또', '카페', '프린트', '999번', '와이파이', '코인노래방', '장학금'];

  const places = window.PLACES || [];
  const $ = (id) => document.getElementById(id);
  const state = { cat: '전체', q: '', sort: 'rec' };

  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // ---- 한글 검색 도우미 ----
  const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  const JUNG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅗㅏ', 'ㅗㅐ', 'ㅗㅣ', 'ㅛ', 'ㅜ', 'ㅜㅓ', 'ㅜㅔ', 'ㅜㅣ', 'ㅠ', 'ㅡ', 'ㅡㅣ', 'ㅣ'];
  const JONG = ['', 'ㄱ', 'ㄲ', 'ㄱㅅ', 'ㄴ', 'ㄴㅈ', 'ㄴㅎ', 'ㄷ', 'ㄹ', 'ㄹㄱ', 'ㄹㅁ', 'ㄹㅂ', 'ㄹㅅ', 'ㄹㅌ', 'ㄹㅍ', 'ㄹㅎ', 'ㅁ', 'ㅂ', 'ㅂㅅ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
  const SPLIT = { ㄳ: 'ㄱㅅ', ㄵ: 'ㄴㅈ', ㄶ: 'ㄴㅎ', ㄺ: 'ㄹㄱ', ㄻ: 'ㄹㅁ', ㄼ: 'ㄹㅂ', ㄽ: 'ㄹㅅ', ㄾ: 'ㄹㅌ', ㄿ: 'ㄹㅍ', ㅀ: 'ㄹㅎ', ㅄ: 'ㅂㅅ', ㅘ: 'ㅗㅏ', ㅙ: 'ㅗㅐ', ㅚ: 'ㅗㅣ', ㅝ: 'ㅜㅓ', ㅞ: 'ㅜㅔ', ㅟ: 'ㅜㅣ', ㅢ: 'ㅡㅣ' };
  // 된소리·비슷한 모음은 같은 글자로 봄 (자장면=짜장면, 까페=카페)
  const FOLD = { ㄲ: 'ㄱ', ㄸ: 'ㄷ', ㅃ: 'ㅂ', ㅆ: 'ㅅ', ㅉ: 'ㅈ', ㅐ: 'ㅔ', ㅒ: 'ㅖ' };
  const fold = (s) => s.replace(/[ㄲㄸㅃㅆㅉㅐㅒ]/g, (c) => FOLD[c]);
  const syl = (ch) => {
    const c = ch.charCodeAt(0) - 0xac00;
    return c >= 0 && c < 11172 ? c : -1;
  };

  // 글자를 자모로 풀어 씀. 입력 중인 글자(짜장며)도 짜장면에 맞게 됨
  function jamo(s) {
    let out = '';
    for (const ch of s) {
      const c = syl(ch);
      out += c < 0 ? SPLIT[ch] || ch : CHO[Math.floor(c / 588)] + JUNG[Math.floor((c % 588) / 28)] + JONG[c % 28];
    }
    return fold(out);
  }
  function chosung(s) {
    let out = '';
    for (const ch of s) {
      const c = syl(ch);
      out += c < 0 ? ch : CHO[Math.floor(c / 588)];
    }
    return fold(out);
  }
  const norm = (s) => String(s).normalize('NFC').toLowerCase().replace(/[\s·.,()\-~/]+/g, '');

  // 발음이 비슷한 자모는 반만 틀린 걸로 셈 (까페≈카페, 부리토≈부리또)
  const NEAR = { ㄱ: 'k', ㅋ: 'k', ㄷ: 't', ㅌ: 't', ㅂ: 'p', ㅍ: 'p', ㅈ: 'c', ㅊ: 'c', ㅔ: 'e', ㅖ: 'e' };
  const subCost = (a, b) => (a === b ? 0 : NEAR[a] && NEAR[a] === NEAR[b] ? 1 : 2);

  // 오타 허용 부분 일치: t 안에서 p와 가장 가까운 부분까지의 편집 거리 (반 글자 = 1)
  function approx(p, t) {
    const m = p.length;
    let prev = new Uint16Array(m + 1).map((_, i) => i * 2);
    let cur = new Uint16Array(m + 1);
    let min = m * 2;
    for (let j = 0; j < t.length; j++) {
      cur[0] = 0;
      for (let i = 1; i <= m; i++) {
        cur[i] = Math.min(prev[i] + 2, cur[i - 1] + 2, prev[i - 1] + subCost(p[i - 1], t[j]));
      }
      if (cur[m] < min && (min = cur[m]) === 0) break;
      [prev, cur] = [cur, prev];
    }
    return min;
  }

  function prep(raw) {
    const plain = norm(raw);
    return { raw, plain, jamo: jamo(plain), cho: /^[ㄱ-ㅎ]+$/.test(plain) ? fold(plain) : '' };
  }
  function prepTokens(q) {
    return q
      .trim()
      .split(/\s+/)
      .map(prep)
      .filter((t) => t.plain)
      .map((t) => {
        // 뒤에 붙은 말을 떼어 본 검색어 (짜장면집 → 짜장면, 프린트하는곳 → 프린트)
        const chars = [...t.plain];
        t.prefixes = [];
        if (!t.cho) for (let n = chars.length - 1; n >= 2; n--) t.prefixes.push(prep(chars.slice(0, n).join('')));
        return t;
      });
  }

  const FIELDS = [
    ['name', 10],
    ['menu', 8],
    ['cat', 6],
    ['tips', 4],
    ['loc', 3],
    ['etc', 1],
  ];
  places.forEach((p) => {
    const text = { name: p.name, menu: p.menu, cat: p.cat, tips: p.tips.join('|'), loc: p.loc, etc: p.price + ' ' + p.hours };
    p._f = FIELDS.map(([k, w]) => {
      const plain = norm(text[k]);
      return {
        w,
        plain,
        jamo: jamo(plain),
        cho: k === 'name' || k === 'menu' ? chosung(plain) : '',
        fuzzy: k !== 'loc' && k !== 'etc',
      };
    });
    p._tips = p.tips.map((t) => {
      const plain = norm(t);
      return { plain, jamo: jamo(plain) };
    });
  });

  // 한 검색어가 한 칸에 얼마나 잘 맞는지 (0 = 안 맞음)
  function matchField(t, f) {
    if (!f.plain) return 0;
    if (f.plain.includes(t.plain)) return f.plain === t.plain ? 160 : f.plain.startsWith(t.plain) ? 130 : 100;
    if (f.jamo.includes(t.jamo)) return 80;
    if (t.cho && f.cho.includes(t.cho)) return 70;
    return 0;
  }
  function fuzzyField(t, f) {
    if (!f.fuzzy || !f.jamo || t.cho || t.jamo.length < 4) return 0;
    const max = t.jamo.length >= 10 ? 4 : 2;
    const d = approx(t.jamo, f.jamo);
    return d <= max ? 40 - d * 5 : 0;
  }
  const best = (p, fn) => p._f.reduce((s, f) => Math.max(s, fn(f) * f.w), 0);

  function tokenScore(t, p) {
    const exact = best(p, (f) => matchField(t, f));
    if (exact) return { s: exact, exact: true };
    const len = [...t.plain].length;
    for (const sub of t.prefixes) {
      const s = best(p, (f) => matchField(sub, f));
      if (s) return { s: (s * 0.6 * [...sub.plain].length) / len, exact: false };
    }
    return { s: best(p, (f) => fuzzyField(t, f)), exact: false };
  }

  function search(tokens) {
    const rows = places.map((p) => tokens.map((t) => tokenScore(t, p)));
    // 여러 곳에 흔히 나오는 단어(교통대 등)보다 드문 단어(짜장면 등)에 더 무게를 둠
    const idf = tokens.map((_, k) => Math.log(1 + places.length / (1 + rows.filter((r) => r[k].exact).length)));
    const strict = [];
    const loose = [];
    rows.forEach((r, i) => {
      let total = 0;
      let hit = 0;
      r.forEach((x, k) => {
        if (!x.s) return;
        total += x.s * idf[k];
        hit++;
      });
      if (!hit) return;
      const item = { p: places[i], score: (total * hit) / tokens.length + places[i].rec };
      (r.every((x) => x.exact) ? strict : loose).push(item);
    });
    const byScore = (a, b) => b.score - a.score || b.p.rec - a.p.rec;
    return { strict: strict.sort(byScore), loose: loose.sort(byScore) };
  }

  // 받침 있으면 '과', 없으면 '와'
  const wa = (word) => {
    const c = syl(word.slice(-1));
    return c >= 0 && c % 28 ? '과' : '와';
  };

  function tipHit(tip, tokens) {
    return tokens.some((t) => tip.plain.includes(t.plain) || tip.jamo.includes(t.jamo) || t.prefixes.some((s) => tip.plain.includes(s.plain)));
  }

  function mapLink(p) {
    if (p.map) return p.map;
    // 지도 링크가 없으면 위치가 적힌 곳만 이름으로 지도 검색
    if (p.loc) return 'https://map.naver.com/p/search/' + encodeURIComponent(p.name);
    return '';
  }

  // ---- 추천·비추천 (추천 기본값 = 그곳을 소개한 학생 수, 누를 때마다 +1, 누른 횟수는 이 브라우저에만 저장) ----
  const VOTE_KEY = 'knut-guide-votes';
  let clicks = {};
  try {
    clicks = JSON.parse(localStorage.getItem(VOTE_KEY)) || {};
  } catch (e) {}

  const BASE = Object.fromEntries(places.map((p) => [p.name, { up: p.rec, down: 0 }]));
  const voteOf = (name) => {
    const b = BASE[name] || { up: 0, down: 0 };
    const c = clicks[name] || {};
    return { up: b.up + (c.up || 0), down: b.down + (c.down || 0) };
  };

  function voteHTML(name) {
    const v = voteOf(name);
    return (
      `<button type="button" class="vote" data-kind="up" title="추천">👍 추천 <b>${v.up}</b></button>` +
      `<button type="button" class="vote" data-kind="down" title="비추천">👎 비추천 <b>${v.down}</b></button>`
    );
  }

  function vote(btn) {
    const name = btn.closest('.votes').dataset.place;
    const kind = btn.dataset.kind;
    const c = (clicks[name] = clicks[name] || { up: 0, down: 0 });
    c[kind] = (c[kind] || 0) + 1;
    try {
      localStorage.setItem(VOTE_KEY, JSON.stringify(clicks));
    } catch (e) {}
    btn.querySelector('b').textContent = voteOf(name)[kind];
    btn.classList.remove('bump');
    void btn.offsetWidth; // 연속으로 눌러도 애니메이션이 다시 재생되게
    btn.classList.add('bump');
  }

  function renderStats() {
    const total = places.length;
    const recs = places.reduce((s, p) => s + p.rec, 0);
    const food = places.filter((p) => p.cat === '음식점' || p.cat === '카페').length;
    $('stats').innerHTML = [
      [total, '곳·꿀팁'],
      [food, '맛집·카페'],
      [recs, '건의 추천'],
    ]
      .map(([n, label]) => `<li><strong>${n}</strong><span>${label}</span></li>`)
      .join('');
  }

  function renderQuick() {
    $('quick').innerHTML =
      '<span>자주 찾는 검색어</span>' + QUICK.map((w) => `<button type="button" class="chip" data-q="${esc(w)}">${esc(w)}</button>`).join('');
  }

  function renderTabs(items) {
    const counts = { 전체: items.length };
    items.forEach(({ p }) => (counts[p.cat] = (counts[p.cat] || 0) + 1));
    $('tabs').innerHTML = CATS.filter((c) => counts[c.key] || places.some((p) => p.cat === c.key))
      .map(
        (c) =>
          `<button type="button" class="tab" data-cat="${c.key}" aria-pressed="${state.cat === c.key}"${counts[c.key] ? '' : ' data-zero'}>` +
          `${c.icon} ${c.key} <span class="n">${counts[c.key] || 0}</span></button>`
      )
      .join('');
  }

  function card(p, tokens) {
    const re = tokens.length ? new RegExp('(' + tokens.map((t) => escRe(t.raw)).join('|') + ')', 'gi') : null;
    const hl = (s) => (re ? String(s).split(re).map((part, i) => (i % 2 ? `<mark>${esc(part)}</mark>` : esc(part))).join('') : esc(s));

    const facts = [];
    if (p.menu) facts.push(['대표메뉴', p.price ? `${p.menu} · ${p.price}` : p.menu]);
    else if (p.price) facts.push(['가격', p.price]);
    if (p.hours) facts.push(['운영시간', p.hours]);
    if (p.loc) facts.push(['위치', p.loc]);

    // 검색 중이면 검색어가 들어간 후기를 맨 위로
    let order = p.tips.map((_, i) => i);
    if (tokens.length) order = [...order.filter((i) => tipHit(p._tips[i], tokens)), ...order.filter((i) => !tipHit(p._tips[i], tokens))];
    const tips = order.map((i) => `<li>${hl(p.tips[i])}</li>`);
    const shown = tips.slice(0, TIPS_SHOWN).join('');
    const rest = tips.slice(TIPS_SHOWN);
    const href = mapLink(p);

    return `<article class="card">
      <div class="card-top">
        <span class="badge" data-cat="${esc(p.cat)}">${ICON[p.cat] || ''} ${esc(p.cat)}</span>
      </div>
      <h2>${hl(p.name)}</h2>
      ${facts.length ? `<dl class="facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${hl(v)}</dd></div>`).join('')}</dl>` : ''}
      ${tips.length ? `<ul class="tips">${shown}</ul>` : ''}
      ${rest.length ? `<details class="more"><summary>후기 ${rest.length}개 더 보기</summary><ul class="tips">${rest.join('')}</ul></details>` : ''}
      <div class="card-foot">
        <div class="votes" data-place="${esc(p.name)}">${voteHTML(p.name)}</div>
        ${href ? `<a class="map" href="${esc(href)}" target="_blank" rel="noopener">🗺️ 지도</a>` : ''}
      </div>
      ${p.date ? `<p class="date">${esc(p.date)} 확인</p>` : ''}
    </article>`;
  }

  function render() {
    const tokens = prepTokens(state.q);
    let main;
    let similar = [];
    let fallback = false;

    if (tokens.length) {
      const r = search(tokens);
      if (r.strict.length) {
        main = r.strict;
        similar = r.loose;
      } else {
        // 정확한 결과가 없으면 가장 비슷한 것들만 (1등 점수의 절반 이상)
        main = r.loose.filter((x) => x.score >= r.loose[0].score * 0.5);
        fallback = true;
      }
    } else {
      const byName = (a, b) => a.p.name.localeCompare(b.p.name, 'ko');
      main = places.map((p) => ({ p }));
      const net = (p) => voteOf(p.name).up - voteOf(p.name).down;
      if (state.sort === 'rec') main.sort((a, b) => net(b.p) - net(a.p) || byName(a, b));
      else if (state.sort === 'date') main.sort((a, b) => (b.p.date || '').localeCompare(a.p.date || '') || b.p.rec - a.p.rec);
      else main.sort(byName);
    }

    renderTabs(main);
    const inCat = (x) => state.cat === '전체' || x.p.cat === state.cat;
    main = main.filter(inCat);
    similar = similar.filter(inCat).slice(0, SIMILAR_MAX);

    $('list').innerHTML = main.map((x) => card(x.p, tokens)).join('');
    $('similar').innerHTML = similar.map((x) => card(x.p, tokens)).join('');
    $('similarTitle').hidden = !similar.length;

    const q = state.q.trim();
    $('count').textContent = !tokens.length
      ? `${main.length}개`
      : fallback && main.length
        ? `‘${q}’${wa(q)} 정확히 맞는 곳이 없어서 가장 비슷한 ${main.length}개를 보여 드려요`
        : `‘${q}’ 검색 결과 ${main.length}개`;
    $('empty').hidden = main.length + similar.length > 0;
    $('sort').disabled = tokens.length > 0;
  }

  function setCat(cat) {
    state.cat = CATS.some((c) => c.key === cat) ? cat : '전체';
    const hash = state.cat === '전체' ? '' : '#' + encodeURIComponent(state.cat);
    if (location.hash !== hash) history.replaceState(null, '', hash || location.pathname + location.search);
    render();
  }

  function setQuery(value) {
    if (value === state.q) return;
    // 검색을 시작하면 전체에서 찾음 (탭으로 다시 좁힐 수 있음)
    const starting = !state.q.trim() && value.trim();
    state.q = value;
    if (starting) setCat('전체');
    else render();
  }

  $('tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab');
    if (btn) setCat(btn.dataset.cat);
  });
  // 일부 모바일 키보드는 input 이벤트가 늦게 와서 keyup·compositionend도 같이 받음
  ['input', 'keyup', 'compositionend'].forEach((type) => $('q').addEventListener(type, (e) => setQuery(e.target.value)));
  $('q').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') e.target.blur();
  });
  $('quick').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    $('q').value = chip.dataset.q;
    setQuery(chip.dataset.q);
    $('count').scrollIntoView({ block: 'start', behavior: 'smooth' });
  });
  $('sort').addEventListener('change', (e) => {
    state.sort = e.target.value;
    render();
  });
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.vote');
    if (btn) vote(btn);
  });

  renderStats();
  renderQuick();
  setCat(decodeURIComponent(location.hash.slice(1)) || '전체');
})();
