import { useState, useEffect, useMemo } from 'react'
import { onValue, off, ref } from 'firebase/database'
import { database } from '@/lib/firebase'
import type { Template, TemplateType } from '@/component/TemplateManager'

const TEMPLATES_PATH = 'templates/instruction-cards'

// Modern templates (can be imported from a separate file)
const MODERN_TEMPLATES: Template[] = []

export interface UseTemplatesParams {
  initialTemplates?: Template[]
}

export interface UseTemplatesReturn {
  templates: Template[]
  filteredTemplates: Template[]
  searchQuery: string
  filterType: TemplateType | 'all'
  setSearchQuery: (query: string) => void
  setFilterType: (type: TemplateType | 'all') => void
}

/**
 * Custom hook for managing templates
 * Handles loading templates from Firebase and filtering
 */
export function useTemplates({ initialTemplates = MODERN_TEMPLATES }: UseTemplatesParams = {}): UseTemplatesReturn {
  const [templates, setTemplates] = useState<Template[]>(initialTemplates)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<TemplateType | 'all'>('all')

  // Load templates from Firebase
  useEffect(() => {
    const templatesRef = ref(database, TEMPLATES_PATH)

    const unsubscribe = onValue(templatesRef, snapshot => {
      if (snapshot.exists()) {
        const templatesData = snapshot.val()
        const loadedTemplates: Template[] = Object.entries(templatesData).map(
          ([id, data]: [string, any]) => ({
            id,
            ...data,
          })
        )
        const allTemplates = [...initialTemplates, ...loadedTemplates]
        setTemplates(allTemplates)
      } else {
        setTemplates(initialTemplates)
      }
    })

    return () => {
      unsubscribe()
      off(templatesRef)
    }
  }, [initialTemplates])

  // Filter templates
  const filteredTemplates = useMemo(() => {
    let filtered = templates

    if (filterType !== 'all') {
      filtered = filtered.filter(t => t.type === filterType)
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        t =>
          t.name.toLowerCase().includes(query) ||
          t.description?.toLowerCase().includes(query) ||
          t.category?.toLowerCase().includes(query) ||
          t.tags?.some(tag => tag.toLowerCase().includes(query))
      )
    }

    return filtered
  }, [templates, filterType, searchQuery])

  return {
    templates,
    filteredTemplates,
    searchQuery,
    filterType,
    setSearchQuery,
    setFilterType,
  }
}
