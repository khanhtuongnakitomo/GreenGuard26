import clsx from 'clsx';

interface StatCardProps {
  label: string;
  value: number | string | null | undefined;
  unit?: string;
  color?: string;
}

/**
 * StatCard — Hiển thị một chỉ số tóm tắt (Total, By Type, Confidence…)
 * Dùng ở Dashboard Overview.
 */
export function StatCard({ label, value, unit, color = 'text-gray-900' }: StatCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={clsx('text-3xl font-bold mt-1', color)}>
        {value ?? '—'}
        {unit && <span className="text-sm font-normal ml-1 text-gray-400">{unit}</span>}
      </p>
    </div>
  );
}
