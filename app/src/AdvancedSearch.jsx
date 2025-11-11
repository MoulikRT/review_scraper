import { useState, useEffect, useMemo } from 'react'
import './AdvancedSearch.css'

// Helper function to detect user type
const detectUserType = (text) => {
  if (!text) return 'unknown'
  const lowerText = text.toLowerCase()
  
  const sellerKeywords = [
    'seller', 'freelancer', 'gig', 'delivery', 'order', 'client', 'buyer',
    'commission', 'fees', 'withdraw', 'payment', 'funds', 'clearance',
    'impressions', 'ranking', 'algorithm', 'success score', 'top rated'
  ]
  
  const buyerKeywords = [
    'hired', 'purchased', 'bought', 'paid', 'service', 'project',
    'developer', 'designer', 'work', 'delivered', 'scammed', 'fraud'
  ]
  
  const sellerCount = sellerKeywords.filter(kw => lowerText.includes(kw)).length
  const buyerCount = buyerKeywords.filter(kw => lowerText.includes(kw)).length
  
  if (sellerCount > buyerCount) return 'seller'
  if (buyerCount > sellerCount) return 'buyer'
  return 'unknown'
}

// Parse date helper
const parseDate = (dateString) => {
  if (!dateString) return new Date(0)
  
  const updatedMatch = dateString.match(/Updated\s+(.+)/i)
  if (updatedMatch) {
    dateString = updatedMatch[1]
  }
  
  const daysAgoMatch = dateString.match(/(\d+)\s+days?\s+ago/i)
  if (daysAgoMatch) {
    const daysAgo = parseInt(daysAgoMatch[1])
    const date = new Date()
    date.setDate(date.getDate() - daysAgo)
    return date
  }
  
  const parsed = new Date(dateString)
  if (!isNaN(parsed.getTime())) {
    return parsed
  }
  
  return new Date(0)
}

function AdvancedSearch({ reviews = [], onFiltersChange, onSaveSearch }) {
  const [searchText, setSearchText] = useState('')
  const [filterRating, setFilterRating] = useState('all')
  const [filterUserType, setFilterUserType] = useState('all')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [searchInReplies, setSearchInReplies] = useState(false)
  const [minUsefulCount, setMinUsefulCount] = useState('')
  const [hasReply, setHasReply] = useState('all')
  const [wordCountFilter, setWordCountFilter] = useState('all')
  const [savedSearches, setSavedSearches] = useState([])
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Load saved searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('review_saved_searches')
    if (saved) {
      try {
        setSavedSearches(JSON.parse(saved))
      } catch (e) {
        console.error('Error loading saved searches:', e)
      }
    }
  }, [])

  // Quick filter presets
  const quickFilters = [
    { name: 'Scam Mentions', search: 'scam', rating: 'all' },
    { name: 'Payment Issues', search: 'payment', rating: 'all' },
    { name: '5-Star Reviews', search: '', rating: '5' },
    { name: 'Recent Complaints', search: 'terrible', rating: '1' },
    { name: 'Support Issues', search: 'support', rating: 'all' },
    { name: 'Commission/Fees', search: 'commission fee', rating: 'all' },
  ]

  const applyQuickFilter = (filter) => {
    setSearchText(filter.search)
    setFilterRating(filter.rating)
    setShowAdvanced(true)
  }

  const saveCurrentSearch = () => {
    const searchName = prompt('Enter a name for this search:')
    if (!searchName) return

    const newSearch = {
      id: Date.now(),
      name: searchName,
      filters: {
        searchText,
        filterRating,
        filterUserType,
        dateRange,
        searchInReplies,
        minUsefulCount,
        hasReply,
        wordCountFilter,
      },
    }

    const updated = [...savedSearches, newSearch]
    setSavedSearches(updated)
    localStorage.setItem('review_saved_searches', JSON.stringify(updated))
    
    if (onSaveSearch) {
      onSaveSearch(newSearch)
    }
  }

  const loadSavedSearch = (savedSearch) => {
    const filters = savedSearch.filters
    setSearchText(filters.searchText || '')
    setFilterRating(filters.filterRating || 'all')
    setFilterUserType(filters.filterUserType || 'all')
    setDateRange(filters.dateRange || { start: '', end: '' })
    setSearchInReplies(filters.searchInReplies || false)
    setMinUsefulCount(filters.minUsefulCount || '')
    setHasReply(filters.hasReply || 'all')
    setWordCountFilter(filters.wordCountFilter || 'all')
    setShowAdvanced(true)
  }

  const deleteSavedSearch = (id) => {
    const updated = savedSearches.filter(s => s.id !== id)
    setSavedSearches(updated)
    localStorage.setItem('review_saved_searches', JSON.stringify(updated))
  }

  const clearFilters = () => {
    setSearchText('')
    setFilterRating('all')
    setFilterUserType('all')
    setDateRange({ start: '', end: '' })
    setSearchInReplies(false)
    setMinUsefulCount('')
    setHasReply('all')
    setWordCountFilter('all')
  }

  // Apply filters and notify parent
  useEffect(() => {
    const filters = {
      searchText,
      filterRating,
      filterUserType,
      dateRange,
      searchInReplies,
      minUsefulCount: minUsefulCount ? parseInt(minUsefulCount) : null,
      hasReply,
      wordCountFilter,
    }
    
    if (onFiltersChange) {
      onFiltersChange(filters)
    }
  }, [searchText, filterRating, filterUserType, dateRange, searchInReplies, minUsefulCount, hasReply, wordCountFilter, onFiltersChange])

  return (
    <div className="advanced-search-container">
      <div className="search-header">
        <div className="search-main">
          <input
            type="text"
            className="search-input"
            placeholder="Search reviews (keywords, phrases, reviewer names...)"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <button
            className="search-toggle"
            onClick={() => setShowAdvanced(!showAdvanced)}
            title="Toggle advanced filters"
          >
            {showAdvanced ? '▼' : '▶'} Advanced
          </button>
        </div>
      </div>

      {showAdvanced && (
        <div className="advanced-filters">
          <div className="filter-row">
            <div className="filter-group">
              <label>Rating:</label>
              <select value={filterRating} onChange={(e) => setFilterRating(e.target.value)}>
                <option value="all">All Ratings</option>
                <option value="5">5 Stars</option>
                <option value="4">4 Stars</option>
                <option value="3">3 Stars</option>
                <option value="2">2 Stars</option>
                <option value="1">1 Star</option>
              </select>
            </div>

            <div className="filter-group">
              <label>User Type:</label>
              <select value={filterUserType} onChange={(e) => setFilterUserType(e.target.value)}>
                <option value="all">All</option>
                <option value="seller">Seller</option>
                <option value="buyer">Buyer</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Has Reply:</label>
              <select value={hasReply} onChange={(e) => setHasReply(e.target.value)}>
                <option value="all">All</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Word Count:</label>
              <select value={wordCountFilter} onChange={(e) => setWordCountFilter(e.target.value)}>
                <option value="all">All</option>
                <option value="short">Short (&lt; 50 words)</option>
                <option value="medium">Medium (50-150 words)</option>
                <option value="large">Large (&gt; 150 words)</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Min Useful Count:</label>
              <input
                type="number"
                value={minUsefulCount}
                onChange={(e) => setMinUsefulCount(e.target.value)}
                placeholder="0"
                min="0"
              />
            </div>
          </div>

          <div className="filter-row">
            <div className="filter-group">
              <label>Date From:</label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              />
            </div>

            <div className="filter-group">
              <label>Date To:</label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              />
            </div>

            <div className="filter-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={searchInReplies}
                  onChange={(e) => setSearchInReplies(e.target.checked)}
                />
                Search in replies
              </label>
            </div>
          </div>

          <div className="filter-actions">
            <button className="btn-secondary" onClick={clearFilters}>
              Clear All
            </button>
            <button className="btn-primary" onClick={saveCurrentSearch}>
              Save Search
            </button>
          </div>
        </div>
      )}

      <div className="quick-filters">
        <span className="quick-filters-label">Quick Filters:</span>
        {quickFilters.map((filter, idx) => (
          <button
            key={idx}
            className="quick-filter-btn"
            onClick={() => applyQuickFilter(filter)}
          >
            {filter.name}
          </button>
        ))}
      </div>

      {savedSearches.length > 0 && (
        <div className="saved-searches">
          <span className="saved-searches-label">Saved Searches:</span>
          {savedSearches.map((search) => (
            <div key={search.id} className="saved-search-item">
              <button
                className="saved-search-btn"
                onClick={() => loadSavedSearch(search)}
              >
                {search.name}
              </button>
              <button
                className="saved-search-delete"
                onClick={() => deleteSavedSearch(search.id)}
                title="Delete saved search"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default AdvancedSearch
