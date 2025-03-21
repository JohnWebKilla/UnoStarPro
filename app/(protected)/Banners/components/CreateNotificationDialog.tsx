import React, { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { NotificationMessage, Translation, LanguageCode } from "../types";
import { v4 as uuidv4 } from "uuid";
import { generateTranslations } from "../services/translation";
import { LANGUAGES } from "../services/translation-types";
import { Loader2, Check, ChevronsUpDown } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { uploadNotificationImage } from "../utils/storage";
import { Label } from "@/components/ui/label";

const languageEnum = z.enum(["en", "uz", "ru"] as const);

const notificationSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  type: z.enum(["info", "warning", "success", "error"]),
  displayType: z.enum(["banner", "dialog"]),
  autoShow: z.boolean(),
  dismissible: z.boolean(),
  showFrom: z.string().optional(),
  showUntil: z.string().optional(),
  image: z.string().optional(),
  translateTo: z.array(languageEnum).default([]),
  uzTitle: z.string().optional(),
  uzContent: z.string().optional(),
  ruTitle: z.string().optional(),
  ruContent: z.string().optional(),
  autoTranslate: z.boolean().default(true),
  sourceLanguage: languageEnum.default("en"),
});

type NotificationForm = z.infer<typeof notificationSchema>;

interface CreateNotificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (notification: NotificationMessage) => void;
}

export const CreateNotificationDialog = ({
  open,
  onOpenChange,
  onSubmit,
}: CreateNotificationDialogProps) => {
  const [isTranslating, setIsTranslating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const form = useForm<NotificationForm>({
    resolver: zodResolver(notificationSchema),
    defaultValues: {
      title: "",
      content: "",
      type: "info",
      displayType: "banner",
      autoShow: true,
      dismissible: true,
      showFrom: "",
      showUntil: "",
      translateTo: [],
      autoTranslate: true,
      sourceLanguage: "en",
    },
  });

  // Watch for changes in translateTo and autoTranslate
  const translateTo = form.watch("translateTo") || [];
  const autoTranslate = form.watch("autoTranslate");

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const imageUrl = await uploadNotificationImage(file);
      setUploadedImageUrl(imageUrl);
      toast({
        title: "Success",
        description: "Image uploaded successfully",
      });
    } catch (error) {
      console.error("Error uploading image:", error);
      toast({
        title: "Error",
        description: "Failed to upload image",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (data: NotificationForm) => {
    setIsTranslating(true);
    try {
      let translations: Translation[] = [];

      if (
        data.autoTranslate &&
        Array.isArray(data.translateTo) &&
        data.translateTo.length > 0
      ) {
        try {
          translations = await generateTranslations(
            data.title,
            data.content,
            data.sourceLanguage
          );

          if (translations.length === 0) {
            toast({
              title: "Translation Warning",
              description:
                "Could not generate translations. Using manual translations if provided.",
            });
          }
        } catch (error) {
          console.error("Translation error:", error);
          toast({
            title: "Translation Error",
            description:
              "Failed to generate translations. Using manual translations if provided.",
            variant: "destructive",
          });
        }
      }

      // Fall back to manual translations if auto-translate failed or is disabled
      if (
        !data.autoTranslate &&
        Array.isArray(data.translateTo) &&
        data.translateTo.length > 0
      ) {
        if (data.translateTo.includes("uz") && data.uzTitle && data.uzContent) {
          translations.push({
            title: data.uzTitle,
            content: data.uzContent,
            language: "uz",
            isAutoTranslated: false,
          });
        }

        if (data.translateTo.includes("ru") && data.ruTitle && data.ruContent) {
          translations.push({
            title: data.ruTitle,
            content: data.ruContent,
            language: "ru",
            isAutoTranslated: false,
          });
        }
      }

      const notification: NotificationMessage = {
        id: uuidv4(),
        ...data,
        showFrom: data.showFrom ? new Date(data.showFrom) : undefined,
        showUntil: data.showUntil ? new Date(data.showUntil) : undefined,
        translations,
        translateTo: Array.isArray(data.translateTo) ? data.translateTo : [],
        image: uploadedImageUrl || undefined,
      };

      await onSubmit(notification);

      toast({
        title: "Success",
        description: "Notification created successfully with translations.",
      });

      // Reset the form and uploaded image
      setUploadedImageUrl(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      handleOpenChange(false);
    } catch (error) {
      console.error("Error creating notification:", error);
      toast({
        title: "Error",
        description: "Failed to create notification. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsTranslating(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      form.reset();
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4">
          <DialogTitle>Create Notification</DialogTitle>
          <DialogDescription>
            Create a new notification or banner message
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Title</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-2">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="info">Info</SelectItem>
                          <SelectItem value="warning">Warning</SelectItem>
                          <SelectItem value="success">Success</SelectItem>
                          <SelectItem value="error">Error</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="displayType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Display As</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select display type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="banner">Banner</SelectItem>
                          <SelectItem value="dialog">Dialog</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Content</FormLabel>
                  <FormControl>
                    <Textarea {...field} className="h-20" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="showFrom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Show From</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="showUntil"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Show Until</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-2">
              {form.watch("displayType") === "dialog" && (
                <>
                  <Label htmlFor="image">Image (optional)</Label>
                  <Input
                    id="image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    ref={fileInputRef}
                    disabled={isUploading}
                  />
                  {uploadedImageUrl && (
                    <div className="mt-2">
                      <img
                        src={uploadedImageUrl}
                        alt="Uploaded preview"
                        className="max-h-32 rounded-md"
                      />
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Translations</h3>
                <div className="flex items-center gap-2">
                  <FormField
                    control={form.control}
                    name="autoTranslate"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div>
                          <FormLabel className="text-xs">
                            Auto Translate
                          </FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="sourceLanguage"
                    render={({ field }) => (
                      <FormItem>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          disabled={!form.watch("autoTranslate")}
                        >
                          <FormControl>
                            <SelectTrigger className="w-[100px]">
                              <SelectValue placeholder="Source" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(LANGUAGES).map(([code, name]) => (
                              <SelectItem key={code} value={code}>
                                {name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <FormField
                control={form.control}
                name="translateTo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Languages to Translate To</FormLabel>
                    <div className="grid grid-cols-1 gap-2 pt-2">
                      {(["en", "uz", "ru"] as const).map((code) => (
                        <label
                          key={code}
                          className={cn(
                            "flex items-center space-x-3 rounded-md border p-3 shadow-sm hover:bg-accent cursor-pointer",
                            Array.isArray(field.value) &&
                              field.value.includes(code) &&
                              "bg-accent"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={
                              Array.isArray(field.value) &&
                              field.value.includes(code)
                            }
                            onChange={(e) => {
                              const currentValue = Array.isArray(field.value)
                                ? field.value
                                : [];
                              const newValue = e.target.checked
                                ? [...currentValue, code]
                                : currentValue.filter((l) => l !== code);
                              field.onChange(newValue);
                            }}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                          <div className="flex flex-1 items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-medium">
                                {LANGUAGES[code]}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground uppercase">
                              {code}
                            </span>
                          </div>
                        </label>
                      ))}
                    </div>
                    <FormDescription>
                      Select the languages you want to translate this
                      notification into.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {!autoTranslate && translateTo.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {translateTo.map((lang) => {
                    if (lang === form.watch("sourceLanguage")) return null;

                    return (
                      <div
                        key={lang}
                        className="space-y-3 p-3 border rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium">
                            {LANGUAGES[lang]}
                          </h4>
                          <span className="text-xs text-muted-foreground uppercase">
                            {lang}
                          </span>
                        </div>
                        <div className="space-y-3">
                          <FormField
                            control={form.control}
                            name={`${lang}Title` as "uzTitle" | "ruTitle"}
                            render={({ field: inputField }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Title</FormLabel>
                                <FormControl>
                                  <Input
                                    {...inputField}
                                    value={inputField.value || ""}
                                    placeholder={form.getValues("title")}
                                    className="h-8"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`${lang}Content` as "uzContent" | "ruContent"}
                            render={({ field: inputField }) => (
                              <FormItem>
                                <FormLabel className="text-xs">
                                  Content
                                </FormLabel>
                                <FormControl>
                                  <Textarea
                                    {...inputField}
                                    value={inputField.value || ""}
                                    placeholder={form.getValues("content")}
                                    className="h-16"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <FormField
                control={form.control}
                name="autoShow"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-2">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div>
                      <FormLabel className="text-sm">Auto Show</FormLabel>
                      <FormDescription className="text-xs">
                        Show automatically when conditions are met
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dismissible"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-2">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div>
                      <FormLabel className="text-sm">Dismissible</FormLabel>
                      <FormDescription className="text-xs">
                        Allow users to dismiss this notification
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="pt-4">
              <Button
                type="submit"
                disabled={isTranslating || isUploading}
                className="w-full sm:w-auto"
              >
                {isTranslating || isUploading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    {isUploading ? "Uploading..." : "Creating..."}
                  </div>
                ) : (
                  "Create Notification"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
