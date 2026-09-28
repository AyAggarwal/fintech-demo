import { Link } from 'react-router-dom';
import { Alert } from './Alert.js';

export interface ActionResultInfo {
  message: string;
  auditEventId: string;
}

export function ActionResult({ result }: { result: ActionResultInfo | null }) {
  if (!result) return null;
  return (
    <Alert kind="success" testId="action-success">
      {result.message}{' '}
      <Link to={`/audit?eventId=${encodeURIComponent(result.auditEventId)}`}>View audit event</Link>
    </Alert>
  );
}
