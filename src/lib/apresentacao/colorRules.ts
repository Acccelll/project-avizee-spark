export function getSeverityColor(severity: 'info' | 'warning' | 'critical' | 'positive'): string {
  if (severity === 'critical') return '#DC2626';
  if (severity === 'warning') return '#D97706';
  if (severity === 'positive') return '#11A683';
  return '#1E5EFF';
}
