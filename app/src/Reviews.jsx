import { useState, useEffect, useRef, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import AdvancedSearch from './AdvancedSearch'
import ExportTools from './ExportTools'
import ReviewGrouping from './ReviewGrouping'
import CalendarView from './CalendarView'
import Collections from './Collections'
import './Reviews.css'

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

function Reviews({ reviews = [], loading = false, filterWord = null, onClearFilter = null }) {
  const [sortBy, setSortBy] = useState('date-desc')
  const [filterRating, setFilterRating] = useState('all')
  const [isGridView, setIsGridView] = useState(false)
  const [gridColumns, setGridColumns] = useState(3)
  const [advancedFilters, setAdvancedFilters] = useState(null)
  const [showGrouping, setShowGrouping] = useState(false)
  const [groupedReviews, setGroupedReviews] = useState(null)
  const [showCalendar, setShowCalendar] = useState(false)
  const [selectedDateReviews, setSelectedDateReviews] = useState(null)
  const [selectedReviews, setSelectedReviews] = useState(new Set())
  const [collectionReviews, setCollectionReviews] = useState(null)
  const [showCollections, setShowCollections] = useState(false)
  const parentRef = useRef(null)
  const gridContainerRef = useRef(null)

  const getInitials = (name) => {
    if (!name) return '??'
    const parts = name.trim().split(' ')
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  const renderStars = (rating) => {
    const numRating = parseInt(rating)
    return '★'.repeat(numRating) + '☆'.repeat(5 - numRating)
  }

  const getRatingColor = (rating) => {
    const numRating = parseInt(rating)
    if (numRating <= 2) return '#dc3545' // red
    if (numRating === 3) return '#ffc107' // yellow
    return '#28a745' // green
  }

  const parseDate = (dateString) => {
    if (!dateString) return new Date(0)
    
    // Handle "Updated Oct 26, 2025" format
    const updatedMatch = dateString.match(/Updated\s+(.+)/i)
    if (updatedMatch) {
      dateString = updatedMatch[1]
    }
    
    // Handle "X days ago" format
    const daysAgoMatch = dateString.match(/(\d+)\s+days?\s+ago/i)
    if (daysAgoMatch) {
      const daysAgo = parseInt(daysAgoMatch[1])
      const date = new Date()
      date.setDate(date.getDate() - daysAgo)
      return date
    }
    
    // Try parsing as standard date
    const parsed = new Date(dateString)
    if (!isNaN(parsed.getTime())) {
      return parsed
    }
    
    // Fallback to epoch if parsing fails
    return new Date(0)
  }

  const filteredAndSortedReviews = useMemo(() => {
    // Priority: collectionReviews > selectedDateReviews > groupedReviews > filtered reviews
    if (collectionReviews && collectionReviews.length > 0) {
      return collectionReviews
    }
    
    if (selectedDateReviews && selectedDateReviews.length > 0) {
      return selectedDateReviews
    }
    
    if (groupedReviews && groupedReviews.length > 0) {
      return groupedReviews
    }
    
    let filtered = reviews

    // Apply advanced filters if available
    if (advancedFilters) {
      const filters = advancedFilters
      
      // Search text filter
      if (filters.searchText) {
        const searchTerm = filters.searchText.toLowerCase()
        filtered = filtered.filter(review => {
          const reviewText = (review.review_text || '').toLowerCase()
          const reviewerName = (review.reviewer_name || '').toLowerCase()
          
          if (filters.searchInReplies) {
            return reviewText.includes(searchTerm) || reviewerName.includes(searchTerm)
          } else {
            // Extract main text (without reply)
            const replyPattern = /Reply\s+from\s+Fiverr?[:\s]/i
            const match = reviewText.search(replyPattern)
            const mainText = match !== -1 ? reviewText.substring(0, match) : reviewText
            return mainText.includes(searchTerm) || reviewerName.includes(searchTerm)
          }
        })
      }
      
      // Rating filter
      if (filters.filterRating && filters.filterRating !== 'all') {
        filtered = filtered.filter(review => review.star_rating === filters.filterRating)
      }
      
      // User type filter
      if (filters.filterUserType && filters.filterUserType !== 'all') {
        filtered = filtered.filter(review => {
          const userType = detectUserType(review.review_text)
          return userType === filters.filterUserType
        })
      }
      
      // Date range filter
      if (filters.dateRange && (filters.dateRange.start || filters.dateRange.end)) {
        filtered = filtered.filter(review => {
          const reviewDate = parseDate(review.date)
          if (filters.dateRange.start) {
            const startDate = new Date(filters.dateRange.start)
            if (reviewDate < startDate) return false
          }
          if (filters.dateRange.end) {
            const endDate = new Date(filters.dateRange.end)
            endDate.setHours(23, 59, 59, 999) // Include entire end day
            if (reviewDate > endDate) return false
          }
          return true
        })
      }
      
      // Useful count filter
      if (filters.minUsefulCount !== null && filters.minUsefulCount !== undefined) {
        filtered = filtered.filter(review => {
          const usefulCount = parseInt(review.useful_count) || 0
          return usefulCount >= filters.minUsefulCount
        })
      }
      
      // Has reply filter
      if (filters.hasReply && filters.hasReply !== 'all') {
        const hasReplyPattern = /Reply\s+from\s+Fiverr?[:\s]/i
        if (filters.hasReply === 'yes') {
          filtered = filtered.filter(review => hasReplyPattern.test(review.review_text || ''))
        } else {
          filtered = filtered.filter(review => !hasReplyPattern.test(review.review_text || ''))
        }
      }
    } else {
      // Legacy filterWord support
      if (filterWord) {
        const searchTerm = filterWord.toLowerCase()
        filtered = filtered.filter(review => {
          const reviewText = (review.review_text || '').toLowerCase()
          return reviewText.includes(searchTerm)
        })
      }

      // Legacy rating filter
      if (filterRating !== 'all') {
        filtered = filtered.filter(review => review.star_rating === filterRating)
      }
    }

    // Sort reviews
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'rating-desc':
          return parseInt(b.star_rating) - parseInt(a.star_rating)
        case 'rating-asc':
          return parseInt(a.star_rating) - parseInt(b.star_rating)
        case 'date-desc':
          return parseDate(b.date) - parseDate(a.date)
        case 'date-asc':
          return parseDate(a.date) - parseDate(b.date)
        default:
          return 0
      }
    })

    return sorted
  }, [reviews, sortBy, filterRating, filterWord, advancedFilters, groupedReviews, selectedDateReviews, collectionReviews])

  // Calculate grid columns based on container width
  useEffect(() => {
    if (!isGridView) return

    const container = gridContainerRef.current
    if (!container) return

    const updateColumns = () => {
      if (!gridContainerRef.current) return
      
      const containerWidth = gridContainerRef.current.clientWidth
      const minColumnWidth = 280 // minmax(280px, 1fr) from CSS
      const gap = 16 // 1rem gap
      const padding = 32 // 1rem padding on each side
      
      const availableWidth = containerWidth - padding
      const columns = Math.max(1, Math.floor((availableWidth + gap) / (minColumnWidth + gap)))
      setGridColumns(columns)
    }

    updateColumns()
    const resizeObserver = new ResizeObserver(updateColumns)
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
    }
  }, [isGridView])

  // Calculate grid rows for virtualization
  const gridRows = useMemo(() => {
    if (!isGridView) return 0
    return Math.ceil(filteredAndSortedReviews.length / gridColumns)
  }, [isGridView, filteredAndSortedReviews.length, gridColumns])

  const rowHeight = 200 // Initial estimated row height for grid items
  const gridGap = 16 // 1rem gap

  const virtualizer = useVirtualizer({
    count: isGridView ? gridRows : filteredAndSortedReviews.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => isGridView ? rowHeight + gridGap : 120,
    overscan: isGridView ? 2 : 5,
  })


  const parseReviewText = (text) => {
    if (!text) return { mainText: '', reply: null }
    
    // Match patterns like "Reply from Fiverr" or "Reply from Fiver" (case insensitive)
    // Also handles variations like "Reply from Fiverr:" with optional colon
    const replyPattern = /Reply\s+from\s+Fiverr?[:\s]/i
    const match = text.search(replyPattern)
    
    if (match !== -1) {
      const mainText = text.substring(0, match).trim()
      const reply = text.substring(match).trim()
      return { mainText, reply }
    }
    
    return { mainText: text, reply: null }
  }

  // Highlight search terms in text
  const highlightSearchTerms = (text) => {
    if (!text) return text
    
    const searchTerms = getSearchTerms()
    if (searchTerms.length === 0) return text
    
    // Create a regex that matches any of the search terms
    const escapedTerms = searchTerms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    const regex = new RegExp(`(${escapedTerms.join('|')})`, 'gi')
    
    const parts = text.split(regex)
    return parts.map((part, index) => {
      const isMatch = searchTerms.some(term => 
        part.toLowerCase() === term.toLowerCase()
      )
      if (isMatch) {
        return <mark key={index} className="highlighted-word">{part}</mark>
      }
      return part
    })
  }

  // Get search terms for highlighting
  const getSearchTerms = () => {
    if (advancedFilters && advancedFilters.searchText) {
      return advancedFilters.searchText.split(/\s+/).filter(term => term.length > 0)
    }
    if (filterWord) {
      return [filterWord]
    }
    return []
  }

  if (loading) {
    return <div className="loading">Loading reviews...</div>
  }

  if (reviews.length === 0) {
    return (
      <div className="reviews-container">
        <div className="loading">No reviews found. Check console for errors.</div>
      </div>
    )
  }

  return (
    <div className="reviews-container">
      <h1>Trustpilot Reviews ({filteredAndSortedReviews.length} of {reviews.length})</h1>
      
      <AdvancedSearch 
        reviews={reviews}
        onFiltersChange={setAdvancedFilters}
      />
      
      {filterWord && !advancedFilters && (
        <div className="filter-badge">
          <span className="filter-label">Filtered by word:</span>
          <span className="filter-word">"{filterWord}"</span>
          {onClearFilter && (
            <button className="filter-clear" onClick={onClearFilter} title="Clear filter">
              ×
            </button>
          )}
        </div>
      )}
      
      {advancedFilters && advancedFilters.searchText && (
        <div className="filter-badge">
          <span className="filter-label">Search:</span>
          <span className="filter-word">"{advancedFilters.searchText}"</span>
          <button className="filter-clear" onClick={() => setAdvancedFilters(null)} title="Clear filters">
            ×
          </button>
        </div>
      )}

      <ExportTools 
        reviews={reviews}
        filteredReviews={filteredAndSortedReviews}
        filters={advancedFilters}
      />

      <div className="grouping-toggle">
        <button 
          className={`toggle-btn ${showGrouping ? 'active' : ''}`}
          onClick={() => setShowGrouping(!showGrouping)}
        >
          {showGrouping ? '▼' : '▶'} Group Similar Reviews
        </button>
      </div>

      {showGrouping && (
        <ReviewGrouping 
          reviews={filteredAndSortedReviews}
          onGroupSelect={(selectedReviews) => {
            setGroupedReviews(selectedReviews)
            setShowGrouping(false)
          }}
        />
      )}

      {groupedReviews && groupedReviews.length > 0 && (
        <div className="filter-badge">
          <span className="filter-label">Showing grouped reviews:</span>
          <span className="filter-word">{groupedReviews.length} reviews</span>
          <button className="filter-clear" onClick={() => setGroupedReviews(null)} title="Clear grouping">
            ×
          </button>
        </div>
      )}

      {selectedDateReviews && (
        <div className="filter-badge">
          <span className="filter-label">Showing reviews from selected date:</span>
          <span className="filter-word">{selectedDateReviews.length} reviews</span>
          <button className="filter-clear" onClick={() => setSelectedDateReviews(null)} title="Clear date filter">
            ×
          </button>
        </div>
      )}

      <div className="view-toggles">
        <button 
          className={`toggle-btn ${showCalendar ? 'active' : ''}`}
          onClick={() => setShowCalendar(!showCalendar)}
        >
          {showCalendar ? '▼' : '▶'} Calendar View
        </button>
        <button 
          className={`toggle-btn ${showCollections ? 'active' : ''}`}
          onClick={() => setShowCollections(!showCollections)}
        >
          {showCollections ? '▼' : '▶'} Collections
        </button>
        {selectedReviews.size > 0 && (
          <button 
            className="toggle-btn active"
            onClick={() => setSelectedReviews(new Set())}
          >
            Clear Selection ({selectedReviews.size})
          </button>
        )}
      </div>

      {showCollections && (
        <Collections
          selectedReviews={selectedReviews}
          reviews={reviews}
          onCollectionSelect={(reviewIds) => {
            const reviewsToShow = reviews.filter(r => reviewIds.includes(r.source_url))
            setCollectionReviews(reviewsToShow)
            setShowCollections(false)
          }}
        />
      )}

      {collectionReviews && collectionReviews.length > 0 && (
        <div className="filter-badge">
          <span className="filter-label">Showing collection:</span>
          <span className="filter-word">{collectionReviews.length} reviews</span>
          <button className="filter-clear" onClick={() => setCollectionReviews(null)} title="Clear collection">
            ×
          </button>
        </div>
      )}

      {showCalendar && (
        <CalendarView 
          reviews={filteredAndSortedReviews}
          onDateSelect={(dateKey, reviews) => {
            setSelectedDateReviews(reviews)
            setShowCalendar(false)
          }}
        />
      )}
      
      <div className="controls">
        <div className="control-group">
          <label htmlFor="sort-select">Sort by:</label>
          <select
            id="sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="control-select"
          >
            <option value="date-desc">Date (Newest First)</option>
            <option value="date-asc">Date (Oldest First)</option>
            <option value="rating-desc">Rating (High to Low)</option>
            <option value="rating-asc">Rating (Low to High)</option>
          </select>
        </div>

        <div className="control-group">
          <label htmlFor="filter-select">Filter by rating:</label>
          <select
            id="filter-select"
            value={filterRating}
            onChange={(e) => setFilterRating(e.target.value)}
            className="control-select"
          >
            <option value="all">All Ratings</option>
            <option value="5">5 Stars</option>
            <option value="4">4 Stars</option>
            <option value="3">3 Stars</option>
            <option value="2">2 Stars</option>
            <option value="1">1 Star</option>
          </select>
        </div>

        <div className="control-group">
          <button
            onClick={() => setIsGridView(!isGridView)}
            className={`view-toggle ${isGridView ? 'active' : ''}`}
            title={isGridView ? 'Switch to list view' : 'Switch to grid view'}
          >
            {isGridView ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3zM2.5 2a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3zm6.5.5A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3zM10.5 2a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3zM1 10.5A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3zm1.5.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3zm6.5.5a1.5 1.5 0 0 1 1.5-1.5h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3a1.5 1.5 0 0 1-1.5-1.5v-3zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3z"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5z"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      <div ref={parentRef} className={`reviews-list ${isGridView ? 'grid-view' : 'list-view'}`}>
        {isGridView ? (
          <div 
            ref={gridContainerRef}
            className="reviews-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
              gap: `${gridGap}px`,
              padding: '1rem',
              boxSizing: 'border-box',
            }}
          >
            {filteredAndSortedReviews.map((review, index) => {
              const { mainText, reply } = parseReviewText(review.review_text)
              
              const reviewId = review.source_url
              const isSelected = selectedReviews.has(reviewId)
              
              return (
                <div key={index} className={`review-item ${isSelected ? 'selected' : ''}`}>
                <div className="review-card">
                  {selectedReviews.size > 0 && (
                    <div className="review-checkbox">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          const newSelected = new Set(selectedReviews)
                          if (e.target.checked) {
                            newSelected.add(reviewId)
                          } else {
                            newSelected.delete(reviewId)
                          }
                          setSelectedReviews(newSelected)
                        }}
                      />
                    </div>
                  )}
                  <div className="review-header">
                    <div className="reviewer-info">
                      <div className="avatar-container">
                        {review.reviewer_avatar ? (
                          <img
                            src={review.reviewer_avatar}
                            alt={review.reviewer_name}
                            className="reviewer-avatar"
                            loading="lazy"
                            onError={(e) => {
                              e.target.style.display = 'none'
                              const initials = e.target.parentElement.querySelector('.reviewer-initials')
                              if (initials) initials.style.display = 'flex'
                            }}
                          />
                        ) : null}
                        <div
                          className="reviewer-initials"
                          style={{
                            display: review.reviewer_avatar ? 'none' : 'flex',
                          }}
                        >
                          {review.reviewer_initials || getInitials(review.reviewer_name)}
                        </div>
                      </div>
                      <div className="reviewer-details">
                        <a
                          href={review.reviewer_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="reviewer-name"
                        >
                          {review.reviewer_name}
                        </a>
                        <div className="review-meta">
                          <span className="review-date">{review.date}</span>
                          <span 
                            className="review-rating" 
                            title={`${review.star_rating} stars`}
                            style={{ color: getRatingColor(review.star_rating) }}
                          >
                            {renderStars(review.star_rating)} <span className="rating-number">({review.star_rating})</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="review-text">
                    {highlightSearchTerms(mainText)}
                  </div>
                  {reply && (
                    <div className="review-reply">
                      <div className="review-reply-label">Reply from Fiverr:</div>
                      <div className="review-reply-text">
                        {highlightSearchTerms(reply.replace(/^Reply\s+from\s+Fiverr?:\s*/i, ''))}
                      </div>
                    </div>
                  )}
                  <div className="review-footer">
                    <span className="useful-count">
                      {review.useful_count} found this useful
                    </span>
                    <a
                      href={review.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="source-link"
                    >
                      View on Trustpilot →
                    </a>
                  </div>
                </div>
              </div>
            )
            })}
          </div>
        ) : (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const review = filteredAndSortedReviews[virtualRow.index]
              const { mainText, reply } = parseReviewText(review.review_text)
              const reviewId = review.source_url
              const isSelected = selectedReviews.has(reviewId)
              
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  className={`review-item ${isSelected ? 'selected' : ''}`}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div className="review-card">
                    {selectedReviews.size > 0 && (
                      <div className="review-checkbox">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            const newSelected = new Set(selectedReviews)
                            if (e.target.checked) {
                              newSelected.add(reviewId)
                            } else {
                              newSelected.delete(reviewId)
                            }
                            setSelectedReviews(newSelected)
                          }}
                        />
                      </div>
                    )}
                    <div className="review-header">
                      <div className="reviewer-info">
                        <div className="avatar-container">
                          {review.reviewer_avatar ? (
                            <img
                              src={review.reviewer_avatar}
                              alt={review.reviewer_name}
                              className="reviewer-avatar"
                              loading="lazy"
                              onError={(e) => {
                                e.target.style.display = 'none'
                                const initials = e.target.parentElement.querySelector('.reviewer-initials')
                                if (initials) initials.style.display = 'flex'
                              }}
                            />
                          ) : null}
                          <div
                            className="reviewer-initials"
                            style={{
                              display: review.reviewer_avatar ? 'none' : 'flex',
                            }}
                          >
                            {review.reviewer_initials || getInitials(review.reviewer_name)}
                          </div>
                        </div>
                        <div className="reviewer-details">
                          <a
                            href={review.reviewer_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="reviewer-name"
                          >
                            {review.reviewer_name}
                          </a>
                          <div className="review-meta">
                            <span className="review-date">{review.date}</span>
                            <span 
                              className="review-rating" 
                              title={`${review.star_rating} stars`}
                              style={{ color: getRatingColor(review.star_rating) }}
                            >
                              {renderStars(review.star_rating)} <span className="rating-number">({review.star_rating})</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="review-text">
                    {highlightSearchTerms(mainText)}
                  </div>
                    {reply && (
                      <div className="review-reply">
                        <div className="review-reply-label">Reply from Fiverr:</div>
                        <div className="review-reply-text">
                        {highlightSearchTerms(reply.replace(/^Reply\s+from\s+Fiverr?:\s*/i, ''))}
                      </div>
                      </div>
                    )}
                    <div className="review-footer">
                      <span className="useful-count">
                        {review.useful_count} found this useful
                      </span>
                      <a
                        href={review.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="source-link"
                      >
                        View on Trustpilot →
                      </a>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default Reviews
