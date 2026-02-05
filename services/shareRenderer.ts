import type { TicketArchive } from './archiveGenerator';

export function renderSharePage(
  archive: TicketArchive,
  opts?: { qrDataUrl?: string; shareUrl?: string; autoPrint?: boolean }
): string {
  const esc = (input: any) =>
    String(input ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const ogImage = esc(archive.featured_tickets[0]?.image_ref || '');
  const title = esc(archive.title);
  const ogDesc = esc(`探索了 ${archive.stats.total_places} 个地点，漫游了 ${archive.stats.total_distance}km`);
  const qrDataUrl = opts?.qrDataUrl ?? '';
  const shareUrl = esc(opts?.shareUrl ?? '');
  const autoPrint = Boolean(opts?.autoPrint);
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | Nightfall</title>
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${ogDesc}">
  <meta property="og:image" content="${ogImage}">
  <style>
    :root {
      --bg-primary: #0a0a0f;
      --bg-secondary: #1a1a2e;
      --text-primary: #ffffff;
      --text-secondary: rgba(255,255,255,0.7);
      --accent: #8b5cf6;
    }
    body {
      background: var(--bg-primary);
      color: var(--text-primary);
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 980px;
      margin: 0 auto;
      padding: 40px 24px 80px;
    }
    header {
      text-align: center;
      margin-bottom: 32px;
    }
    header h1 {
      font-size: 36px;
      margin: 0 0 8px;
      font-weight: 600;
    }
    header .subtitle {
      color: var(--text-secondary);
      font-size: 14px;
      letter-spacing: 0.2em;
      text-transform: uppercase;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 16px;
      margin: 32px 0;
    }
    .stat-card {
      background: var(--bg-secondary);
      border-radius: 16px;
      padding: 20px;
      text-align: center;
    }
    .stat-value {
      display: block;
      font-size: 28px;
      font-weight: 600;
      margin-bottom: 6px;
    }
    .stat-label {
      color: var(--text-secondary);
      font-size: 12px;
      letter-spacing: 0.2em;
      text-transform: uppercase;
    }
    .featured {
      margin-top: 32px;
    }
    .featured h2 {
      margin: 0 0 16px;
      font-size: 20px;
      font-weight: 600;
    }
    .ticket-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }
    .ticket-card {
      background: #11111a;
      border-radius: 14px;
      overflow: hidden;
    }
    .ticket-card img {
      width: 100%;
      aspect-ratio: 1 / 1;
      object-fit: cover;
      display: block;
    }
    .ticket-info {
      padding: 12px;
    }
    .ticket-info h3 {
      margin: 0 0 4px;
      font-size: 14px;
      font-weight: 600;
    }
    .ticket-info p {
      margin: 0;
      color: var(--text-secondary);
      font-size: 12px;
    }
    .footprints {
      margin-top: 32px;
    }
    .footprints h2 {
      margin: 0 0 12px;
      font-size: 18px;
      font-weight: 600;
    }
    .footprint-list {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .footprint-item {
      background: #11111a;
      border-radius: 12px;
      padding: 10px 12px;
      font-size: 12px;
      color: var(--text-secondary);
      display: flex;
      justify-content: space-between;
      gap: 12px;
    }
    footer {
      margin-top: 40px;
      text-align: center;
      color: var(--text-secondary);
      font-size: 12px;
    }
    footer a {
      color: var(--accent);
      text-decoration: none;
    }
    .share-box {
      margin-top: 28px;
      background: var(--bg-secondary);
      border-radius: 16px;
      padding: 18px;
      display: flex;
      gap: 18px;
      align-items: center;
      flex-wrap: wrap;
      justify-content: center;
    }
    .share-qr {
      width: 120px;
      height: 120px;
      border-radius: 12px;
      background: #0b0b12;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .share-qr img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .share-text {
      max-width: 360px;
      font-size: 13px;
      color: var(--text-secondary);
      line-height: 1.6;
    }
    @media (max-width: 768px) {
      .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .ticket-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
  </style>
  ${autoPrint ? '<script>window.onload=()=>setTimeout(()=>window.print(),400);</script>' : ''}
</head>
<body>
  <div class="container">
    <header>
      <h1>${title}</h1>
      <p class="subtitle">Nightfall 深夜漫游记录</p>
    </header>
    <section class="stats">
      <div class="stat-card">
        <span class="stat-value">${archive.stats.total_trips}</span>
        <span class="stat-label">次出行</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">${archive.stats.total_places}</span>
        <span class="stat-label">个地点</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">${archive.stats.total_distance}</span>
        <span class="stat-label">公里</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">${archive.stats.night_owl_score}</span>
        <span class="stat-label">夜猫指数</span>
      </div>
    </section>
    <section class="featured">
      <h2>精选瞬间</h2>
      <div class="ticket-grid">
        ${archive.featured_tickets.map(t => `
          <div class="ticket-card">
            <img src="${esc(t.image_ref)}" alt="${esc(t.place_name)}">
            <div class="ticket-info">
              <h3>${esc(t.place_name)}</h3>
              <p>${esc(t.date)}</p>
            </div>
          </div>
        `).join('')}
      </div>
    </section>
    ${(archive.footprint ?? []).length ? `
      <section class="footprints">
        <h2>足迹分布</h2>
        <div class="footprint-list">
          ${(archive.footprint ?? []).slice(0, 8).map(fp => `
            <div class="footprint-item">
              <span>${esc(fp.place_name)}</span>
              <span>×${esc(fp.visit_count)}</span>
            </div>
          `).join('')}
        </div>
      </section>
    ` : ''}
    ${shareUrl ? `
      <section class="share-box">
        ${qrDataUrl ? `<div class="share-qr"><img src="${qrDataUrl}" alt="二维码"></div>` : ''}
        <div class="share-text">
          <div>分享链接：</div>
          <div>${shareUrl}</div>
          <div style="margin-top:6px; font-size:12px; opacity:0.7;">扫码打开即可查看图鉴</div>
        </div>
      </section>
    ` : ''}
    <footer>
      <p>由 Nightfall 生成</p>
      <a href="https://nightfall.app">开始你的深夜漫游</a>
    </footer>
  </div>
</body>
</html>
  `.trim();
}
