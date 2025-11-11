import { useState, useEffect, useRef, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import './Reviews.css'

function Reviews({ reviews = [], loading = false, filterWord = null, onClearFilter = null }) {
  const [sortBy, setSortBy] = useState('date-desc')
  const [filterRating, setFilterRating] = useState('all')
  const [isGridView, setIsGridView] = useState(false)
  const [gridColumns, setGridColumns] = useState(3)
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
    let filtered = reviews

    // Filter by word (case-insensitive search in review text)
    if (filterWord) {
      const searchTerm = filterWord.toLowerCase()
      filtered = filtered.filter(review => {
        const reviewText = (review.review_text || '').toLowerCase()
        return reviewText.includes(searchTerm)
      })
    }

    // Filter by rating
    if (filterRating !== 'all') {
      filtered = filtered.filter(review => review.star_rating === filterRating)
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
  }, [reviews, sortBy, filterRating, filterWord])

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

  // Highlight filtered word in text
  const highlightWord = (text, word) => {
    if (!text || !word) return text
    
    const regex = new RegExp(`(${word})`, 'gi')
    return text.split(regex).map((part, index) => {
      if (part.toLowerCase() === word.toLowerCase()) {
        return <mark key={index} className="highlighted-word">{part}</mark>
      }
      return part
    })
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
      
      {filterWord && (
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
              
              return (
                <div key={index} className="review-item">
                <div className="review-card">
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
                    {filterWord ? highlightWord(mainText, filterWord) : mainText}
                  </div>
                  {reply && (
                    <div className="review-reply">
                      <div className="review-reply-label">Reply from Fiverr:</div>
                      <div className="review-reply-text">
                        {filterWord 
                          ? highlightWord(reply.replace(/^Reply\s+from\s+Fiverr?:\s*/i, ''), filterWord)
                          : reply.replace(/^Reply\s+from\s+Fiverr?:\s*/i, '')
                        }
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
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  className="review-item"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div className="review-card">
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
                    {filterWord ? highlightWord(mainText, filterWord) : mainText}
                  </div>
                    {reply && (
                      <div className="review-reply">
                        <div className="review-reply-label">Reply from Fiverr:</div>
                        <div className="review-reply-text">
                        {filterWord 
                          ? highlightWord(reply.replace(/^Reply\s+from\s+Fiverr?:\s*/i, ''), filterWord)
                          : reply.replace(/^Reply\s+from\s+Fiverr?:\s*/i, '')
                        }
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

