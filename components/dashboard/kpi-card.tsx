import { Card, CardContent } from "@/components/ui/card";

export function KpiCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <Card className="ds-kpi-card">
      <CardContent className="ds-kpi-content">
        <p className="ds-kpi-label">{title}</p>
        <p className="ds-kpi-value">{value}</p>
        {subtitle ? <p className="ds-kpi-foot">{subtitle}</p> : null}
      </CardContent>
    </Card>
  );
}
