import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import React from "react";
import type { CallAnalysis, Hallazgo } from "./analysis";

// Paleta (branding AA Firma)
const ACCENT = "#C9A66B";
const DARK = "#1A1A1A";
const WHITE = "#FFFFFF";
const MUTED = "#6B6B6B";
const CARD_BG = "#F7F5F0";
const ACCENT_BG = "#F1E7CF";
const RED = "#B23A2E";
const RED_BG = "#FBEAE7";
const GREEN = "#2E7D52";

function scoreColor(score: number): string {
  if (score >= 75) return GREEN;
  if (score >= 50) return ACCENT;
  return RED;
}

const styles = StyleSheet.create({
  page: {
    paddingVertical: 36,
    paddingHorizontal: 40,
    fontSize: 10,
    color: DARK,
    fontFamily: "Helvetica",
    lineHeight: 1.4,
  },
  brand: {
    textAlign: "center",
    fontSize: 8,
    letterSpacing: 2,
    color: MUTED,
    fontWeight: "bold",
  },
  title: {
    textAlign: "center",
    fontSize: 22,
    marginTop: 4,
    color: DARK,
    fontWeight: "bold",
  },
  subtitle: {
    textAlign: "center",
    fontSize: 11,
    marginTop: 4,
    color: ACCENT,
    fontWeight: "bold",
  },
  meta: { textAlign: "center", fontSize: 8.5, marginTop: 4, color: MUTED },
  scoreRow: { flexDirection: "row", marginTop: 16 },
  scoreBox: {
    width: 120,
    backgroundColor: DARK,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreNum: { fontSize: 34, fontWeight: "bold" },
  scoreSlash: { fontSize: 11, color: WHITE },
  scoreLabel: { fontSize: 7, color: "#BFBFBF", letterSpacing: 2, marginTop: 6 },
  scoreInfo: { flex: 1, backgroundColor: CARD_BG, padding: 12, justifyContent: "center" },
  sectionBar: {
    backgroundColor: DARK,
    borderLeftWidth: 4,
    borderLeftColor: ACCENT,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 18,
    marginBottom: 8,
  },
  sectionText: {
    color: WHITE,
    fontSize: 10.5,
    letterSpacing: 1.5,
    fontWeight: "bold",
  },
  card: { backgroundColor: CARD_BG, padding: 10, marginBottom: 8, borderRadius: 3 },
  cardTitle: { fontSize: 11.5, fontWeight: "bold", color: DARK, marginBottom: 4 },
  label: { fontWeight: "bold" },
  cita: { fontStyle: "italic", color: MUTED, fontSize: 8.5, marginLeft: 8, marginVertical: 2 },
  bulletRow: { flexDirection: "row", marginBottom: 3 },
  bulletDot: { width: 10, fontSize: 9 },
  bulletText: { flex: 1, fontSize: 9 },
  errorsRow: { flexDirection: "row" },
  errorCol: { flex: 1, backgroundColor: CARD_BG, padding: 8, marginRight: 4 },
  errorColLast: { flex: 1, backgroundColor: CARD_BG, padding: 8 },
  colTitle: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: ACCENT,
    letterSpacing: 1,
    marginBottom: 5,
  },
  footer: {
    marginTop: 24,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: "#E4E0D6",
    textAlign: "center",
    fontSize: 8,
    fontStyle: "italic",
    color: MUTED,
  },
  empty: { fontSize: 8.5, fontStyle: "italic", color: MUTED },
  timelineRow: {
    flexDirection: "row",
    marginBottom: 3,
    alignItems: "flex-start",
  },
  timelineTime: {
    width: 48,
    fontSize: 9,
    fontWeight: "bold",
    color: ACCENT,
  },
  timelineEvent: { flex: 1, fontSize: 9 },
});

const tsText = (m?: string) => (m && m.trim() ? `[${m.trim()}] ` : "");

function Cita({ cita }: { cita?: string }) {
  if (!cita || !cita.trim()) return null;
  return <Text style={styles.cita}>{`\u00AB${cita.trim()}\u00BB`}</Text>;
}

function HallazgoBullets({ items }: { items: Hallazgo[] }) {
  if (!items.length) return <Text style={styles.empty}>Sin elementos.</Text>;
  return (
    <View>
      {items.map((h, i) => (
        <View key={i} style={{ marginBottom: 4 }}>
          <View style={styles.bulletRow}>
            <Text style={styles.bulletDot}>{"\u2022"}</Text>
            <Text style={styles.bulletText}>
              {tsText(h.momento) ? (
                <Text style={{ color: ACCENT, fontWeight: "bold" }}>
                  {tsText(h.momento)}
                </Text>
              ) : null}
              {h.detalle || "\u2014"}
            </Text>
          </View>
          <Cita cita={h.cita} />
        </View>
      ))}
    </View>
  );
}

type ReportMeta = { title: string; analystName?: string; date: Date };

function ReportDoc({
  analysis,
  meta,
}: {
  analysis: CallAnalysis;
  meta: ReportMeta;
}) {
  const fecha = meta.date.toLocaleString("es-ES", {
    dateStyle: "long",
    timeStyle: "short",
  });

  return (
    <Document
      creator="AA Firma · Análisis de Llamadas"
      title={meta.title}
    >
      <Page size="A4" style={styles.page}>
        {/* Cabecera */}
        <Text style={styles.brand}>ALVARADO ABREU FIRMA & CO.</Text>
        <Text style={styles.title}>Informe de Análisis de Llamada</Text>
        <Text style={styles.subtitle}>{meta.title}</Text>
        <Text style={styles.meta}>
          {fecha}
          {meta.analystName ? ` · ${meta.analystName}` : ""}
        </Text>

        {/* Puntuación + resumen */}
        <View style={styles.scoreRow}>
          <View style={styles.scoreBox}>
            <Text style={{ fontSize: 34, lineHeight: 1.1 }}>
              <Text
                style={[
                  styles.scoreNum,
                  { color: scoreColor(analysis.puntuacionGlobal) },
                ]}
              >
                {analysis.puntuacionGlobal}
              </Text>
              <Text style={styles.scoreSlash}> /100</Text>
            </Text>
            <Text style={styles.scoreLabel}>PUNTUACIÓN</Text>
          </View>
          <View style={styles.scoreInfo}>
            <Text>
              <Text style={[styles.label, { color: ACCENT }]}>
                Resultado probable:{" "}
              </Text>
              {analysis.resultadoProbable || "\u2014"}
            </Text>
            <Text style={{ marginTop: 4 }}>{analysis.resumen || "\u2014"}</Text>
          </View>
        </View>

        {/* Línea de tiempo */}
        {analysis.lineaTiempo?.length ? (
          <View>
            <View style={styles.sectionBar}>
              <Text style={styles.sectionText}>
                LÍNEA DE TIEMPO · QUÉ PASA EN CADA MOMENTO
              </Text>
            </View>
            <View style={styles.card}>
              {analysis.lineaTiempo.map((t, i) => (
                <View key={i} style={styles.timelineRow}>
                  <Text style={styles.timelineTime}>{t.momento?.trim() || "\u2014"}</Text>
                  <Text style={styles.timelineEvent}>{t.evento}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Prioridades 80/20 */}
        <View style={styles.sectionBar}>
          <Text style={styles.sectionText}>
            PRIORIDADES 80/20 · LO QUE MÁS MEJORA LA LLAMADA
          </Text>
        </View>
        {analysis.prioridades.length ? (
          analysis.prioridades.map((p, i) => (
            <View key={i} style={[styles.card, { backgroundColor: ACCENT_BG }]}>
              <Text style={styles.cardTitle}>
                {tsText(p.momento) ? (
                  <Text style={{ color: GREEN }}>{tsText(p.momento)}</Text>
                ) : null}
                {`${i + 1}. ${p.titulo}`}
              </Text>
              <Text>
                <Text style={[styles.label, { color: ACCENT }]}>Por qué: </Text>
                {p.porque || "\u2014"}
              </Text>
              <Text style={{ marginTop: 2 }}>
                <Text style={[styles.label, { color: GREEN }]}>Acción: </Text>
                {p.accion || "\u2014"}
              </Text>
              <Cita cita={p.cita} />
            </View>
          ))
        ) : (
          <Text style={styles.empty}>Sin elementos.</Text>
        )}

        {/* Errores por fase */}
        <View style={styles.sectionBar}>
          <Text style={styles.sectionText}>ERRORES POR FASE</Text>
        </View>
        <View style={styles.errorsRow}>
          <View style={styles.errorCol}>
            <Text style={styles.colTitle}>SONDEO</Text>
            <HallazgoBullets items={analysis.erroresSondeo} />
          </View>
          <View style={styles.errorCol}>
            <Text style={styles.colTitle}>PITCH</Text>
            <HallazgoBullets items={analysis.erroresPitch} />
          </View>
          <View style={styles.errorColLast}>
            <Text style={styles.colTitle}>OBJECIONES</Text>
            <HallazgoBullets items={analysis.erroresObjeciones} />
          </View>
        </View>

        {/* Rebate de objeciones */}
        <View style={styles.sectionBar}>
          <Text style={styles.sectionText}>REBATE DE OBJECIONES</Text>
        </View>
        {analysis.rebateObjeciones.length ? (
          analysis.rebateObjeciones.map((o, i) => (
            <View key={i} style={styles.card}>
              <Text style={styles.cardTitle}>
                {tsText(o.momento) ? (
                  <Text style={{ color: ACCENT }}>{tsText(o.momento)}</Text>
                ) : null}
                <Text>Objeción: </Text>
                <Text style={{ fontStyle: "italic" }}>{o.objecion}</Text>
              </Text>
              <Cita cita={o.cita} />
              <Text>
                <Text style={[styles.label, { color: RED }]}>
                  Cómo se manejó:{" "}
                </Text>
                <Text style={{ color: MUTED }}>{o.manejoActual || "\u2014"}</Text>
              </Text>
              <Text style={{ marginTop: 2 }}>
                <Text style={[styles.label, { color: GREEN }]}>
                  Rebate recomendado:{" "}
                </Text>
                {o.rebateRecomendado || "\u2014"}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.empty}>Sin elementos.</Text>
        )}

        {/* Red flags */}
        <View style={styles.sectionBar}>
          <Text style={styles.sectionText}>
            RED FLAGS · OPORTUNIDADES DE MEJORA
          </Text>
        </View>
        {analysis.redFlags.length ? (
          analysis.redFlags.map((r, i) => (
            <View key={i} style={[styles.card, { backgroundColor: RED_BG }]}>
              <Text style={[styles.cardTitle, { color: RED }]}>
                {tsText(r.momento) ? (
                  <Text>{tsText(r.momento)}</Text>
                ) : null}
                {r.flag}
              </Text>
              <Cita cita={r.cita} />
              <Text>
                <Text style={{ color: MUTED }}>Oportunidad: </Text>
                {r.oportunidad || "\u2014"}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.empty}>Sin elementos.</Text>
        )}

        {/* Secciones según la estructura de la firma */}
        {analysis.seccionesPersonalizadas?.length ? (
          <View>
            <View style={styles.sectionBar}>
              <Text style={styles.sectionText}>
                INFORME SEGÚN LA ESTRUCTURA DE LA FIRMA
              </Text>
            </View>
            {analysis.seccionesPersonalizadas.map((sec, i) => (
              <View key={i} style={[styles.card, { backgroundColor: "#E9F5EE" }]}>
                <Text style={styles.cardTitle}>{sec.titulo}</Text>
                {sec.contenido
                  .split(/\n+/)
                  .map((l) => l.replace(/^[-•*]\s*/, "").trim())
                  .filter(Boolean)
                  .map((l, j) => (
                    <View key={j} style={styles.bulletRow}>
                      <Text style={styles.bulletDot}>{"\u2022"}</Text>
                      <Text style={styles.bulletText}>{l}</Text>
                    </View>
                  ))}
              </View>
            ))}
          </View>
        ) : null}

        <Text style={styles.footer}>
          Documento generado automáticamente · Uso interno · Alvarado Abreu Firma
          & Co.
        </Text>
      </Page>
    </Document>
  );
}

// Genera el informe en PDF y devuelve un Buffer.
export async function buildReportPdf(
  analysis: CallAnalysis,
  meta: ReportMeta
): Promise<Buffer> {
  return renderToBuffer(<ReportDoc analysis={analysis} meta={meta} />);
}
