/**
 * src/content/engine/SmartCase.ts
 */

export function applyCasing(originalTyped: string, expansionText: string, forceCapitalize: boolean): string {
  if (!originalTyped) return expansionText;

  if (forceCapitalize) {
    return capitalizeFirstLetter(expansionText);
  }

  const isAllUpper = originalTyped === originalTyped.toUpperCase() && /[A-Z]/.test(originalTyped);
  const isFirstUpper = originalTyped[0] === originalTyped[0].toUpperCase() && /[A-Z]/.test(originalTyped[0]);

  if (isAllUpper) {
    return expansionText.toUpperCase();
  }

  if (isFirstUpper) {
    return capitalizeFirstLetter(expansionText);
  }

  // Otherwise, all lowercase or mixed, leave as is
  return expansionText;
}

function capitalizeFirstLetter(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}
