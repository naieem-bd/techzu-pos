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
import { dateRangeSchema } from '@/schemas/forms';
import type { DateRangeForm } from '@/schemas/forms';

interface ReportFiltersProps {
  value: DateRangeForm;
  onApply: (range: DateRangeForm) => void;
  isFetching: boolean;
}

/** From/To are inclusive local days; the page converts them to the API's half-open range. */
export const ReportFilters = ({ value, onApply, isFetching }: ReportFiltersProps) => {
  const form = useForm<DateRangeForm>({
    resolver: zodResolver(dateRangeSchema),
    defaultValues: value,
  });

  return (
    <Form {...form}>
      <form
        noValidate
        aria-label="Report date range"
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
        {/* Aligns with the inputs (label height + gap) whether or not an error shows. */}
        <Button type="submit" variant="outline" className="sm:mt-[25.5px]" disabled={isFetching}>
          {isFetching ? 'Loading…' : 'Apply'}
        </Button>
      </form>
    </Form>
  );
};
