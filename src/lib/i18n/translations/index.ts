import { en } from './en';
import { uk } from './uk';

export const translations = {
  en,
  uk
} as const;

export type Language = keyof typeof translations;
export type TranslationKey = keyof typeof translations.en;

export type NestedKeyOf<ObjectType extends object> = {
  [Key in keyof ObjectType & (string | number)]: ObjectType[Key] extends object
    ? `${Key}` | `${Key}.${NestedKeyOf<ObjectType[Key]>}`
    : `${Key}`
}[keyof ObjectType & (string | number)];

export type TranslationPath = NestedKeyOf<typeof translations.en>;