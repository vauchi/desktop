/**
 * Help Service
 *
 * Provides access to FAQ and help content.
 */

import { invoke } from '@tauri-apps/api/core';

export interface FaqItem {
  id: string;
  category: string;
  question: string;
  answer: string;
  related: string[];
}

export interface HelpCategory {
  id: string;
  name: string;
}

/**
 * Get all help categories.
 */
export async function getHelpCategories(): Promise<HelpCategory[]> {
  return await invoke<HelpCategory[]>('get_help_categories');
}

/**
 * Get all FAQ items.
 */
export async function getAllFaqs(): Promise<FaqItem[]> {
  return await invoke<FaqItem[]>('get_all_faqs');
}

/**
 * Get FAQs for a specific category.
 */
export async function getFaqsByCategory(category: string): Promise<FaqItem[]> {
  return await invoke<FaqItem[]>('get_category_faqs', { category });
}

/**
 * Get a specific FAQ by ID.
 */
export async function getFaq(faqId: string): Promise<FaqItem | null> {
  return await invoke<FaqItem | null>('get_faq', { faqId });
}

/**
 * Search FAQs by query.
 */
export async function searchFaqs(query: string): Promise<FaqItem[]> {
  return await invoke<FaqItem[]>('search_help', { query });
}
