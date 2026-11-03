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

  const places = window.PLACES || [];
  const $ = (id) => document.getElementById(id);
  const state = { cat: '전체', q: '', sort: 'rec' };

  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const norm = (s) => s.toLowerCase().replace(/\s+/g, '');

  places.forEach((p) => {
    p._search = norm([p.name, p.loc, p.cat, p.menu, p.price, p.hours, ...p.tips].join(' '));
  });

  function mapLink(p) {
    if (p.map) return p.map;
    // 지도 링크가 없으면 위치가 적힌 곳만 이름으로 지도 검색
    if (p.loc) return 'https://map.naver.com/p/search/' + encodeURIComponent(p.name);
    return '';
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

  function renderTabs() {
    const counts = { 전체: places.length };
    places.forEach((p) => (counts[p.cat] = (counts[p.cat] || 0) + 1));
    $('tabs').innerHTML = CATS.filter((c) => counts[c.key])
      .map(
        (c) =>
          `<button type="button" class="tab" data-cat="${c.key}" aria-pressed="${state.cat === c.key}">` +
          `${c.icon} ${c.key} <span class="n">${counts[c.key]}</span></button>`
      )
      .join('');
  }

  function card(p) {
    const facts = [];
    if (p.menu) facts.push(['대표메뉴', p.price ? `${p.menu} · ${p.price}` : p.menu]);
    else if (p.price) facts.push(['가격', p.price]);
    if (p.hours) facts.push(['운영시간', p.hours]);
    if (p.loc) facts.push(['위치', p.loc]);

    const tips = p.tips.map((t) => `<li>${esc(t)}</li>`);
    const shown = tips.slice(0, TIPS_SHOWN).join('');
    const rest = tips.slice(TIPS_SHOWN);
    const href = mapLink(p);

    return `<article class="card">
      <div class="card-top">
        <span class="badge" data-cat="${esc(p.cat)}">${ICON[p.cat] || ''} ${esc(p.cat)}</span>
        ${p.rec > 1 ? `<span class="rec${p.rec >= 3 ? ' hot' : ''}" title="이 장소를 적은 학생 수">👍 ${p.rec}명 추천</span>` : ''}
      </div>
      <h2>${esc(p.name)}</h2>
      ${facts.length ? `<dl class="facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}
      ${tips.length ? `<ul class="tips">${shown}</ul>` : ''}
      ${rest.length ? `<details class="more"><summary>후기 ${rest.length}개 더 보기</summary><ul class="tips">${rest.join('')}</ul></details>` : ''}
      <div class="card-foot">
        ${href ? `<a class="map" href="${esc(href)}" target="_blank" rel="noopener">🗺️ 지도 보기</a>` : '<span></span>'}
        ${p.date ? `<span class="date">${esc(p.date)} 확인</span>` : ''}
      </div>
    </article>`;
  }

  function render() {
    const q = norm(state.q);
    let list = places.filter((p) => (state.cat === '전체' || p.cat === state.cat) && (!q || p._search.includes(q)));

    const byName = (a, b) => a.name.localeCompare(b.name, 'ko');
    if (state.sort === 'rec') list.sort((a, b) => b.rec - a.rec || byName(a, b));
    else if (state.sort === 'date') list.sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.rec - a.rec);
    else list.sort(byName);

    $('list').innerHTML = list.map(card).join('');
    $('count').textContent = `${list.length}개`;
    $('empty').hidden = list.length > 0;
    document.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-pressed', t.dataset.cat === state.cat));
  }

  function setCat(cat) {
    state.cat = CATS.some((c) => c.key === cat) ? cat : '전체';
    const hash = state.cat === '전체' ? '' : '#' + encodeURIComponent(state.cat);
    if (location.hash !== hash) history.replaceState(null, '', hash || location.pathname + location.search);
    render();
  }

  $('tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab');
    if (btn) setCat(btn.dataset.cat);
  });
  $('q').addEventListener('input', (e) => {
    state.q = e.target.value;
    render();
  });
  $('sort').addEventListener('change', (e) => {
    state.sort = e.target.value;
    render();
  });

  renderStats();
  renderTabs();
  setCat(decodeURIComponent(location.hash.slice(1)) || '전체');
})();
