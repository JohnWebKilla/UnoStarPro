export const LANGUAGES = {
  en: "English",
  uz: "Uzbek",
  ru: "Russian",
} as const;

export type LanguageCode = keyof typeof LANGUAGES;

// DeepL language code mapping
export const DEEPL_LANGUAGE_CODES: Record<LanguageCode, string> = {
  en: "EN",
  ru: "RU",
  uz: "UZ",
};
