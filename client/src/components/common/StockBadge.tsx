import type { StockStatus } from '@/api/types';
import { Badge } from '@/components/ui/badge';

interface StockBadgeProps {
  status: StockStatus;
  /** When given, the badge shows the count ("4 left") instead of just the status. */
  quantity?: number;
}

export const StockBadge = ({ status, quantity }: StockBadgeProps) => {
  if (status === 'out') return <Badge variant="danger">Out of stock</Badge>;
  if (status === 'low') {
    return (
      <Badge variant="warn">
        {quantity === undefined ? 'Low stock' : `Low · ${quantity.toString()} left`}
      </Badge>
    );
  }
  return (
    <Badge variant="ok">
      {quantity === undefined ? 'In stock' : `${quantity.toString()} in stock`}
    </Badge>
  );
};
