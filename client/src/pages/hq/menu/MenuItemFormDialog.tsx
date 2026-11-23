import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { MenuItem, UpdateMenuItemBody } from '@/api/types';
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
import { Switch } from '@/components/ui/switch';
import { toastError } from '@/hooks/error-toast';
import { useCreateMenuItem, useMenuCategories, useUpdateMenuItem } from '@/hooks/use-menu-items';
import { applyServerFieldErrors } from '@/lib/server-errors';
import { menuItemSchema } from '@/schemas/forms';
import type { MenuItemFormInput, MenuItemFormOutput } from '@/schemas/forms';

const FIELDS = ['sku', 'name', 'category', 'basePrice', 'isActive'] as const;
const CATEGORY_LIST_ID = 'menu-item-categories';

const toFormValues = (item: MenuItem | null): MenuItemFormInput =>
  item
    ? {
        sku: item.sku,
        name: item.name,
        category: item.category,
        basePrice: item.basePrice,
        isActive: item.isActive,
      }
    : { sku: '', name: '', category: '', basePrice: '', isActive: true };

interface MenuItemFormDialogProps {
  /** null = create a new item; otherwise edit this one. */
  item: MenuItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Create and edit share one form. On edit the SKU is read-only (the server does not allow
 * changing it) and only fields the user actually changed are sent in the PATCH.
 */
export const MenuItemFormDialog = ({ item, open, onOpenChange }: MenuItemFormDialogProps) => {
  const isEdit = item !== null;
  const createItem = useCreateMenuItem();
  const updateItem = useUpdateMenuItem();
  const categories = useMenuCategories();
  const isPending = createItem.isPending || updateItem.isPending;

  const form = useForm<MenuItemFormInput, unknown, MenuItemFormOutput>({
    resolver: zodResolver(menuItemSchema),
    defaultValues: toFormValues(item),
  });
  const { dirtyFields, isDirty } = form.formState;

  const handleError = (error: unknown) => {
    applyServerFieldErrors(error, form.setError, FIELDS, { MENU_ITEM_SKU_TAKEN: 'sku' });
    toastError(error);
  };

  const onSubmit = (values: MenuItemFormOutput) => {
    if (!item) {
      // New items are always active on the server; the create body has no isActive.
      const { sku, name, category, basePrice } = values;
      createItem.mutate(
        { sku, name, category, basePrice },
        {
          onSuccess: (created) => {
            toast.success(`${created.name} added to the master menu`);
            onOpenChange(false);
          },
          onError: handleError,
        },
      );
      return;
    }

    const body: UpdateMenuItemBody = {};
    if (dirtyFields.name) body.name = values.name;
    if (dirtyFields.category) body.category = values.category;
    if (dirtyFields.basePrice) body.basePrice = values.basePrice;
    if (dirtyFields.isActive) body.isActive = values.isActive;
    updateItem.mutate(
      { id: item.id, body },
      {
        onSuccess: (updated) => {
          toast.success(`${updated.name} updated`);
          onOpenChange(false);
        },
        onError: handleError,
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${item.name}` : 'New menu item'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Base price changes apply to outlets without a price override. Past receipts keep their price.'
              : 'New items are active. Assign them to outlets on the Menu assignment page.'}
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
              name="sku"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>SKU</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="off"
                      placeholder="e.g. COF-MOC"
                      readOnly={isEdit}
                      className={isEdit ? 'bg-muted font-mono' : 'font-mono'}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {isEdit ? 'The SKU cannot be changed.' : 'Unique; cannot be changed later.'}
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
                    <Input autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" list={CATEGORY_LIST_ID} {...field} />
                  </FormControl>
                  <datalist id={CATEGORY_LIST_ID}>
                    {categories.data?.map((category) => (
                      <option key={category} value={category} />
                    ))}
                  </datalist>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="basePrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Base price</FormLabel>
                  <FormControl>
                    <Input inputMode="decimal" autoComplete="off" placeholder="0.00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {isEdit ? (
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex-row items-center justify-between gap-4">
                    <div className="flex flex-col gap-1">
                      <FormLabel>Active</FormLabel>
                      <FormDescription>
                        Inactive items disappear from every outlet’s sellable menu.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            ) : null}
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={isPending || (isEdit && !isDirty)}>
                {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create item'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
