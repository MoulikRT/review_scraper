import { useState, useMemo } from 'react'
import './ReviewGrouping.css'

// Calculate Levenshtein distance for similarity
const levenshteinDistance = (str1, str2) => {
  const len1 = str1.length
  const len2 = str2.length
  const matrix = []

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + 1
        )
      }
    }
  }

  return matrix[len1][len2]
}

// Calculate similarity percentage
const calculateSimilarity = (text1, text2) => {
  if (!text1 || !text2) return 0
  const maxLen = Math.max(text1.length, text2.length)
  if (maxLen === 0) return 100
  const distance = levenshteinDistance(text1.toLowerCase(), text2.toLowerCase())
  return ((maxLen - distance) / maxLen) * 100
}

// Extract main review text (without reply)
const extractMainText = (text) => {
  if (!text) return ''
  const replyPattern = /Reply\s+from\s+Fiverr?[:\s]/i
  const match = text.search(replyPattern)
  if (match !== -1) {
    return text.substring(0, match).trim()
  }
  return text.trim()
}

// Extract topics from text
const extractTopics = (text) => {
  if (!text) return []
  const lowerText = text.toLowerCase()
  const topics = []
  
  const topicKeywords = {
    'scam': ['scam', 'fraud', 'fake', 'hack', 'stolen', 'robbery'],
    'fees': ['commission', 'fee', '20%', 'charge', 'deduction', 'transaction fee'],
    'support': ['support', 'customer service', 'help', 'response', 'contact', 'chatbot'],
    'payment': ['payment', 'withdraw', 'funds', 'clearance', 'paypal', '14 days', '14-day'],
    'algorithm': ['algorithm', 'ranking', 'impressions', 'visibility', 'search', 'success score'],
  }
  
  Object.entries(topicKeywords).forEach(([topic, keywords]) => {
    if (keywords.some(kw => lowerText.includes(kw))) {
      topics.push(topic)
    }
  })
  
  return topics
}

function ReviewGrouping({ reviews = [], onGroupSelect }) {
  const [groupingMode, setGroupingMode] = useState('topic')
  const [similarityThreshold, setSimilarityThreshold] = useState(70)
  const [expandedGroups, setExpandedGroups] = useState(new Set())

  const groupedReviews = useMemo(() => {
    if (!reviews || reviews.length === 0) return []

    if (groupingMode === 'topic') {
      // Group by topics
      const groups = {}
      reviews.forEach((review, index) => {
        const mainText = extractMainText(review.review_text)
        const topics = extractTopics(mainText)
        
        if (topics.length === 0) {
          if (!groups['other']) groups['other'] = []
          groups['other'].push({ review, index })
        } else {
          topics.forEach(topic => {
            if (!groups[topic]) groups[topic] = []
            groups[topic].push({ review, index })
          })
        }
      })

      return Object.entries(groups)
        .map(([topic, items]) => ({
          id: topic,
          name: topic.charAt(0).toUpperCase() + topic.slice(1),
          reviews: items.map(item => item.review),
          count: items.length
        }))
        .sort((a, b) => b.count - a.count)
    } else if (groupingMode === 'similarity') {
      // Group by text similarity
      const groups = []
      const processed = new Set()

      reviews.forEach((review, index) => {
        if (processed.has(index)) return

        const mainText = extractMainText(review.review_text)
        const group = {
          id: `group-${index}`,
          name: `Similar Reviews (${mainText.substring(0, 50)}...)`,
          reviews: [review],
          count: 1,
          representative: mainText
        }

        // Find similar reviews
        reviews.forEach((otherReview, otherIndex) => {
          if (otherIndex === index || processed.has(otherIndex)) return

          const otherText = extractMainText(otherReview.review_text)
          const similarity = calculateSimilarity(mainText, otherText)

          if (similarity >= similarityThreshold) {
            group.reviews.push(otherReview)
            group.count++
            processed.add(otherIndex)
          }
        })

        if (group.count > 1) {
          groups.push(group)
          processed.add(index)
        }
      })

      return groups.sort((a, b) => b.count - a.count)
    } else if (groupingMode === 'rating') {
      // Group by rating
      const groups = {}
      reviews.forEach((review) => {
        const rating = review.star_rating || 'unknown'
        if (!groups[rating]) {
          groups[rating] = {
            id: `rating-${rating}`,
            name: `${rating} Star${rating !== '1' ? 's' : ''}`,
            reviews: [],
            count: 0
          }
        }
        groups[rating].reviews.push(review)
        groups[rating].count++
      })

      return Object.values(groups).sort((a, b) => parseInt(b.id.split('-')[1]) - parseInt(a.id.split('-')[1]))
    }

    return []
  }, [reviews, groupingMode, similarityThreshold])

  const toggleGroup = (groupId) => {
    const newExpanded = new Set(expandedGroups)
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId)
    } else {
      newExpanded.add(groupId)
    }
    setExpandedGroups(newExpanded)
  }

  const handleGroupClick = (group) => {
    if (onGroupSelect) {
      onGroupSelect(group.reviews)
    }
  }

  return (
    <div className="review-grouping">
      <div className="grouping-header">
        <h3>Grouped Reviews</h3>
        <div className="grouping-controls">
          <select 
            value={groupingMode} 
            onChange={(e) => setGroupingMode(e.target.value)}
            className="grouping-select"
          >
            <option value="topic">By Topic</option>
            <option value="similarity">By Similarity</option>
            <option value="rating">By Rating</option>
          </select>
          
          {groupingMode === 'similarity' && (
            <div className="similarity-control">
              <label>Similarity Threshold: {similarityThreshold}%</label>
              <input
                type="range"
                min="50"
                max="95"
                value={similarityThreshold}
                onChange={(e) => setSimilarityThreshold(parseInt(e.target.value))}
              />
            </div>
          )}
        </div>
      </div>

      <div className="groups-list">
        {groupedReviews.map((group) => (
          <div key={group.id} className="review-group">
            <div 
              className="group-header"
              onClick={() => toggleGroup(group.id)}
            >
              <div className="group-info">
                <span className="group-name">{group.name}</span>
                <span className="group-count">{group.count} reviews</span>
              </div>
              <button className="group-toggle">
                {expandedGroups.has(group.id) ? '▼' : '▶'}
              </button>
            </div>
            
            {expandedGroups.has(group.id) && (
              <div className="group-content">
                <div className="group-actions">
                  <button 
                    className="group-action-btn"
                    onClick={() => handleGroupClick(group)}
                  >
                    Filter to these reviews
                  </button>
                </div>
                <div className="group-reviews-preview">
                  {group.reviews.slice(0, 5).map((review, idx) => (
                    <div key={idx} className="group-review-preview">
                      <div className="preview-rating">
                        {'★'.repeat(parseInt(review.star_rating) || 0)}
                      </div>
                      <div className="preview-text">
                        {extractMainText(review.review_text).substring(0, 150)}
                        {extractMainText(review.review_text).length > 150 ? '...' : ''}
                      </div>
                    </div>
                  ))}
                  {group.reviews.length > 5 && (
                    <div className="group-more">
                      + {group.reviews.length - 5} more reviews
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {groupedReviews.length === 0 && (
        <div className="no-groups">
          No groups found. Try adjusting the similarity threshold or grouping mode.
        </div>
      )}
    </div>
  )
}

export default ReviewGrouping
