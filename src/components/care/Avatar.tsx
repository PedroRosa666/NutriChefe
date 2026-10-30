import { cn } from '../../lib/utils';

interface AvatarProps {
  name: string | null | undefined;
  url?: string | null;
  className?: string;
}

/** Foto da pessoa ou iniciais sobre o degradê verde. */
export function Avatar({ name, url, className }: AvatarProps) {
  const initials =
    (name ?? '')
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?';

  return (
    <div
      className={cn(
        'flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-emerald-700 to-teal-700 text-sm font-bold text-white',
        className
      )}
    >
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : initials}
    </div>
  );
}
