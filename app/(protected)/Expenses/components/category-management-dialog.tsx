"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import {
  Trash2,
  PlusCircle,
  Pencil,
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  Power,
  PowerOff,
} from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [newCategory, setNewCategory] = useState<{
    name: string;
    description: string;
  }>({ name: "", description: "" });
  const [isAddingNew, setIsAddingNew] = useState(false);
  const { toast } = useToast();
  const supabase = createClient();

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from("expense_categories")
      .select("*")
      .order("name");

    if (error) {
      console.error("Error fetching categories:", error);
      return;
    }

    setCategories(data);
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
      // Show different dialog for categories with expenses
      toast({
        title: "Category in Use",
        description: `This category has ${count} expense(s). You can deactivate it instead of deleting.`,
      });
      return;
    }

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

    fetchCategories();
    setDeleteDialogOpen(false);
    setCategoryToDelete(null);
  };

  const toggleCategoryStatus = async (category: Category) => {
    const { error } = await supabase
      .from("expense_categories")
      .update({ is_active: !category.is_active })
      .eq("id", category.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update category status",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Success",
      description: `Category ${category.is_active ? "deactivated" : "activated"} successfully`,
    });

    fetchCategories();
  };

  const handleSave = async (category: Category) => {
    const { error } = await supabase
      .from("expense_categories")
      .update({
        name: category.name,
        description: category.description,
        is_active: category.is_active,
      })
      .eq("id", category.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update category",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Success",
      description: "Category updated successfully",
    });

    setEditingCategory(null);
    fetchCategories();
  };

  const handleAdd = async () => {
    if (!newCategory.name.trim()) {
      toast({
        title: "Error",
        description: "Category name is required",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase.from("expense_categories").insert({
      name: newCategory.name.trim(),
      description: newCategory.description.trim() || null,
      is_active: true,
    });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to create category",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Success",
      description: "Category created successfully",
    });

    setNewCategory({ name: "", description: "" });
    setIsAddingNew(false);
    fetchCategories();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <div className="flex items-center justify-between pr-8 pb-4 border-b">
            <DialogTitle className="text-xl">Manage Categories</DialogTitle>
            <Button
              onClick={() => setIsAddingNew(true)}
              variant="outline"
              size="sm"
              className="h-8"
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              Add New Category
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center p-4">
              <span className="text-muted-foreground">
                Loading categories...
              </span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => (
                  <TableRow
                    key={category.id}
                    className={`${category.is_system ? "bg-muted/50" : ""} ${
                      editingCategory?.id === category.id ? "bg-muted/20" : ""
                    }`}
                  >
                    <TableCell>
                      {editingCategory?.id === category.id ? (
                        <div className="space-y-2">
                          <Input
                            value={editingCategory.name}
                            onChange={(e) =>
                              setEditingCategory({
                                ...editingCategory,
                                name: e.target.value,
                              })
                            }
                            placeholder="Enter category name"
                            className="h-8"
                          />
                          {!editingCategory.name.trim() && (
                            <p className="text-xs text-destructive">
                              Name is required
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="font-medium">
                          {category.name}
                          {category.is_system && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              (System)
                            </span>
                          )}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingCategory?.id === category.id ? (
                        <Textarea
                          value={editingCategory.description || ""}
                          onChange={(e) =>
                            setEditingCategory({
                              ...editingCategory,
                              description: e.target.value,
                            })
                          }
                          placeholder="Enter description (optional)"
                          className="h-8 min-h-[32px] resize-none"
                        />
                      ) : (
                        <span className="text-muted-foreground">
                          {category.description || "—"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          category.is_active
                            ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400"
                            : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-400"
                        }`}
                      >
                        {category.is_active ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5" />
                        )}
                        {category.is_active ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        {editingCategory?.id === category.id ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSave(editingCategory)}
                              disabled={!editingCategory.name.trim()}
                              className="bg-green-50 text-green-600 hover:bg-green-100 hover:text-green-700 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30"
                            >
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              Save
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingCategory(null)}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 hover:bg-muted"
                                disabled={category.is_system}
                              >
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-[160px]"
                            >
                              <DropdownMenuLabel className="text-xs font-medium">
                                Actions
                              </DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() => setEditingCategory(category)}
                                className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-blue-50 hover:text-blue-600 focus:bg-blue-50 focus:text-blue-600 dark:hover:bg-blue-900/10 dark:hover:text-blue-400"
                              >
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit Details
                              </DropdownMenuItem>
                              {category.is_active ? (
                                <DropdownMenuItem
                                  onClick={() => toggleCategoryStatus(category)}
                                  className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-yellow-50 hover:text-yellow-600 focus:bg-yellow-50 focus:text-yellow-600 dark:hover:bg-yellow-900/10 dark:hover:text-yellow-400"
                                >
                                  <PowerOff className="h-4 w-4 mr-2" />
                                  Deactivate
                                </DropdownMenuItem>
                              ) : (
                                <>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      toggleCategoryStatus(category)
                                    }
                                    className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-green-50 hover:text-green-600 focus:bg-green-50 focus:text-green-600 dark:hover:bg-green-900/10 dark:hover:text-green-400"
                                  >
                                    <Power className="h-4 w-4 mr-2" />
                                    Activate
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setCategoryToDelete(category);
                                      setDeleteDialogOpen(true);
                                    }}
                                    className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-red-50 hover:text-red-600 focus:bg-red-50 focus:text-red-600 dark:hover:bg-red-900/10 dark:hover:text-red-400"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      {/* Add New Category Dialog */}
      <Dialog open={isAddingNew} onOpenChange={setIsAddingNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                value={newCategory.name}
                onChange={(e) =>
                  setNewCategory({ ...newCategory, name: e.target.value })
                }
                placeholder="Enter category name"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={newCategory.description}
                onChange={(e) =>
                  setNewCategory({
                    ...newCategory,
                    description: e.target.value,
                  })
                }
                placeholder="Enter category description (optional)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddingNew(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd}>Create Category</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Delete Category
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the category "
              <span className="font-medium text-foreground">
                {categoryToDelete?.name}
              </span>
              "? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="gap-2">
              <XCircle className="h-4 w-4" />
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => categoryToDelete && handleDelete(categoryToDelete)}
              className="gap-2 bg-red-500 hover:bg-red-600"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
