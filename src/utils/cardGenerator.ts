import { Issue } from '../types';
import { buildIssueSlug, buildIssueSharePayload } from './share';

export type CardStyle = 'bold' | 'editorial' | 'neon';
export type CardFormat = 'landscape' | 'square';

export interface CardRenderOptions {
  style?: CardStyle;
  format?: CardFormat;
  colorTone?: 'vibrant' | 'toned';
}

/**
 * Text wrapping helper
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = ctx.measureText(testLine).width;

    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
      if (lines.length === maxLines - 1) {
        const remainingWords = words.slice(i).join(' ');
        let lastLine = remainingWords;
        while (ctx.measureText(`${lastLine}...`).width > maxWidth && lastLine.length > 3) {
          lastLine = lastLine.slice(0, -4).trim();
        }
        lines.push(`${lastLine}...`);
        return lines;
      }
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Fallback-safe rounded rectangle
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number
) {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Format question so it always ends with a single clean question mark
 */
function formatQuestion(title: string): string {
  let cleaned = title.trim();
  while (cleaned.endsWith('?') || cleaned.endsWith('!')) {
    cleaned = cleaned.slice(0, -1).trim();
  }
  return `${cleaned}?`;
}

/**
 * =========================================================================
 * CONCEPT 1: THE BOLD DUELIST (Viral Social Poll / High Legibility)
 * =========================================================================
 */
function renderBoldDuelist(
  ctx: CanvasRenderingContext2D,
  issue: Issue,
  width: number,
  height: number,
  isSquare: boolean,
  isToned: boolean
) {
  // Background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  if (isToned) {
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(0.5, '#1e293b');
    bgGrad.addColorStop(1, '#090d16');
  } else {
    bgGrad.addColorStop(0, '#0b0f19');
    bgGrad.addColorStop(0.5, '#111827');
    bgGrad.addColorStop(1, '#030712');
  }
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Ambient glows
  const glow1 = ctx.createRadialGradient(width * 0.9, height * 0.1, 10, width * 0.9, height * 0.1, 380);
  glow1.addColorStop(0, isToned ? 'rgba(71, 85, 105, 0.4)' : 'rgba(16, 185, 129, 0.22)');
  glow1.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, width, height);

  const glow2 = ctx.createRadialGradient(width * 0.1, height * 0.9, 10, width * 0.1, height * 0.9, 420);
  glow2.addColorStop(0, isToned ? 'rgba(100, 116, 139, 0.35)' : 'rgba(244, 63, 94, 0.20)');
  glow2.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, width, height);

  // Outer border
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 2.5;
  drawRoundedRect(ctx, 36, 36, width - 72, height - 72, 32);
  ctx.stroke();
  ctx.restore();

  const padX = isSquare ? 72 : 80;
  let cursorY = isSquare ? 88 : 84;
  const contentWidth = width - padX * 2;

  // Header: YesOrNo Brand Badge + Category Pill
  ctx.save();
  // Brand Badge
  drawRoundedRect(ctx, padX, cursorY, 205, 48, 16);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.10)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.20)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Mini Icon Box
  drawRoundedRect(ctx, padX + 8, cursorY + 8, 32, 32, 10);
  const iconGrad = ctx.createLinearGradient(padX + 8, cursorY + 8, padX + 40, cursorY + 40);
  iconGrad.addColorStop(0, '#10b981');
  iconGrad.addColorStop(1, '#6366f1');
  ctx.fillStyle = iconGrad;
  ctx.fill();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(padX + 17, cursorY + 24);
  ctx.lineTo(padX + 22, cursorY + 29);
  ctx.lineTo(padX + 31, cursorY + 18);
  ctx.stroke();

  ctx.font = '800 22px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('YesOrNo', padX + 50, cursorY + 32);

  // Category Pill (Right)
  const categoryLabel = (issue.category || 'Public Ballot').toUpperCase();
  ctx.font = '700 13px system-ui, -apple-system, sans-serif';
  const catWidth = ctx.measureText(categoryLabel).width + 38;
  const catX = width - padX - catWidth;

  drawRoundedRect(ctx, catX, cursorY + 4, catWidth, 40, 14);
  ctx.fillStyle = isToned ? 'rgba(71, 85, 105, 0.3)' : 'rgba(99, 102, 241, 0.22)';
  ctx.fill();
  ctx.strokeStyle = isToned ? 'rgba(148, 163, 184, 0.35)' : 'rgba(129, 140, 248, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(catX + 16, cursorY + 24, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = '#10b981';
  ctx.fill();

  ctx.fillStyle = isToned ? '#e2e8f0' : '#c7d2fe';
  ctx.fillText(categoryLabel, catX + 28, cursorY + 29);
  ctx.restore();

  // Central Question (Extra Large & Highly Legible)
  cursorY += isSquare ? 116 : 98;
  const question = formatQuestion(issue.title);

  ctx.save();
  ctx.font = isSquare
    ? '900 46px system-ui, -apple-system, sans-serif'
    : '900 40px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#ffffff';

  const titleLines = wrapText(ctx, question, contentWidth, isSquare ? 4 : 3);
  const titleLineHeight = isSquare ? 56 : 50;

  titleLines.forEach((line) => {
    ctx.fillText(line, padX, cursorY);
    cursorY += titleLineHeight;
  });
  ctx.restore();

  // Optional Context Description
  if (issue.description && issue.description.trim().length > 0 && !issue.isDeletedByAuthor) {
    cursorY += 8;
    ctx.save();
    ctx.font = '500 18px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(226, 232, 240, 0.88)';
    const descLines = wrapText(ctx, issue.description, contentWidth, isSquare ? 3 : 2);
    descLines.forEach((line) => {
      ctx.fillText(line, padX, cursorY);
      cursorY += 26;
    });
    ctx.restore();
  }

  // DUEL SECTION: Massive YES vs NO Action Cards (NO RESULTS/VOTES SHOWN)
  const duelY = isSquare ? height - 310 : height - 240;
  const duelCardH = isSquare ? 115 : 95;
  const colGap = 18;
  const colW = (contentWidth - colGap) / 2;

  ctx.save();
  // YES Card
  drawRoundedRect(ctx, padX, duelY, colW, duelCardH, 20);
  const yesBg = ctx.createLinearGradient(padX, duelY, padX + colW, duelY + duelCardH);
  yesBg.addColorStop(0, 'rgba(6, 78, 59, 0.85)');
  yesBg.addColorStop(1, 'rgba(6, 95, 70, 0.65)');
  ctx.fillStyle = yesBg;
  ctx.fill();
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.75)';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.font = '900 28px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#34d399';
  ctx.fillText('VOTE YES  👍', padX + 24, duelY + (duelCardH / 2) - 4);

  ctx.font = '600 13px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fillText('Cast your stance in favor', padX + 24, duelY + (duelCardH / 2) + 24);

  // NO Card
  const noX = padX + colW + colGap;
  drawRoundedRect(ctx, noX, duelY, colW, duelCardH, 20);
  const noBg = ctx.createLinearGradient(noX, duelY, noX + colW, duelY + duelCardH);
  noBg.addColorStop(0, 'rgba(136, 19, 55, 0.85)');
  noBg.addColorStop(1, 'rgba(159, 18, 57, 0.65)');
  ctx.fillStyle = noBg;
  ctx.fill();
  ctx.strokeStyle = 'rgba(244, 63, 94, 0.75)';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.font = '900 28px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#fb7185';
  ctx.fillText('VOTE NO  👎', noX + 24, duelY + (duelCardH / 2) - 4);

  ctx.font = '600 13px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fillText('Cast your stance against', noX + 24, duelY + (duelCardH / 2) + 24);

  // Dual Progress Connector Bar (Balanced 50/50 Duel Track)
  const barY = duelY + duelCardH + 14;
  const barH = 10;
  const barW = contentWidth;

  drawRoundedRect(ctx, padX, barY, barW, barH, 5);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.fill();

  // Emerald side
  drawRoundedRect(ctx, padX, barY, barW / 2, barH, 5);
  const barYesGrad = ctx.createLinearGradient(padX, barY, padX + barW / 2, barY);
  barYesGrad.addColorStop(0, '#059669');
  barYesGrad.addColorStop(1, '#10b981');
  ctx.fillStyle = barYesGrad;
  ctx.fill();

  // Rose side
  drawRoundedRect(ctx, padX + barW / 2, barY, barW / 2, barH, 5);
  const barNoGrad = ctx.createLinearGradient(padX + barW / 2, barY, padX + barW, barY);
  barNoGrad.addColorStop(0, '#e11d48');
  barNoGrad.addColorStop(1, '#f43f5e');
  ctx.fillStyle = barNoGrad;
  ctx.fill();
  ctx.restore();

  // Footer: Time-Bound Ballot & URL Badge
  const footerY = height - (isSquare ? 82 : 74);
  ctx.save();
  ctx.font = '700 15px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(226, 232, 240, 0.9)';
  ctx.fillText(`⚡ Time-Bound Ballot • ${issue.durationLabel || 'Active for Voting'}`, padX, footerY);

  const sharePayload = buildIssueSharePayload(issue);
  const displayHost = sharePayload.url.replace(/^https?:\/\//, '').split('/')[0] || 'yesorno.chillon.top';
  const urlLabel = `${displayHost}/${buildIssueSlug(issue).slice(0, 22)}... →`;

  ctx.font = '700 13px ui-monospace, SFMono-Regular, monospace';
  const badgeW = ctx.measureText(urlLabel).width + 36;
  const badgeX = width - padX - badgeW;

  drawRoundedRect(ctx, badgeX, footerY - 16, badgeW, 38, 12);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.fillText(urlLabel, badgeX + 18, footerY + 8);
  ctx.restore();
}

/**
 * =========================================================================
 * CONCEPT 2: EDITORIAL SPOTLIGHT (Clean Magazine / Serif Accent)
 * =========================================================================
 */
function renderEditorialSpotlight(
  ctx: CanvasRenderingContext2D,
  issue: Issue,
  width: number,
  height: number,
  isSquare: boolean,
  isToned: boolean
) {
  // Deep Rich Editorial Slate Background
  ctx.fillStyle = isToned ? '#090d16' : '#0a0f1d';
  ctx.fillRect(0, 0, width, height);

  // Subtle Dot Grid
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  const dotStep = 32;
  for (let x = 32; x < width; x += dotStep) {
    for (let y = 32; y < height; y += dotStep) {
      ctx.beginPath();
      ctx.arc(x, y, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // Clean Border
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, 36, 36, width - 72, height - 72, 32);
  ctx.stroke();
  ctx.restore();

  const padX = isSquare ? 72 : 80;
  let cursorY = isSquare ? 90 : 84;
  const contentWidth = width - padX * 2;

  // Header: YESORNO / PUBLIC BALLOT + #DECISION-RADAR
  ctx.save();
  ctx.font = '900 20px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('YESORNO', padX, cursorY + 20);

  ctx.font = '600 13px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(' /  PUBLIC BALLOT', padX + 110, cursorY + 20);

  // Category Tag
  const catTag = `#${(issue.category || 'COMMUNITY').toUpperCase().replace(/\s+/g, '-')}`;
  ctx.font = '700 12px ui-monospace, SFMono-Regular, monospace';
  const tagW = ctx.measureText(catTag).width + 24;
  const tagX = width - padX - tagW;

  drawRoundedRect(ctx, tagX, cursorY, tagW, 34, 17);
  ctx.fillStyle = 'rgba(245, 158, 11, 0.12)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#fbbf24';
  ctx.fillText(catTag, tagX + 12, cursorY + 22);

  // Horizontal divider
  cursorY += 46;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, cursorY);
  ctx.lineTo(width - padX, cursorY);
  ctx.stroke();
  ctx.restore();

  // Eyebrow label
  cursorY += isSquare ? 48 : 42;
  ctx.save();
  ctx.font = '800 12px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('QUESTION OF THE TOPIC', padX, cursorY);

  // Big Question with Editorial Styling
  cursorY += 34;
  ctx.font = isSquare
    ? '800 44px "Instrument Serif", Georgia, serif, system-ui'
    : '800 38px "Instrument Serif", Georgia, serif, system-ui';
  ctx.fillStyle = '#ffffff';

  const question = formatQuestion(issue.title);
  const titleLines = wrapText(ctx, question, contentWidth, isSquare ? 4 : 3);
  const titleLineHeight = isSquare ? 54 : 48;

  titleLines.forEach((line) => {
    ctx.fillText(line, padX, cursorY);
    cursorY += titleLineHeight;
  });
  ctx.restore();

  // Excerpt Context Box with Indigo Accent Bar
  if (issue.description && issue.description.trim().length > 0 && !issue.isDeletedByAuthor) {
    cursorY += 10;
    ctx.save();
    // Indigo vertical accent line
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(padX + 2, cursorY - 4);
    ctx.lineTo(padX + 2, cursorY + 36);
    ctx.stroke();

    ctx.font = 'italic 500 17px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    const descLines = wrapText(ctx, `"${issue.description}"`, contentWidth - 24, 2);
    let descY = cursorY + 12;
    descLines.forEach((line) => {
      ctx.fillText(line, padX + 18, descY);
      descY += 24;
    });
    ctx.restore();
  }

  // Standings Duel Bar (NO RESULTS / NO COUNTS)
  const duelY = isSquare ? height - 260 : height - 200;
  ctx.save();
  // Left Label
  ctx.font = '900 24px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#10b981';
  ctx.fillText('VOTE IN FAVOR (YES) 👍', padX, duelY);

  // Right Label
  const rightLabel = '👎 VOTE AGAINST (NO)';
  ctx.font = '900 24px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#f43f5e';
  const rightW = ctx.measureText(rightLabel).width;
  ctx.fillText(rightLabel, width - padX - rightW, duelY);

  // Flat Dual Duel Bar
  const barY = duelY + 18;
  const barH = 12;
  const barW = contentWidth;

  drawRoundedRect(ctx, padX, barY, barW, barH, 6);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.fill();

  // Emerald half
  drawRoundedRect(ctx, padX, barY, barW / 2, barH, 6);
  ctx.fillStyle = '#10b981';
  ctx.fill();

  // Rose half
  drawRoundedRect(ctx, padX + barW / 2, barY, barW / 2, barH, 6);
  ctx.fillStyle = '#f43f5e';
  ctx.fill();

  // Footer
  const footerY = height - (isSquare ? 80 : 72);
  ctx.font = '600 14px ui-monospace, monospace';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('Open for community deliberation', padX, footerY);

  const cta = 'Cast your stance at yesorno.chillon.top →';
  const ctaW = ctx.measureText(cta).width;
  ctx.font = '700 14px ui-monospace, monospace';
  ctx.fillStyle = '#818cf8';
  ctx.fillText(cta, width - padX - ctaW, footerY);
  ctx.restore();
}

/**
 * =========================================================================
 * CONCEPT 3: MIDNIGHT NEON PULSE (Linear / Web3 / Cyber Glow)
 * =========================================================================
 */
function renderMidnightNeon(
  ctx: CanvasRenderingContext2D,
  issue: Issue,
  width: number,
  height: number,
  isSquare: boolean,
  isToned: boolean
) {
  // Midnight Obsidian base
  ctx.fillStyle = '#05070e';
  ctx.fillRect(0, 0, width, height);

  // Radial Neon Glow Orbs
  const glow1 = ctx.createRadialGradient(width * 0.35, height * 0.5, 20, width * 0.35, height * 0.5, 450);
  glow1.addColorStop(0, isToned ? 'rgba(71, 85, 105, 0.45)' : 'rgba(99, 102, 241, 0.28)');
  glow1.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, width, height);

  const glow2 = ctx.createRadialGradient(width * 0.85, height * 0.85, 20, width * 0.85, height * 0.85, 400);
  glow2.addColorStop(0, isToned ? 'rgba(100, 116, 139, 0.35)' : 'rgba(16, 185, 129, 0.22)');
  glow2.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, width, height);

  // Neon glowing outer border
  ctx.save();
  ctx.strokeStyle = isToned ? 'rgba(148, 163, 184, 0.35)' : 'rgba(99, 102, 241, 0.55)';
  ctx.lineWidth = 2.5;
  drawRoundedRect(ctx, 36, 36, width - 72, height - 72, 32);
  ctx.stroke();
  ctx.restore();

  const padX = isSquare ? 72 : 80;
  let cursorY = isSquare ? 90 : 84;
  const contentWidth = width - padX * 2;

  // Header: Neon Gradient Logo Box + LIVE BALLOT Pill
  ctx.save();
  // Logo Box
  drawRoundedRect(ctx, padX, cursorY, 40, 40, 14);
  const logoGrad = ctx.createLinearGradient(padX, cursorY, padX + 40, cursorY + 40);
  logoGrad.addColorStop(0, '#6366f1');
  logoGrad.addColorStop(0.5, '#a855f7');
  logoGrad.addColorStop(1, '#ec4899');
  ctx.fillStyle = logoGrad;
  ctx.fill();

  ctx.font = '900 15px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Y/N', padX + 7, cursorY + 25);

  ctx.font = '900 22px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('YesOrNo', padX + 52, cursorY + 28);

  // LIVE BALLOT Pill
  const liveLabel = '● LIVE BALLOT';
  ctx.font = '800 12px system-ui, -apple-system, sans-serif';
  const liveW = ctx.measureText(liveLabel).width + 28;
  const liveX = width - padX - liveW;

  drawRoundedRect(ctx, liveX, cursorY + 2, liveW, 36, 18);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#34d399';
  ctx.fillText('●', liveX + 12, cursorY + 24);
  ctx.fillStyle = '#f1f5f9';
  ctx.fillText('LIVE BALLOT', liveX + 26, cursorY + 24);
  ctx.restore();

  // Category Eyebrow in Neon
  cursorY += isSquare ? 96 : 80;
  ctx.save();
  ctx.font = '800 13px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#818cf8';
  ctx.fillText(`⚡ ${(issue.category || 'COMMUNITY').toUpperCase()}`, padX, cursorY);

  // Big Neon Question
  cursorY += 34;
  ctx.font = isSquare
    ? '900 46px system-ui, -apple-system, sans-serif'
    : '900 40px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#ffffff';

  const question = formatQuestion(issue.title);
  const titleLines = wrapText(ctx, question, contentWidth, isSquare ? 4 : 3);
  const titleLineHeight = isSquare ? 56 : 50;

  titleLines.forEach((line) => {
    ctx.fillText(line, padX, cursorY);
    cursorY += titleLineHeight;
  });
  ctx.restore();

  // Optional Description
  if (issue.description && issue.description.trim().length > 0 && !issue.isDeletedByAuthor) {
    cursorY += 8;
    ctx.save();
    ctx.font = '500 18px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(203, 213, 225, 0.85)';
    const descLines = wrapText(ctx, issue.description, contentWidth, isSquare ? 3 : 2);
    descLines.forEach((line) => {
      ctx.fillText(line, padX, cursorY);
      cursorY += 26;
    });
    ctx.restore();
  }

  // Neon Duel Badges (NO RESULTS / NO COUNTS)
  const duelY = isSquare ? height - 260 : height - 200;
  ctx.save();
  // Left Neon YES Badge
  drawRoundedRect(ctx, padX, duelY, 210, 52, 18);
  ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(52, 211, 153, 0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(padX + 24, duelY + 26, 6, 0, Math.PI * 2);
  ctx.fillStyle = '#34d399';
  ctx.fill();

  ctx.font = '900 22px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#34d399';
  ctx.fillText('VOTE YES', padX + 44, duelY + 34);

  // Right Neon NO Badge
  const noW = 210;
  const noX = width - padX - noW;
  drawRoundedRect(ctx, noX, duelY, noW, 52, 18);
  ctx.fillStyle = 'rgba(244, 63, 94, 0.15)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(251, 113, 133, 0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font = '900 22px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#fb7185';
  ctx.fillText('VOTE NO', noX + 32, duelY + 34);

  ctx.beginPath();
  ctx.arc(noX + noW - 24, duelY + 26, 6, 0, Math.PI * 2);
  ctx.fillStyle = '#fb7185';
  ctx.fill();

  // Glowing Bar Track
  const barY = duelY + 68;
  const barH = 14;
  const barW = contentWidth;

  drawRoundedRect(ctx, padX, barY, barW, barH, 7);
  ctx.fillStyle = '#0f172a';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Emerald Neon Half
  drawRoundedRect(ctx, padX + 2, barY + 2, (barW / 2) - 4, barH - 4, 5);
  ctx.fillStyle = '#10b981';
  ctx.fill();

  // Rose Neon Half
  drawRoundedRect(ctx, padX + (barW / 2) + 2, barY + 2, (barW / 2) - 4, barH - 4, 5);
  ctx.fillStyle = '#f43f5e';
  ctx.fill();
  ctx.restore();

  // Footer: Neon Pill
  const footerY = height - (isSquare ? 78 : 70);
  ctx.save();
  ctx.font = '600 14px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('Open Ballot • Fast 1-Min Voting', padX, footerY);

  const sharePayload = buildIssueSharePayload(issue);
  const displayHost = sharePayload.url.replace(/^https?:\/\//, '').split('/')[0] || 'yesorno.chillon.top';
  const urlLabel = `${displayHost}/${buildIssueSlug(issue).slice(0, 22)}... →`;

  ctx.font = '800 14px ui-monospace, SFMono-Regular, monospace';
  const badgeW = ctx.measureText(urlLabel).width;
  ctx.fillStyle = '#a78bfa';
  ctx.fillText(urlLabel, width - padX - badgeW, footerY);
  ctx.restore();
}

/**
 * Master Render Dispatcher for all 3 concepts
 */
export async function renderIssueCardToCanvas(
  issue: Issue,
  options: CardRenderOptions = {}
): Promise<HTMLCanvasElement> {
  const style = options.style || 'bold';
  const format = options.format || 'landscape';
  const isSquare = format === 'square';
  const isToned = options.colorTone === 'toned';

  const width = isSquare ? 1080 : 1200;
  const height = isSquare ? 1080 : 675;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  if (style === 'editorial') {
    renderEditorialSpotlight(ctx, issue, width, height, isSquare, isToned);
  } else if (style === 'neon') {
    renderMidnightNeon(ctx, issue, width, height, isSquare, isToned);
  } else {
    renderBoldDuelist(ctx, issue, width, height, isSquare, isToned);
  }

  return canvas;
}

/**
 * Converts the rendered canvas to a PNG Blob
 */
export async function generateIssueCardBlob(
  issue: Issue,
  options: CardRenderOptions = {}
): Promise<Blob> {
  const canvas = await renderIssueCardToCanvas(issue, options);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to generate PNG blob from canvas'));
    }, 'image/png');
  });
}

/**
 * Converts the rendered canvas to a base64 Data URL for instant in-browser preview
 */
export async function generateIssueCardDataUrl(
  issue: Issue,
  options: CardRenderOptions = {}
): Promise<string> {
  const canvas = await renderIssueCardToCanvas(issue, options);
  return canvas.toDataURL('image/png');
}

/**
 * Triggers a direct browser download of the high-res PNG image card
 */
export async function downloadIssueCard(
  issue: Issue,
  options: CardRenderOptions = {}
): Promise<string> {
  const blob = await generateIssueCardBlob(issue, options);
  const slug = buildIssueSlug(issue);
  const style = options.style || 'bold';
  const format = options.format || 'landscape';
  const filename = `yesorno-${slug}-${style}-${format}.png`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);

  return filename;
}

/**
 * Copies the PNG image directly to clipboard
 */
export async function copyIssueCardToClipboard(
  issue: Issue,
  options: CardRenderOptions = {}
): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard || typeof ClipboardItem === 'undefined') {
    return false;
  }
  try {
    const blob = await generateIssueCardBlob(issue, options);
    const item = new ClipboardItem({ 'image/png': blob });
    await navigator.clipboard.write([item]);
    return true;
  } catch (err) {
    console.warn('Clipboard image write failed:', err);
    return false;
  }
}

/**
 * Uses mobile Web Share API to share the PNG file directly
 */
export async function shareIssueCardFile(
  issue: Issue,
  options: CardRenderOptions = {}
): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.share || !navigator.canShare) {
    return false;
  }

  try {
    const blob = await generateIssueCardBlob(issue, options);
    const slug = buildIssueSlug(issue);
    const file = new File([blob], `yesorno-${slug}.png`, { type: 'image/png' });

    if (navigator.canShare({ files: [file] })) {
      const payload = buildIssueSharePayload(issue);
      await navigator.share({
        title: issue.title,
        text: `Vote YES or NO on YesOrNo: ${payload.url}`,
        files: [file],
      });
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
