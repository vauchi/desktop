// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { createSignal, createResource, For, Show, onMount } from 'solid-js';
import {
  getHelpCategories,
  getAllFaqsLocalized,
  searchFaqsLocalized,
  type FaqItem,
  type HelpCategory,
} from '../services/helpService';
import { t, getSelectedLocale } from '../services/i18nService';

interface HelpProps {
  onNavigate: (
    page: 'home' | 'contacts' | 'exchange' | 'settings' | 'devices' | 'recovery' | 'help'
  ) => void;
}

function Help(props: HelpProps) {
  const [categories] = createResource(getHelpCategories);
  const [allFaqs] = createResource(() => getAllFaqsLocalized(getSelectedLocale()));
  const [selectedCategory, setSelectedCategory] = createSignal<string | null>(null);
  const [searchQuery, setSearchQuery] = createSignal('');
  const [searchResults, setSearchResults] = createSignal<FaqItem[] | null>(null);
  const [expandedFaq, setExpandedFaq] = createSignal<string | null>(null);
  const [isSearching, setIsSearching] = createSignal(false);

  const handleSearch = async () => {
    const query = searchQuery().trim();
    if (!query) {
      setSearchResults(null);
      return;
    }
    setIsSearching(true);
    try {
      const results = await searchFaqsLocalized(query, getSelectedLocale());
      setSearchResults(results);
      setSelectedCategory(null);
    } catch (e) {
      console.error('Search failed:', e);
    }
    setIsSearching(false);
  };

  const handleCategorySelect = async (categoryId: string) => {
    setSelectedCategory(categoryId);
    setSearchQuery('');
    setSearchResults(null);
  };

  const clearFilters = () => {
    setSelectedCategory(null);
    setSearchQuery('');
    setSearchResults(null);
  };

  const toggleFaq = (faqId: string) => {
    if (expandedFaq() === faqId) {
      setExpandedFaq(null);
    } else {
      setExpandedFaq(faqId);
    }
  };

  const displayedFaqs = () => {
    if (searchResults() !== null) {
      return searchResults();
    }
    if (selectedCategory()) {
      return allFaqs()?.filter((f) => f.category === selectedCategory()) || [];
    }
    return allFaqs() || [];
  };

  return (
    <div class="page help" role="main" aria-labelledby="help-title">
      <header role="banner">
        <button
          class="back-btn"
          onClick={() => props.onNavigate('settings')}
          aria-label="Go back to settings"
        >
          {t('action.back')}
        </button>
        <h1 id="help-title">{t('help.title')}</h1>
      </header>

      <section class="help-search" aria-label="Search FAQs">
        <div class="search-input-wrapper">
          <input
            type="search"
            placeholder="Search FAQs..."
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            aria-label="Search FAQs"
          />
          <button
            class="search-btn"
            onClick={handleSearch}
            disabled={isSearching()}
            aria-label="Search"
          >
            {isSearching() ? '...' : 'Search'}
          </button>
        </div>
      </section>

      <section class="help-categories" aria-label="FAQ Categories">
        <div class="category-chips" role="group" aria-label="Filter by category">
          <button
            class={`category-chip ${!selectedCategory() && !searchResults() ? 'active' : ''}`}
            onClick={clearFilters}
            aria-pressed={!selectedCategory() && !searchResults()}
          >
            All
          </button>
          <For each={categories()}>
            {(category) => (
              <button
                class={`category-chip ${selectedCategory() === category.id ? 'active' : ''}`}
                onClick={() => handleCategorySelect(category.id)}
                aria-pressed={selectedCategory() === category.id}
              >
                {category.name}
              </button>
            )}
          </For>
        </div>
      </section>

      <Show when={searchResults() !== null}>
        <p class="search-status" role="status">
          {searchResults()?.length === 0
            ? `No results for "${searchQuery()}"`
            : `${searchResults()?.length} results for "${searchQuery()}"`}
        </p>
      </Show>

      <section class="faq-list" aria-label="Frequently Asked Questions">
        <Show when={allFaqs.loading}>
          <div class="loading">Loading FAQs...</div>
        </Show>

        <Show when={!allFaqs.loading}>
          <For each={displayedFaqs()}>
            {(faq) => (
              <div class={`faq-item ${expandedFaq() === faq.id ? 'expanded' : ''}`}>
                <button
                  class="faq-question"
                  onClick={() => toggleFaq(faq.id)}
                  aria-expanded={expandedFaq() === faq.id}
                  aria-controls={`faq-answer-${faq.id}`}
                >
                  <span class="faq-category-badge">{faq.category}</span>
                  <span class="faq-question-text">{faq.question}</span>
                  <span class="faq-toggle" aria-hidden="true">
                    {expandedFaq() === faq.id ? '−' : '+'}
                  </span>
                </button>
                <Show when={expandedFaq() === faq.id}>
                  <div
                    id={`faq-answer-${faq.id}`}
                    class="faq-answer"
                    role="region"
                    aria-labelledby={`faq-question-${faq.id}`}
                  >
                    {faq.answer.split('\n').map((line) => (
                      <p>{line}</p>
                    ))}
                  </div>
                </Show>
              </div>
            )}
          </For>

          <Show when={displayedFaqs()?.length === 0 && !allFaqs.loading}>
            <div class="empty-state">
              <p>No FAQs found.</p>
            </div>
          </Show>
        </Show>
      </section>

      <nav class="bottom-nav" role="navigation" aria-label="Main navigation">
        <button class="nav-btn" onClick={() => props.onNavigate('home')} aria-label="Go to Home">
          {t('nav.home')}
        </button>
        <button
          class="nav-btn"
          onClick={() => props.onNavigate('contacts')}
          aria-label="Go to Contacts"
        >
          {t('nav.contacts')}
        </button>
        <button
          class="nav-btn"
          onClick={() => props.onNavigate('exchange')}
          aria-label="Go to Exchange"
        >
          {t('nav.exchange')}
        </button>
        <button
          class="nav-btn"
          onClick={() => props.onNavigate('settings')}
          aria-label="Go to Settings"
        >
          {t('nav.settings')}
        </button>
      </nav>
    </div>
  );
}

export default Help;
