import { useState, useEffect, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import './Reviews.css'

function Reviews() {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const parentRef = useRef(null)

  useEffect(() => {
    fetch('/trustpilot_reviews.json')
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        return response.json()
      })
      .then((data) => {
        console.log('Loaded reviews:', data.length)
        setReviews(data)
        setLoading(false)
      })
      .catch((error) => {
        console.error('Error loading reviews:', error)
        setLoading(false)
      })
  }, [])

  const virtualizer = useVirtualizer({
    count: reviews.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 150,
    overscan: 5,
  })

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
      <h1>Trustpilot Reviews ({reviews.length})</h1>
      <div ref={parentRef} className="reviews-list">
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const review = reviews[virtualRow.index]
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
                          <span className="review-rating" title={`${review.star_rating} stars`}>
                            {renderStars(review.star_rating)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="review-text">{mainText}</div>
                  {reply && (
                    <div className="review-reply">
                      <div className="review-reply-label">Reply from Fiverr:</div>
                      <div className="review-reply-text">{reply.replace(/^Reply\s+from\s+Fiverr?:\s*/i, '')}</div>
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
      </div>
    </div>
  )
}

export default Reviews

