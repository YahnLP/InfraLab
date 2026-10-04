const d = require('docx');
const { Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, AlignmentType, HeadingLevel, LevelFormat, PageBreak, Header, Footer, PageNumber, TableOfContents, VerticalAlign } = d;
const W = 9026; const ACC = '1F4E79', LIGHT = 'EAF1F8', WARM = 'FFF4DC', GREEN = 'E6F4EA', GREY = 'F2F2F2';
const FONT = 'Calibri';

function runs(text, base = {}) {
  const out = []; const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g; let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(new TextRun({ text: text.slice(last, m.index), ...base }));
    const t = m[0];
    if (t.startsWith('**')) out.push(new TextRun({ text: t.slice(2, -2), bold: true, ...base }));
    else if (t.startsWith('`')) out.push(new TextRun({ text: t.slice(1, -1), font: 'Consolas', size: 20, ...base }));
    else out.push(new TextRun({ text: t.slice(1, -1), italics: true, ...base }));
    last = m.index + t.length;
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), ...base }));
  return out;
}
const P = (text, o = {}) => new Paragraph({ children: runs(text, o.run), spacing: { after: o.after ?? 120, before: o.before ?? 0, line: 276 }, alignment: o.align, keepNext: o.keepNext, indent: o.indent, shading: o.shading, border: o.border });
const H1 = (t, pb = true) => new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: pb, children: [new TextRun(t)] });
const H2 = t => new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, children: [new TextRun(t)] });
const H3 = t => new Paragraph({ heading: HeadingLevel.HEADING_3, keepNext: true, children: [new TextRun(t)] });
const B = (t, lvl = 0) => new Paragraph({ numbering: { reference: 'bul', level: lvl }, children: runs(t), spacing: { after: 60, line: 276 } });
const N = (t, ref = 'num') => new Paragraph({ numbering: { reference: ref, level: 0 }, children: runs(t), spacing: { after: 60, line: 276 } });
const PB = () => new Paragraph({ children: [new PageBreak()] });
const space = (n = 120) => new Paragraph({ spacing: { after: n }, children: [] });
const border = (c = 'BFBFBF') => ({ style: BorderStyle.SINGLE, size: 4, color: c });
const borders = c => ({ top: border(c), bottom: border(c), left: border(c), right: border(c) });
const cellMargins = { top: 70, bottom: 70, left: 110, right: 110 };

function cell(content, w, o = {}) {
  const paras = (Array.isArray(content) ? content : [content]).map(x => typeof x === 'string' ? P(x, { after: 40, run: o.run }) : x);
  return new TableCell({ width: { size: w, type: WidthType.DXA }, borders: borders(o.bc), margins: cellMargins, verticalAlign: o.v ?? VerticalAlign.TOP,
    shading: o.fill ? { fill: o.fill, type: ShadingType.CLEAR, color: 'auto' } : undefined, children: paras });
}
function table({ head, rows, widths, headFill = ACC }) {
  const tot = widths.reduce((a, b) => a + b, 0);
  const hr = head ? [new TableRow({ tableHeader: true, cantSplit: true, children: head.map((h, i) => cell(P(h, { after: 0, run: { bold: true, color: 'FFFFFF' } }), widths[i], { fill: headFill, bc: headFill })) })] : [];
  const body = rows.map(r => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, widths[i], { fill: i === 0 && head ? GREY : undefined })) }));
  return new Table({ width: { size: tot, type: WidthType.DXA }, columnWidths: widths, rows: [...hr, ...body] });
}
// Encadré (une cellule teintée)
function box(title, items, fill = LIGHT, bc = ACC) {
  const ch = [];
  if (title) ch.push(P(title, { after: 60, run: { bold: true, color: bc } }));
  for (const it of items) ch.push(typeof it === 'string' ? P(it, { after: 60 }) : it);
  return new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [W], rows: [new TableRow({ children: [new TableCell({ width: { size: W, type: WidthType.DXA }, borders: { top: border(bc), bottom: border(bc), right: border(bc), left: { style: BorderStyle.SINGLE, size: 24, color: bc } }, margins: { top: 100, bottom: 100, left: 160, right: 140 }, shading: { fill, type: ShadingType.CLEAR, color: 'auto' }, children: ch })] })] });
}
const lines = (n = 3) => Array.from({ length: n }, () => new Paragraph({ spacing: { before: 200, after: 0 }, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'A6A6A6', space: 1 } }, children: [] }));

const numbering = { config: [
  { reference: 'bul', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }, { level: 1, format: LevelFormat.BULLET, text: '–', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1000, hanging: 270 } } } }] },
  ...Array.from({ length: 80 }, (_, i) => ({ reference: 'num' + i, levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 360 } } } }] })),
] };

function doc(title, subtitle, children) {
  return new d.Document({
    creator: 'InfraLab', title, description: subtitle, numbering,
    styles: {
      default: { document: { run: { font: FONT, size: 22 } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 36, bold: true, font: FONT, color: ACC }, paragraph: { spacing: { before: 240, after: 200 }, outlineLevel: 0, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: ACC, space: 4 } } } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 28, bold: true, font: FONT, color: ACC }, paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 1 } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 24, bold: true, font: FONT, color: '404040' }, paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 2 } },
      ] },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1300, bottom: 1200, left: 1440, right: 1440 } }, titlePage: true },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: title, size: 18, color: '7F7F7F' })] })] }), first: new Header({ children: [new Paragraph({ children: [] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'InfraLab — simulateur ITSM/ITAM indépendant · page ', size: 18, color: '7F7F7F' }), new TextRun({ children: [PageNumber.CURRENT], size: 18, color: '7F7F7F' })] })] }), first: new Footer({ children: [new Paragraph({ children: [] })] }) },
      children,
    }],
  });
}
function cover(title, sub, lines2) {
  return [
    new Paragraph({ spacing: { before: 2800, after: 200 }, children: [new TextRun({ text: 'InfraLab', size: 28, bold: true, color: '7F7F7F' })] }),
    new Paragraph({ spacing: { after: 160 }, border: { bottom: { style: BorderStyle.SINGLE, size: 24, color: ACC, space: 10 } }, children: [new TextRun({ text: title, size: 64, bold: true, color: ACC })] }),
    new Paragraph({ spacing: { before: 200, after: 600 }, children: [new TextRun({ text: sub, size: 30, color: '404040' })] }),
    ...lines2.map(l => P(l, { after: 80, run: { color: '404040' } })),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}
const toc = items => [new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: 'Sommaire', size: 36, bold: true, color: ACC })] }), ...items.map(([t, lvl]) => new Paragraph({ spacing: { after: lvl ? 40 : 100, before: lvl ? 0 : 120 }, indent: { left: lvl ? 500 : 0 }, children: [new TextRun({ text: t, bold: !lvl, size: lvl ? 22 : 24, color: lvl ? '404040' : ACC })] })), new Paragraph({ children: [new PageBreak()] })];

module.exports = { d, W, ACC, LIGHT, WARM, GREEN, GREY, P, H1, H2, H3, B, N, PB, space, table, box, cell, lines, doc, cover, toc, runs };
