import { useState, useMemo } from 'react'
import './CalendarView.css'

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

function CalendarView({ reviews = [], onDateSelect }) {
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  const [viewMode, setViewMode] = useState('heatmap') // 'heatmap' or 'list'

  // Group reviews by date
  const reviewsByDate = useMemo(() => {
    const grouped = {}
    const dateCounts = {}
    const dateRatings = {}

    reviews.forEach(review => {
      const date = parseDate(review.date)
      if (isNaN(date.getTime())) return

      const dateKey = date.toISOString().split('T')[0]
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = []
        dateCounts[dateKey] = 0
        dateRatings[dateKey] = []
      }
      
      grouped[dateKey].push(review)
      dateCounts[dateKey]++
      dateRatings[dateKey].push(parseInt(review.star_rating) || 0)
    })

    // Calculate average rating and identify crisis days
    const processed = {}
    Object.keys(grouped).forEach(dateKey => {
      const ratings = dateRatings[dateKey]
      const avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length
      const lowRatingCount = ratings.filter(r => r <= 2).length
      const isCrisis = lowRatingCount / ratings.length > 0.5 && ratings.length >= 3

      processed[dateKey] = {
        reviews: grouped[dateKey],
        count: dateCounts[dateKey],
        avgRating,
        isCrisis,
        lowRatingCount
      }
    })

    return processed
  }, [reviews])

  // Get max count for heatmap intensity
  const maxCount = useMemo(() => {
    return Math.max(...Object.values(reviewsByDate).map(d => d.count), 1)
  }, [reviewsByDate])

  // Get days in month
  const getDaysInMonth = (date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days = []
    
    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      days.push({
        day,
        dateKey,
        data: reviewsByDate[dateKey] || null
      })
    }
    
    return days
  }

  const days = getDaysInMonth(selectedMonth)
  const monthYear = selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const navigateMonth = (direction) => {
    const newDate = new Date(selectedMonth)
    newDate.setMonth(selectedMonth.getMonth() + direction)
    setSelectedMonth(newDate)
  }

  const getIntensity = (count) => {
    if (!count) return 0
    return Math.min(100, (count / maxCount) * 100)
  }

  const getColor = (data) => {
    if (!data) return '#f0f0f0'
    if (data.isCrisis) return '#dc3545'
    if (data.avgRating >= 4) return '#28a745'
    if (data.avgRating >= 3) return '#ffc107'
    return '#dc3545'
  }

  // Get crisis days
  const crisisDays = useMemo(() => {
    return Object.entries(reviewsByDate)
      .filter(([_, data]) => data.isCrisis)
      .map(([dateKey, data]) => ({ dateKey, ...data }))
      .sort((a, b) => new Date(b.dateKey) - new Date(a.dateKey))
  }, [reviewsByDate])

  return (
    <div className="calendar-view">
      <div className="calendar-header">
        <h3>Review Timeline</h3>
        <div className="calendar-controls">
          <button onClick={() => navigateMonth(-1)}>‹</button>
          <span className="month-year">{monthYear}</span>
          <button onClick={() => navigateMonth(1)}>›</button>
          <select value={viewMode} onChange={(e) => setViewMode(e.target.value)}>
            <option value="heatmap">Heatmap</option>
            <option value="list">List View</option>
          </select>
        </div>
      </div>

      {viewMode === 'heatmap' ? (
        <>
          <div className="calendar-grid">
            <div className="calendar-weekdays">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="weekday">{day}</div>
              ))}
            </div>
            <div className="calendar-days">
              {days.map((dayData, index) => {
                if (!dayData) {
                  return <div key={`empty-${index}`} className="calendar-day empty" />
                }

                const { day, dateKey, data } = dayData
                const intensity = data ? getIntensity(data.count) : 0
                const color = data ? getColor(data) : '#f0f0f0'

                return (
                  <div
                    key={dateKey}
                    className={`calendar-day ${data ? 'has-data' : ''} ${data?.isCrisis ? 'crisis' : ''}`}
                    style={{
                      backgroundColor: color,
                      opacity: data ? 0.3 + (intensity / 100) * 0.7 : 0.1,
                      cursor: data ? 'pointer' : 'default'
                    }}
                    onClick={() => {
                      if (data && onDateSelect) {
                        onDateSelect(dateKey, data.reviews)
                      }
                    }}
                    title={data ? `${data.count} reviews, avg ${data.avgRating.toFixed(1)} stars${data.isCrisis ? ' (CRISIS DAY)' : ''}` : 'No reviews'}
                  >
                    <span className="day-number">{day}</span>
                    {data && (
                      <span className="day-count">{data.count}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="calendar-legend">
            <div className="legend-item">
              <div className="legend-color" style={{ backgroundColor: '#28a745' }}></div>
              <span>High Rating (≥4)</span>
            </div>
            <div className="legend-item">
              <div className="legend-color" style={{ backgroundColor: '#ffc107' }}></div>
              <span>Medium Rating (3)</span>
            </div>
            <div className="legend-item">
              <div className="legend-color" style={{ backgroundColor: '#dc3545' }}></div>
              <span>Low Rating (≤2)</span>
            </div>
            <div className="legend-item">
              <div className="legend-color crisis-marker"></div>
              <span>Crisis Day</span>
            </div>
          </div>
        </>
      ) : (
        <div className="timeline-list">
          {Object.entries(reviewsByDate)
            .sort((a, b) => new Date(b[0]) - new Date(a[0]))
            .map(([dateKey, data]) => (
              <div
                key={dateKey}
                className={`timeline-item ${data.isCrisis ? 'crisis' : ''}`}
                onClick={() => {
                  if (onDateSelect) {
                    onDateSelect(dateKey, data.reviews)
                  }
                }}
              >
                <div className="timeline-date">
                  {new Date(dateKey).toLocaleDateString('en-US', { 
                    weekday: 'short', 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </div>
                <div className="timeline-stats">
                  <span className="timeline-count">{data.count} reviews</span>
                  <span className="timeline-rating">Avg: {data.avgRating.toFixed(1)}★</span>
                  {data.isCrisis && <span className="crisis-badge">CRISIS</span>}
                </div>
              </div>
            ))}
        </div>
      )}

      {crisisDays.length > 0 && (
        <div className="crisis-alert">
          <strong>⚠️ Crisis Days Detected:</strong>
          <div className="crisis-list">
            {crisisDays.slice(0, 5).map(({ dateKey, count, avgRating }) => (
              <span key={dateKey} className="crisis-day">
                {new Date(dateKey).toLocaleDateString()}: {count} reviews, {avgRating.toFixed(1)}★ avg
              </span>
            ))}
            {crisisDays.length > 5 && <span>...and {crisisDays.length - 5} more</span>}
          </div>
        </div>
      )}
    </div>
  )
}

export default CalendarView
