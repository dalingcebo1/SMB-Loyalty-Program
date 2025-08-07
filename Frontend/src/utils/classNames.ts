// src/utils/classNames.ts

/**
 * Utility to join CSS class names conditionally.
 * Filters out falsy values.
 */
export function classNames(...classes: Array<string | undefined | null | false>): string {
  return classes.filter(Boolean).join(' ');
}
