import { Issue } from '../types';
import { buildIssueSlug, buildIssueSharePayload } from './share';

export type CardFormat = 'landscape' | 'square';

export interface CardRenderOptions {
  format?: CardFormat;
  colorTone?: 'vibrant' | 'toned';
}

/**
 * Helper to wrap text cleanly within a maximum width and line count
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
        // Last allowed line: append remaining text with ellipsis if it overflows
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
 * Fallback-safe rounded rectangle helper
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
 * Generates an HTML5 Canvas drawing of a marketing-ready, high-resolution issue card
 */
export async function renderIssueCardToCanvas(
  issue: Issue,
  options: CardRenderOptions = {}
): Promise<HTMLCanvasElement> {
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

  // Base Obsidian / Aurora Dark Background
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  if (isToned) {
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(0.5, '#1e293b');
    bgGrad.addColorStop(1, '#090d16');
  } else {
    bgGrad.addColorStop(0, '#090d16');
    bgGrad.addColorStop(0.35, '#0b1329');
    bgGrad.addColorStop(0.75, '#111827');
    bgGrad.addColorStop(1, '#050811');
  }
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Aurora Glow Orbs
  const glow1 = ctx.createRadialGradient(width * 0.85, height * 0.15, 20, width * 0.85, height * 0.15, 380);
  glow1.addColorStop(0, isToned ? 'rgba(71, 85, 105, 0.45)' : 'rgba(99, 102, 241, 0.28)');
  glow1.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, width, height);

  const glow2 = ctx.createRadialGradient(width * 0.1, height * 0.85, 20, width * 0.1, height * 0.85, 420);
  glow2.addColorStop(0, isToned ? 'rgba(100, 116, 139, 0.35)' : 'rgba(16, 185, 129, 0.20)');
  glow2.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, width, height);

  // Subtle grid texture overlay
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.lineWidth = 1;
  const gridSize = 40;
  for (let x = 0; x < width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();

  // Outer Card Glass Border
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, 36, 36, width - 72, height - 72, 32);
  ctx.stroke();
  ctx.restore();

  const padX = isSquare ? 72 : 80;
  let cursorY = isSquare ? 86 : 84;

  // 1. HEADER ROW: Brand Badge & Category Pill
  // App Brand Logo Pill
  ctx.save();
  drawRoundedRect(ctx, padX, cursorY, 210, 48, 16);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // YesOrNo Icon Badge (Check / Cross dual icon)
  drawRoundedRect(ctx, padX + 8, cursorY + 8, 32, 32, 10);
  const iconGrad = ctx.createLinearGradient(padX + 8, cursorY + 8, padX + 40, cursorY + 40);
  iconGrad.addColorStop(0, '#10b981'); // Emerald
  iconGrad.addColorStop(1, '#6366f1'); // Indigo
  ctx.fillStyle = iconGrad;
  ctx.fill();

  // Mini Checkmark inside icon badge
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(padX + 17, cursorY + 24);
  ctx.lineTo(padX + 22, cursorY + 29);
  ctx.lineTo(padX + 31, cursorY + 18);
  ctx.stroke();

  // Brand Name
  ctx.font = '800 22px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('YesOrNo', padX + 50, cursorY + 32);
  ctx.restore();

  // Category & Live Badge (Right aligned)
  ctx.save();
  const categoryText = (issue.category || 'Public Issue').toUpperCase();
  ctx.font = '700 13px system-ui, -apple-system, sans-serif';
  const catWidth = ctx.measureText(categoryText).width + 36;
  const catX = width - padX - catWidth;

  drawRoundedRect(ctx, catX, cursorY + 4, catWidth, 40, 14);
  ctx.fillStyle = isToned ? 'rgba(71, 85, 105, 0.25)' : 'rgba(99, 102, 241, 0.18)';
  ctx.fill();
  ctx.strokeStyle = isToned ? 'rgba(148, 163, 184, 0.3)' : 'rgba(129, 140, 248, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Pulsing dot
  ctx.beginPath();
  ctx.arc(catX + 16, cursorY + 24, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = '#34d399';
  ctx.fill();

  ctx.fillStyle = isToned ? '#cbd5e1' : '#a5b4fc';
  ctx.fillText(categoryText, catX + 27, cursorY + 29);
  ctx.restore();

  // 2. MAIN ISSUE QUESTION
  cursorY += isSquare ? 110 : 96;
  const contentWidth = width - padX * 2;

  ctx.save();
  ctx.font = isSquare 
    ? '800 44px system-ui, -apple-system, sans-serif'
    : '800 38px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#ffffff';

  // Format question with trailing '?' if missing
  let rawTitle = issue.title.trim();
  if (!rawTitle.endsWith('?')) {
    rawTitle = `${rawTitle}?`;
  }

  const titleLines = wrapText(ctx, rawTitle, contentWidth, isSquare ? 4 : 3);
  const titleLineHeight = isSquare ? 54 : 48;

  titleLines.forEach((line) => {
    ctx.fillText(line, padX, cursorY);
    cursorY += titleLineHeight;
  });
  ctx.restore();

  // 3. OPTIONAL DESCRIPTION
  if (issue.description && issue.description.trim().length > 0 && !issue.isDeletedByAuthor) {
    cursorY += 6;
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

  // 4. VOTING DUEL & LIVE STANDINGS CARD
  const totalVotes = issue.yesCount + issue.noCount;
  const yesPct = totalVotes > 0 ? Math.round((issue.yesCount / totalVotes) * 100) : 50;
  const noPct = 100 - yesPct;

  const duelCardY = isSquare ? height - 340 : height - 260;
  const duelCardH = isSquare ? 170 : 126;

  ctx.save();
  drawRoundedRect(ctx, padX, duelCardY, contentWidth, duelCardH, 24);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Split Standings: YES (Left) vs NO (Right)
  const duelInnerPad = 24;
  const duelContentY = duelCardY + (isSquare ? 48 : 42);

  // YES Pill / Text
  ctx.font = '800 32px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#10b981'; // Emerald
  ctx.fillText(`YES  ${yesPct}%`, padX + duelInnerPad, duelContentY);

  ctx.font = '600 14px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.fillText(`(${issue.yesCount.toLocaleString()} votes)`, padX + duelInnerPad + 180, duelContentY - 2);

  // NO Pill / Text (Right aligned)
  ctx.font = '800 32px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#f43f5e'; // Rose
  const noText = `${noPct}%  NO`;
  const noWidth = ctx.measureText(noText).width;
  ctx.fillText(noText, width - padX - duelInnerPad - noWidth, duelContentY);

  ctx.font = '600 14px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  const noVotesText = `(${issue.noCount.toLocaleString()} votes)`;
  const noVotesWidth = ctx.measureText(noVotesText).width;
  ctx.fillText(noVotesText, width - padX - duelInnerPad - noWidth - noVotesWidth - 14, duelContentY - 2);

  // Dual Progress Bar
  const barY = duelContentY + (isSquare ? 26 : 22);
  const barW = contentWidth - duelInnerPad * 2;
  const barH = 14;
  const barRadius = 7;

  // Background track
  drawRoundedRect(ctx, padX + duelInnerPad, barY, barW, barH, barRadius);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.fill();

  // Emerald YES portion
  const yesBarW = Math.max(barRadius * 2, Math.min(barW, Math.round((barW * yesPct) / 100)));
  drawRoundedRect(ctx, padX + duelInnerPad, barY, yesBarW, barH, barRadius);
  const yesGrad = ctx.createLinearGradient(padX + duelInnerPad, barY, padX + duelInnerPad + yesBarW, barY);
  yesGrad.addColorStop(0, '#059669');
  yesGrad.addColorStop(1, '#10b981');
  ctx.fillStyle = yesGrad;
  ctx.fill();

  // Rose NO portion
  const noBarW = Math.max(0, barW - yesBarW);
  if (noBarW > 0) {
    drawRoundedRect(ctx, padX + duelInnerPad + yesBarW - 2, barY, noBarW + 2, barH, barRadius);
    const noGrad = ctx.createLinearGradient(padX + duelInnerPad + yesBarW, barY, padX + duelInnerPad + barW, barY);
    noGrad.addColorStop(0, '#e11d48');
    noGrad.addColorStop(1, '#f43f5e');
    ctx.fillStyle = noGrad;
    ctx.fill();
  }

  // Dual Card Subtitle info (Total votes + deadline)
  if (isSquare) {
    ctx.font = '600 13px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(226, 232, 240, 0.75)';
    ctx.fillText(
      `⚡ ${totalVotes.toLocaleString()} Total Votes Cast  •  ${issue.durationLabel || 'Active Ballot'}`,
      padX + duelInnerPad,
      barY + 34
    );
  }
  ctx.restore();

  // 5. MARKETING & CALL-TO-ACTION FOOTER
  const footerY = height - (isSquare ? 84 : 76);

  ctx.save();
  // Action Prompt text
  ctx.font = '700 16px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Cast your vote & see live community perspectives →', padX, footerY);

  ctx.font = '500 13px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(148, 163, 184, 0.9)';
  ctx.fillText('Make your voice heard in under 1 min', padX, footerY + 22);

  // Link Badge on the right
  const sharePayload = buildIssueSharePayload(issue);
  const displayHost = sharePayload.url.replace(/^https?:\/\//, '').split('/')[0] || 'yesorno.chillon.top';
  const linkLabel = `${displayHost}/${buildIssueSlug(issue).slice(0, 24)}...`;

  ctx.font = '700 14px ui-monospace, SFMono-Regular, monospace';
  const badgeW = ctx.measureText(linkLabel).width + 42;
  const badgeX = width - padX - badgeW;
  const badgeY = footerY - 14;

  drawRoundedRect(ctx, badgeX, badgeY, badgeW, 40, 12);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Mini Globe icon dot
  ctx.beginPath();
  ctx.arc(badgeX + 18, badgeY + 20, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#60a5fa';
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.fillText(linkLabel, badgeX + 32, badgeY + 25);
  ctx.restore();

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
  const filename = `yesorno-${slug}-${options.format || 'landscape'}.png`;

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
 * Copies the PNG image directly to clipboard for 1-click paste into WhatsApp Web, Telegram, Twitter, Discord, etc.
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
 * Uses mobile Web Share API to share the PNG file directly into WhatsApp, Instagram, Messages, or X
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
        text: `${issue.title}\n\nVote YES or NO on YesOrNo: ${payload.url}`,
        files: [file],
      });
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
