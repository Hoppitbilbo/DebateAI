/**
 * @file Provides utility functions for the application.
 */

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * @function cn
 * @description A utility function to merge and conditionally apply CSS classes.
 * It combines the functionality of `clsx` for conditional classes and `tailwind-merge`
 * to resolve conflicting Tailwind CSS classes.
 * @param {...ClassValue[]} inputs - A list of class values to be merged.
 * @returns {string} The merged and optimized class string.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
