export function ClaimResultModal({ message, error }: { message?: string; error?: boolean }) {
  if (!message) return null;
  return <div className={error ? "message error" : "message"}>{message}</div>;
}
