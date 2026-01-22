import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';

interface TimeAgoProps {
  date: string | Date;
  showFull?: boolean;
}

export function TimeAgo({ date, showFull = false }: TimeAgoProps) {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (showFull) {
    return <span>{format(dateObj, 'PPpp')}</span>;
  }

  if (isToday(dateObj)) {
    return <span>Today at {format(dateObj, 'p')}</span>;
  }

  if (isYesterday(dateObj)) {
    return <span>Yesterday at {format(dateObj, 'p')}</span>;
  }

  const distance = formatDistanceToNow(dateObj, { addSuffix: true });
  return <span title={format(dateObj, 'PPpp')}>{distance}</span>;
}
