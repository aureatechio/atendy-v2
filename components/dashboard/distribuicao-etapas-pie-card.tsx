"use client";

import { useEffect, useMemo, useState } from "react";
import { PieChart as PieChartIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface EtapaDistribuicaoItem {
  slug: string;
  nome: string;
  cor: string;
  quantidade: number;
}

const RADIUS = 68;
const STROKE = 26;
const CENTER = 90;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function DistribuicaoEtapasPieCard({
  etapas,
}: {
  etapas: EtapaDistribuicaoItem[];
}) {
  const [mounted, setMounted] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const total = useMemo(
    () => etapas.reduce((sum, e) => sum + e.quantidade, 0),
    [etapas],
  );

  const segments = useMemo(() => {
    if (total === 0) return [];
    let cumulative = 0;
    return etapas.map((etapa, idx) => {
      const fraction = etapa.quantidade / total;
      const startAngle = cumulative * 360;
      cumulative += fraction;
      return { ...etapa, idx, fraction, startAngle };
    });
  }, [etapas, total]);

  const hovered =
    hoveredIdx !== null
      ? segments.find((s) => s.idx === hoveredIdx) ?? null
      : null;

  return (
    <Card className="distribuicao-etapas-card">
      <CardHeader className="distribuicao-etapas-card-header">
        <div className="distribuicao-etapas-card-heading">
          <span className="distribuicao-etapas-card-icon" aria-hidden>
            <PieChartIcon size={16} />
          </span>
          <div className="distribuicao-etapas-card-titlewrap">
            <CardTitle className="distribuicao-etapas-card-title">
              Distribuição por etapa
            </CardTitle>
            <p className="distribuicao-etapas-card-subtitle">
              Clientes ativos agrupados pela etapa atual.
            </p>
          </div>
        </div>
        {total > 0 ? (
          <span className="distribuicao-etapas-card-badge">
            {segments.length} {segments.length === 1 ? "etapa" : "etapas"}
          </span>
        ) : null}
      </CardHeader>
      <CardContent className="distribuicao-etapas-card-content">
        {total === 0 ? (
          <div className="distribuicao-etapas-empty">
            <div className="distribuicao-etapas-empty-icon" aria-hidden>
              <PieChartIcon size={20} />
            </div>
            <p className="distribuicao-etapas-empty-title">Sem dados ainda.</p>
            <p className="distribuicao-etapas-empty-text">
              Nenhum cliente ativo no funil no momento.
            </p>
          </div>
        ) : (
          <div className="distribuicao-etapas-grid">
            <div
              className="distribuicao-etapas-chart"
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <svg
                viewBox="0 0 180 180"
                className="distribuicao-etapas-svg"
                role="img"
                aria-label={`Distribuição de ${total} clientes por etapa.`}
              >
                <circle
                  cx={CENTER}
                  cy={CENTER}
                  r={RADIUS}
                  fill="none"
                  className="distribuicao-etapas-track"
                  strokeWidth={STROKE}
                />
                {segments.map((seg) => {
                  const rawLength = seg.fraction * CIRCUMFERENCE;
                  const segmentLength =
                    rawLength > 4 ? rawLength - 1.5 : Math.max(rawLength, 1);
                  const rotate = seg.startAngle - 90;
                  const isHovered = hoveredIdx === seg.idx;
                  const dim = hoveredIdx !== null && !isHovered;
                  return (
                    <circle
                      key={seg.slug}
                      cx={CENTER}
                      cy={CENTER}
                      r={RADIUS}
                      fill="none"
                      stroke={seg.cor}
                      strokeLinecap="butt"
                      strokeWidth={isHovered ? STROKE + 6 : STROKE}
                      strokeDasharray={`${mounted ? segmentLength : 0} ${CIRCUMFERENCE}`}
                      transform={`rotate(${rotate} ${CENTER} ${CENTER})`}
                      className="distribuicao-etapas-arc"
                      style={{
                        opacity: dim ? 0.32 : 1,
                        transitionDelay: mounted ? `${seg.idx * 70}ms` : "0ms",
                      }}
                      onMouseEnter={() => setHoveredIdx(seg.idx)}
                      onFocus={() => setHoveredIdx(seg.idx)}
                      onBlur={() => setHoveredIdx(null)}
                      tabIndex={0}
                      role="button"
                      aria-label={`${seg.nome}: ${seg.quantidade} clientes (${(seg.fraction * 100).toFixed(1)}%)`}
                    />
                  );
                })}
              </svg>
              <div className="distribuicao-etapas-center" aria-hidden>
                {hovered ? (
                  <>
                    <span
                      className="distribuicao-etapas-center-dot"
                      style={{ background: hovered.cor }}
                    />
                    <span className="distribuicao-etapas-center-value">
                      {hovered.quantidade}
                    </span>
                    <span className="distribuicao-etapas-center-label">
                      {(hovered.fraction * 100).toFixed(1)}% · {hovered.nome}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="distribuicao-etapas-center-value">
                      {total}
                    </span>
                    <span className="distribuicao-etapas-center-label">
                      {total === 1 ? "cliente" : "clientes"}
                    </span>
                  </>
                )}
              </div>
            </div>

            <ul className="distribuicao-etapas-legend" role="list">
              {segments.map((seg) => {
                const isHovered = hoveredIdx === seg.idx;
                const dim = hoveredIdx !== null && !isHovered;
                return (
                  <li
                    key={seg.slug}
                    className={`distribuicao-etapas-legend-item${isHovered ? " is-hovered" : ""}${dim ? " is-dim" : ""}`}
                    onMouseEnter={() => setHoveredIdx(seg.idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  >
                    <span
                      className="distribuicao-etapas-legend-dot"
                      style={{ background: seg.cor }}
                      aria-hidden
                    />
                    <span className="distribuicao-etapas-legend-name">
                      {seg.nome}
                    </span>
                    <span className="distribuicao-etapas-legend-count">
                      {seg.quantidade}
                    </span>
                    <span className="distribuicao-etapas-legend-pct">
                      {(seg.fraction * 100).toFixed(1)}%
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
