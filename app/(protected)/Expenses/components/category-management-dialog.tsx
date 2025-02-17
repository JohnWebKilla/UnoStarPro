"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Category {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  is_system?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CategoryManagementDialog({ open, onOpenChange }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(
    null
  );
  const { toast } = useToast();
  const supabase = createClient();

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from("expense_categories")
      .select("*, expenses!inner(is_system_generated)")
      .order("name");

    if (error) {
      console.error("Error fetching categories:", error);
      return;
    }

    const categoriesWithSystem = data.map((category) => ({
      ...category,
      is_system: category.expenses.some((e) => e.is_system_generated),
    }));

    setCategories(categoriesWithSystem);
    setIsLoading(false);
  };

  useEffect(() => {
    if (open) {
      fetchCategories();
    }
  }, [open]);

  const handleDelete = async (category: Category) => {
    // Check if category is in use
    const { count, error: countError } = await supabase
      .from("expenses")
      .select("*", { count: "exact", head: true })
      .eq("category_id", category.id);

    if (countError) {
      toast({
        title: "Error",
        description: "Failed to check category usage",
        variant: "destructive",
      });
      return;
    }

    if (count && count > 0) {
      // If category is in use, just deactivate it
      const { error } = await supabase
        .from("expense_categories")
        .update({ is_active: false })
        .eq("id", category.id);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to deactivate category",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Category deactivated successfully",
      });
    } else {
      // If category is not in use, delete it
      const { error } = await supabase
        .from("expense_categories")
        .delete()
        .eq("id", category.id);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to delete category",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Category deleted successfully",
      });
    }

    fetchCategories();
    setDeleteDialogOpen(false);
    setCategoryToDelete(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Manage Categories</DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <div>Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => (
                  <TableRow
                    key={category.id}
                    className={category.is_system ? "bg-muted/50" : ""}
                  >
                    <TableCell>
                      {category.name}
                      {category.is_system && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          (System)
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{category.description}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          category.is_active
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {category.is_active ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setCategoryToDelete(category);
                            setDeleteDialogOpen(true);
                          }}
                          disabled={category.is_system}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {categoryToDelete?.is_system
                ? "System categories cannot be deleted."
                : `This will ${
                    categoryToDelete?.is_active ? "deactivate" : "delete"
                  } the category "${categoryToDelete?.name}". ${
                    categoryToDelete?.is_active
                      ? "Existing expenses will be preserved."
                      : ""
                  }`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => categoryToDelete && handleDelete(categoryToDelete)}
              className="bg-red-500 hover:bg-red-600"
            >
              {categoryToDelete?.is_active ? "Deactivate" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
