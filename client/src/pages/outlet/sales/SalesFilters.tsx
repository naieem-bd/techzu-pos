import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { salesFilterSchema } from '@/schemas/forms';
import type { SalesFilterForm } from '@/schemas/forms';

interface SalesFiltersProps {
  value: SalesFilterForm;
  receiptPlaceholder: string;
  onApply: (filters: SalesFilterForm) => void;
  isFetching: boolean;
}

/** From/To are inclusive local days; the page converts them to the API's half-open range. */
export const SalesFilters = ({
  value,
  receiptPlaceholder,
  onApply,
  isFetching,
}: SalesFiltersProps) => {
  const form = useForm<SalesFilterForm>({
    resolver: zodResolver(salesFilterSchema),
    defaultValues: value,
  });

  return (
    <Form {...form}>
      <form
        noValidate
        aria-label="Sales filters"
        className="flex flex-wrap items-start gap-3"
        onSubmit={(event) => void form.handleSubmit(onApply)(event)}
      >
        <FormField
          control={form.control}
          name="fromDate"
          render={({ field }) => (
            <FormItem className="w-full sm:w-[180px]">
              <FormLabel>From</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="toDate"
          render={({ field }) => (
            <FormItem className="w-full sm:w-[180px]">
              <FormLabel>To</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="receipt"
          render={({ field }) => (
            <FormItem className="w-full sm:w-[200px]">
              <FormLabel>Receipt no.</FormLabel>
              <FormControl>
                <Input autoComplete="off" placeholder={receiptPlaceholder} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* Aligns with the inputs (label height + gap) whether or not an error shows. */}
        <Button type="submit" variant="outline" className="sm:mt-[25.5px]" disabled={isFetching}>
          {isFetching ? 'Loading…' : 'Apply'}
        </Button>
      </form>
    </Form>
  );
};
