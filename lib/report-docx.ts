import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { CallAnalysis } from "./analysis";

const ACCENT = "C9A66B";
const DARK = "1A1A1A";
const MUTED = "6B6B6B";

function heading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 280, after: 120 },
    border: { bottom: { color: ACCENT, size: 6, style: BorderStyle.SINGLE, space: 4 } },
    children: [
      new TextRun({ text: text.toUpperCase(), bold: true, size: 26, color: DARK }),
    ],
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 60 },
    children: [new TextRun({ text, size: 22, color: DARK })],
  });
}

function body(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, size: 22, color: DARK })],
  });
}

function emptyState(): Paragraph {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text: "— Sin elementos —", italics: true, size: 20, color: MUTED })],
  });
}

type ReportMeta = {
  title: string;
  analystName?: string;
  date: Date;
};

// Genera el informe .docx a partir del análisis. Devuelve un Buffer.
export async function buildReportDocx(
  analysis: CallAnalysis,
  meta: ReportMeta
): Promise<Buffer> {
  const fechaStr = meta.date.toLocaleString("es-ES", {
    dateStyle: "long",
    timeStyle: "short",
  });

  const children: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [
        new TextRun({ text: "ALVARADO ABREU FIRMA & CO.", bold: true, size: 20, color: MUTED, characterSpacing: 40 }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.TITLE,
      spacing: { after: 80 },
      children: [
        new TextRun({ text: "Informe de Análisis de Llamada", bold: true, size: 44, color: DARK }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [new TextRun({ text: meta.title, size: 24, color: ACCENT, bold: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: `${fechaStr}${meta.analystName ? ` · Analista: ${meta.analystName}` : ""}`,
          size: 18,
          color: MUTED,
        }),
      ],
    }),

    // Puntuación global destacada
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [
        new TextRun({ text: `${analysis.puntuacionGlobal}`, bold: true, size: 72, color: ACCENT }),
        new TextRun({ text: " / 100", size: 28, color: MUTED }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [
        new TextRun({ text: `Sentimiento del cliente: ${analysis.sentimientoCliente}   ·   Resultado probable: ${analysis.resultadoProbable}`, size: 20, color: DARK }),
      ],
    }),

    heading("Resumen ejecutivo"),
    body(analysis.resumen || "—"),
  ];

  // Fases
  children.push(heading("Evaluación por fases"));
  if (analysis.fases.length) {
    analysis.fases.forEach((f) => {
      children.push(
        new Paragraph({
          spacing: { before: 80, after: 20 },
          children: [
            new TextRun({ text: `${f.fase} — ${f.puntuacion}/100`, bold: true, size: 22, color: DARK }),
          ],
        })
      );
      children.push(body(f.comentario));
    });
  } else {
    children.push(emptyState());
  }

  const listSection = (title: string, items: string[]) => {
    children.push(heading(title));
    if (items.length) items.forEach((i) => children.push(bullet(i)));
    else children.push(emptyState());
  };

  listSection("Fortalezas", analysis.fortalezas);
  listSection("Debilidades", analysis.debilidades);
  listSection("Oportunidades de mejora", analysis.oportunidadesMejora);
  listSection("Objeciones detectadas", analysis.objecionesDetectadas);

  // Frases destacadas
  children.push(heading("Frases destacadas"));
  if (analysis.frasesDestacadas.length) {
    analysis.frasesDestacadas.forEach((f) => {
      children.push(
        new Paragraph({
          spacing: { before: 60, after: 10 },
          children: [new TextRun({ text: `"${f.cita}"`, italics: true, size: 22, color: ACCENT })],
        })
      );
      children.push(body(f.comentario));
    });
  } else {
    children.push(emptyState());
  }

  listSection("Recomendaciones accionables", analysis.recomendacionesAccionables);
  listSection("Preparación para la próxima llamada", analysis.proximaLlamada);

  // Secciones según la estructura del informe definida por la firma.
  if (analysis.seccionesPersonalizadas?.length) {
    children.push(
      new Paragraph({
        spacing: { before: 360, after: 80 },
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: "INFORME SEGÚN ESTRUCTURA DE LA FIRMA",
            bold: true,
            size: 22,
            color: ACCENT,
            characterSpacing: 30,
          }),
        ],
      })
    );
    analysis.seccionesPersonalizadas.forEach((s) => {
      children.push(heading(s.titulo));
      // Respetar saltos de línea del contenido generado.
      s.contenido.split(/\n+/).forEach((para) => {
        if (para.trim()) children.push(body(para.trim()));
      });
    });
  }

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 400 },
      children: [
        new TextRun({
          text: "Documento generado automáticamente · Uso interno · Alvarado Abreu Firma & Co.",
          size: 16,
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
        properties: { page: { margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
