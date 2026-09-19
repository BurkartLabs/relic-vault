import { ctx } from './game/GameCtx';

/** ?debug=1 only. DOM is allowed for this panel per spec. */
export function mountDebug() {
  const el = document.createElement('div');
  el.id = 'rv-debug';
  const vs = () => (window as any).__vault;
  const acts: [string, () => void][] = [
    ['+500 gems', () => { ctx.state.gems += 500; vs()?.hud.refresh(true); }],
    ['+10k gold', () => { ctx.state.gold += 10000; vs()?.hud.refresh(true); }],
    ['piggy $3', () => { ctx.state.piggy = 300; vs()?.hud.refresh(); }],
    ['fill board', () => vs()?.debugFill()],
    ['T8 pair', () => { const s = ctx.state; const e = s.board.map((t, i) => (t ? -1 : i)).filter((i) => i >= 0); if (e.length > 1) { s.board[e[0]] = 8; s.board[e[1]] = 8; vs()?.syncBoard(); } }],
    ['welcome', () => vs()?.showOffer({ id: 'welcome', trigger: 'debug', delayMs: 0 })],
    ['jammed', () => vs()?.showOffer({ id: 'jammed', trigger: 'debug', delayMs: 0 })],
    ['chest', () => { ctx.state.freeChests++; vs()?.openChest('free', 'debug'); }],
    ['event pts', () => { ctx.state.event.points += 500; }],
    ['pass xp', () => { ctx.state.pass.xp += 200; }],
    ['minor', () => { ctx.state.age = 'minor'; vs()?.refreshButtons(); }],
    ['save', () => ctx.persistNow()],
  ];
  el.innerHTML = '<b>Relic Vault debug</b><div class="b"></div><pre></pre>';
  const b = el.querySelector('.b')!;
  for (const [label, fn] of acts) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.onclick = () => { fn(); ctx.persist(); };
    b.appendChild(btn);
  }
  document.body.appendChild(el);
  const pre = el.querySelector('pre')!;
  setInterval(() => {
    const t = ctx.telemetry.buf.slice(-12).map((e) => `${e.event} ${JSON.stringify(e.props)}`).join('\n');
    const a = ctx.analytics.buf.slice(-8).map((e) => `${e.type} ${e.sku ?? e.offer ?? ''} ${e.trigger ?? ''}`).join('\n');
    pre.textContent = `telemetry (${ctx.telemetry.buf.length})\n${t}\n\nanalytics ring (${ctx.analytics.buf.length})\n${a}`;
  }, 1000);
}
