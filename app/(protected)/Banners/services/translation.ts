"use server";

import { Translation } from "../types";
import { LanguageCode } from "./translation-types";

const LANGUAGE_NAMES = {
  uz: "Uzbek",
  ru: "Russian",
  en: "English",
};

async function translateText(
  text: string,
  targetLanguage: LanguageCode
): Promise<string> {
  console.log(`Starting translation to ${LANGUAGE_NAMES[targetLanguage]}:`, {
    text,
  });

  try {
    const apiKey = process.env.CLAUDE_API_KEY;
    if (!apiKey) {
      throw new Error("CLAUDE_API_KEY is not set in environment variables");
    }

    const requestBody = {
      model: "claude-3-opus-20240229",
      max_tokens: 1000,
      system:
        "You are a professional translator. Translate the given text to the specified language. Only return the translation, no explanations or additional text.",
      messages: [
        {
          role: "user",
          content: `Translate the following text to ${LANGUAGE_NAMES[targetLanguage]}: "${text}"`,
        },
      ],
      temperature: 0.3,
    };

    console.log("Making request to Claude API:", {
      url: "https://api.anthropic.com/v1/messages",
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "messages-2023-12-15",
      },
      body: requestBody,
    });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "messages-2023-12-15",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Translation API error:", {
        status: response.status,
        statusText: response.statusText,
        errorText,
      });
      throw new Error(
        `Translation failed: ${response.statusText} - ${errorText}`
      );
    }

    const data = await response.json();
    console.log("Claude API response:", data);

    if (!data.content || !data.content[0] || !data.content[0].text) {
      console.error("Invalid response format:", data);
      throw new Error("Invalid response format from Claude API");
    }

    // Remove any quotes that Claude might add around the translation
    const translation = data.content[0].text.trim().replace(/^["']|["']$/g, "");
    console.log("Translation result:", { original: text, translation });
    return translation;
  } catch (error) {
    console.error("Translation error:", error);
    throw error;
  }
}

export async function generateTranslations(
  title: string,
  content: string,
  sourceLanguage: LanguageCode = "en"
): Promise<Translation[]> {
  console.log("Starting translations generation:", {
    title,
    content,
    sourceLanguage,
  });

  const translations: Translation[] = [];
  const targetLanguages: LanguageCode[] = ["uz", "ru"];

  try {
    for (const lang of targetLanguages) {
      if (lang !== sourceLanguage) {
        console.log(`Translating to ${LANGUAGE_NAMES[lang]}`);
        try {
          const [translatedTitle, translatedContent] = await Promise.all([
            translateText(title, lang),
            translateText(content, lang),
          ]);

          translations.push({
            title: translatedTitle,
            content: translatedContent,
            language: lang,
          });
          console.log(`Successfully translated to ${LANGUAGE_NAMES[lang]}`);
        } catch (error) {
          console.error(
            `Failed to translate to ${LANGUAGE_NAMES[lang]}:`,
            error
          );
          // Continue with other translations even if one fails
          continue;
        }
      }
    }

    console.log("Completed translations:", translations);
    return translations;
  } catch (error) {
    console.error("Error generating translations:", error);
    return [];
  }
}
