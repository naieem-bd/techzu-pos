import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { toastError } from '@/hooks/error-toast';
import { useCreateOutlet } from '@/hooks/use-outlets';
import { applyServerFieldErrors } from '@/lib/server-errors';
import { createOutletSchema } from '@/schemas/forms';
import type { CreateOutletForm } from '@/schemas/forms';

const EMPTY_FORM: CreateOutletForm = { code: '', name: '', address: '' };
const FIELDS = ['code', 'name', 'address'] as const;

interface CreateOutletDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateOutletDialog = ({ open, onOpenChange }: CreateOutletDialogProps) => {
  const createOutlet = useCreateOutlet();
  const form = useForm<CreateOutletForm>({
    resolver: zodResolver(createOutletSchema),
    defaultValues: EMPTY_FORM,
  });

  const handleOpenChange = (next: boolean) => {
    if (!next) form.reset(EMPTY_FORM);
    onOpenChange(next);
  };

  const onSubmit = ({ address, ...required }: CreateOutletForm) => {
    createOutlet.mutate(address === '' ? required : { ...required, address }, {
      onSuccess: (outlet) => {
        toast.success(`Outlet ${outlet.name} created`);
        handleOpenChange(false);
      },
      onError: (error) => {
        applyServerFieldErrors(error, form.setError, FIELDS, { OUTLET_CODE_TAKEN: 'code' });
        toastError(error);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New outlet</DialogTitle>
          <DialogDescription>
            A receipt counter is created with the outlet; its first receipt is number 1.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}
          >
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Outlet code</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" placeholder="e.g. UT05" {...field} />
                  </FormControl>
                  <FormDescription>
                    2–20 letters, digits, “-” or “_”; unique. Used as the receipt prefix.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" placeholder="e.g. Uttara Corner" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address (optional)</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={createOutlet.isPending}>
                {createOutlet.isPending ? 'Creating…' : 'Create outlet'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
