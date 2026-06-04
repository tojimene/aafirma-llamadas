import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { CallAnalysis, Hallazgo } from "./analysis";

// Ancho útil de la página (A4, márgenes ~1000 dxa a cada lado).
const CONTENT_WIDTH = 9700;

// Paleta (branding AA Firma)
const ACCENT = "C9A66B";
const DARK = "1A1A1A";
const WHITE = "FFFFFF";
const MUTED = "6B6B6B";
const CARD_BG = "F7F5F0";
const ACCENT_BG = "F1E7CF";
const BORDER = "E4E0D6";
const RED = "B23A2E";
const RED_BG = "FBEAE7";
const GREEN = "2E7D52";
const GREEN_BG = "E9F5EE";

type Block = Paragraph | Table;

function scoreColor(score: number): string {
  if (score >= 75) return GREEN;
  if (score >= 50) return ACCENT;
  return RED;
}

// Barra de sección: tabla con celda oscura, texto blanco y filo dorado.
// (Se usa tabla y no párrafo porque el sombreado de celda se renderiza mejor.)
function sectionBar(title: string): Table {
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [CONTENT_WIDTH],
    layout: TableLayoutType.FIXED,
    borders: {
      ...noBorders,
      left: { style: BorderStyle.SINGLE, size: 28, color: ACCENT },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: CONTENT_WIDTH, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, color: "auto", fill: DARK },
            margins: { top: 90, bottom: 90, left: 200, right: 160 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: title.toUpperCase(),
                    bold: true,
                    size: 21,
                    color: WHITE,
                    characterSpacing: 18,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

// Añade una barra de sección con un pequeño espacio previo.
function pushSection(children: Block[], title: string) {
  children.push(spacer(160));
  children.push(sectionBar(title));
  children.push(spacer(60));
}

function line(
  label: string,
  value: string,
  labelColor = ACCENT,
  valueColor = DARK
): Paragraph {
  return new Paragraph({
    spacing: { after: 60 },
    children: [
      new TextRun({ text: `${label} `, bold: true, size: 19, color: labelColor }),
      new TextRun({ text: value || "—", size: 19, color: valueColor }),
    ],
  });
}

function bullet(text: string, color = DARK): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 50 },
    children: [new TextRun({ text, size: 19, color })],
  });
}

function ts(momento?: string): string {
  return momento && momento.trim() ? `[${momento.trim()}] ` : "";
}

// Línea con la cita textual de la llamada (en cursiva, sangrada).
function citaLine(cita?: string): Paragraph | null {
  if (!cita || !cita.trim()) return null;
  return new Paragraph({
    indent: { left: 200 },
    spacing: { after: 60 },
    children: [
      new TextRun({ text: `“${cita.trim()}”`, italics: true, size: 17, color: MUTED }),
    ],
  });
}

// Viñeta de hallazgo: [mm:ss] detalle + cita textual debajo.
function hallazgoBullet(h: Hallazgo): Paragraph[] {
  const out: Paragraph[] = [
    new Paragraph({
      bullet: { level: 0 },
      spacing: { after: h.cita?.trim() ? 20 : 50 },
      children: [
        ...(ts(h.momento)
          ? [new TextRun({ text: ts(h.momento), bold: true, size: 18, color: ACCENT })]
          : []),
        new TextRun({ text: h.detalle || "—", size: 18, color: DARK }),
      ],
    }),
  ];
  const c = citaLine(h.cita);
  if (c) out.push(c);
  return out;
}

function spacer(size = 80): Paragraph {
  return new Paragraph({ spacing: { after: size }, children: [] });
}

function emptyNote(): Paragraph {
  return new Paragraph({
    spacing: { after: 60 },
    children: [
      new TextRun({ text: "— Sin elementos —", italics: true, size: 18, color: MUTED }),
    ],
  });
}

const noBorders = {
  top: { style: BorderStyle.NONE, size: 0, color: "auto" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
  left: { style: BorderStyle.NONE, size: 0, color: "auto" },
  right: { style: BorderStyle.NONE, size: 0, color: "auto" },
  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" },
  insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
};

// Tarjeta: tabla de una celda con fondo y padding.
function card(children: Paragraph[], fill = CARD_BG): Table {
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [CONTENT_WIDTH],
    layout: TableLayoutType.FIXED,
    borders: noBorders,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: CONTENT_WIDTH, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, color: "auto", fill },
            margins: { top: 140, bottom: 140, left: 200, right: 200 },
            children,
          }),
        ],
      }),
    ],
  });
}

type ReportMeta = {
  title: string;
  analystName?: string;
  date: Date;
};

// Genera el informe .docx visual a partir del análisis. Devuelve un Buffer.
export async function buildReportDocx(
  analysis: CallAnalysis,
  meta: ReportMeta
): Promise<Buffer> {
  const fechaStr = meta.date.toLocaleString("es-ES", {
    dateStyle: "long",
    timeStyle: "short",
  });

  const children: Block[] = [];

  // ---- Cabecera ----
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 30 },
      children: [
        new TextRun({
          text: "ALVARADO ABREU FIRMA & CO.",
          bold: true,
          size: 18,
          color: MUTED,
          characterSpacing: 40,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: "Informe de Análisis de Llamada",
          bold: true,
          size: 40,
          color: DARK,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 20 },
      children: [
        new TextRun({ text: meta.title, size: 22, color: ACCENT, bold: true }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 220 },
      children: [
        new TextRun({
          text: `${fechaStr}${meta.analystName ? ` · ${meta.analystName}` : ""}`,
          size: 17,
          color: MUTED,
        }),
      ],
    })
  );

  // ---- Cabecera con puntuación (tabla 2 columnas) ----
  children.push(
    new Table({
      width: { size: CONTENT_WIDTH, type: WidthType.DXA },
      layout: TableLayoutType.FIXED,
      borders: noBorders,
      columnWidths: [3100, 6600],
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 3100, type: WidthType.DXA },
              shading: { type: ShadingType.CLEAR, color: "auto", fill: DARK },
              margins: { top: 200, bottom: 200, left: 160, right: 160 },
              verticalAlign: "center",
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: `${analysis.puntuacionGlobal}`,
                      bold: true,
                      size: 64,
                      color: scoreColor(analysis.puntuacionGlobal),
                    }),
                    new TextRun({ text: " /100", size: 22, color: WHITE }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: "PUNTUACIÓN",
                      size: 15,
                      color: "BFBFBF",
                      characterSpacing: 30,
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 6600, type: WidthType.DXA },
              shading: { type: ShadingType.CLEAR, color: "auto", fill: CARD_BG },
              margins: { top: 200, bottom: 200, left: 200, right: 200 },
              verticalAlign: "center",
              children: [
                line("Resultado probable:", analysis.resultadoProbable),
                new Paragraph({
                  spacing: { before: 40 },
                  children: [
                    new TextRun({ text: analysis.resumen || "—", size: 19, color: DARK }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );

  // ---- Línea de tiempo ----
  if (analysis.lineaTiempo?.length) {
    pushSection(children, "Línea de tiempo · qué pasa en cada momento");
    children.push(
      new Table({
        width: { size: CONTENT_WIDTH, type: WidthType.DXA },
        layout: TableLayoutType.FIXED,
        columnWidths: [1300, 8400],
        borders: {
          ...noBorders,
          insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
        },
        rows: analysis.lineaTiempo.map(
          (t) =>
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 1300, type: WidthType.DXA },
                  shading: { type: ShadingType.CLEAR, color: "auto", fill: DARK },
                  margins: { top: 80, bottom: 80, left: 100, right: 100 },
                  verticalAlign: "center",
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new TextRun({
                          text: t.momento?.trim() || "—",
                          bold: true,
                          size: 18,
                          color: ACCENT,
                        }),
                      ],
                    }),
                  ],
                }),
                new TableCell({
                  width: { size: 8400, type: WidthType.DXA },
                  margins: { top: 80, bottom: 80, left: 160, right: 160 },
                  verticalAlign: "center",
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({ text: t.evento, size: 19, color: DARK }),
                      ],
                    }),
                  ],
                }),
              ],
            })
        ),
      })
    );
  }

  // ---- Prioridades 80/20 ----
  pushSection(children, "Prioridades 80/20 · lo que más mejora la llamada");
  if (analysis.prioridades.length) {
    analysis.prioridades.forEach((p, i) => {
      const paras: Paragraph[] = [
        new Paragraph({
          spacing: { after: 60 },
          children: [
            ...(ts(p.momento)
              ? [new TextRun({ text: ts(p.momento), bold: true, size: 20, color: GREEN })]
              : []),
            new TextRun({
              text: `${i + 1}. ${p.titulo}`,
              bold: true,
              size: 22,
              color: DARK,
            }),
          ],
        }),
        line("Por qué:", p.porque),
        line("Acción:", p.accion, GREEN),
      ];
      const c = citaLine(p.cita);
      if (c) paras.push(c);
      children.push(card(paras, ACCENT_BG));
      children.push(spacer());
    });
  } else {
    children.push(emptyNote());
  }

  // ---- Errores por fase (3 columnas) ----
  pushSection(children, "Errores por fase");
  const phaseCell = (titulo: string, items: Hallazgo[]) =>
    new TableCell({
      width: { size: 3233, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, color: "auto", fill: CARD_BG },
      margins: { top: 140, bottom: 140, left: 140, right: 140 },
      children: [
        new Paragraph({
          spacing: { after: 80 },
          children: [
            new TextRun({ text: titulo.toUpperCase(), bold: true, size: 17, color: ACCENT, characterSpacing: 14 }),
          ],
        }),
        ...(items.length
          ? items.flatMap((h) => hallazgoBullet(h))
          : [emptyNote()]),
      ],
    });

  children.push(
    new Table({
      width: { size: CONTENT_WIDTH, type: WidthType.DXA },
      layout: TableLayoutType.FIXED,
      columnWidths: [3233, 3233, 3234],
      borders: {
        ...noBorders,
        insideVertical: { style: BorderStyle.SINGLE, size: 12, color: WHITE },
      },
      rows: [
        new TableRow({
          children: [
            phaseCell("Sondeo", analysis.erroresSondeo),
            phaseCell("Pitch", analysis.erroresPitch),
            phaseCell("Objeciones", analysis.erroresObjeciones),
          ],
        }),
      ],
    })
  );

  // ---- Rebate de objeciones ----
  pushSection(children, "Rebate de objeciones");
  if (analysis.rebateObjeciones.length) {
    analysis.rebateObjeciones.forEach((o) => {
      const paras: Paragraph[] = [
        new Paragraph({
          spacing: { after: 60 },
          children: [
            ...(ts(o.momento)
              ? [new TextRun({ text: ts(o.momento), bold: true, size: 18, color: ACCENT })]
              : []),
            new TextRun({ text: "Objeción: ", bold: true, size: 19, color: DARK }),
            new TextRun({ text: o.objecion, size: 19, color: DARK, italics: true }),
          ],
        }),
      ];
      const c = citaLine(o.cita);
      if (c) paras.push(c);
      paras.push(line("✗ Cómo se manejó:", o.manejoActual, RED, MUTED));
      paras.push(line("✓ Rebate recomendado:", o.rebateRecomendado, GREEN, DARK));
      children.push(card(paras));
      children.push(spacer());
    });
  } else {
    children.push(emptyNote());
  }

  // ---- Red flags ----
  pushSection(children, "Red flags · oportunidades de mejora");
  if (analysis.redFlags.length) {
    analysis.redFlags.forEach((r) => {
      const paras: Paragraph[] = [
        new Paragraph({
          spacing: { after: 40 },
          children: [
            new TextRun({ text: "⚑ ", bold: true, size: 20, color: RED }),
            ...(ts(r.momento)
              ? [new TextRun({ text: ts(r.momento), bold: true, size: 18, color: RED })]
              : []),
            new TextRun({ text: r.flag, bold: true, size: 19, color: RED }),
          ],
        }),
      ];
      const c = citaLine(r.cita);
      if (c) paras.push(c);
      paras.push(
        new Paragraph({
          children: [
            new TextRun({ text: "→ ", size: 18, color: MUTED }),
            new TextRun({ text: r.oportunidad, size: 18, color: DARK }),
          ],
        })
      );
      children.push(card(paras, RED_BG));
      children.push(spacer(60));
    });
  } else {
    children.push(emptyNote());
  }

  // ---- Secciones según la estructura de la firma ----
  if (analysis.seccionesPersonalizadas?.length) {
    pushSection(children, "Informe según la estructura de la firma");
    analysis.seccionesPersonalizadas.forEach((s) => {
      const paras: Paragraph[] = [
        new Paragraph({
          spacing: { after: 60 },
          children: [
            new TextRun({ text: s.titulo, bold: true, size: 20, color: DARK }),
          ],
        }),
      ];
      s.contenido
        .split(/\n+/)
        .map((l) => l.trim())
        .filter(Boolean)
        .forEach((l) => {
          // Si parece una viñeta, la mostramos como tal.
          const clean = l.replace(/^[-•*]\s*/, "");
          paras.push(bullet(clean));
        });
      children.push(card(paras, GREEN_BG));
      children.push(spacer());
    });
  }

  // ---- Pie ----
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 360 },
      border: { top: { style: BorderStyle.SINGLE, size: 6, color: BORDER, space: 8 } },
      children: [
        new TextRun({
          text: "Documento generado automáticamente · Uso interno · Alvarado Abreu Firma & Co.",
          size: 15,
          color: MUTED,
          italics: true,
        }),
      ],
    })
  );

  const doc = new Document({
    creator: "AA Firma · Análisis de Llamadas",
    title: meta.title,
    sections: [
      {
        properties: {
          page: { margin: { top: 900, bottom: 900, left: 1000, right: 1000 } },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
