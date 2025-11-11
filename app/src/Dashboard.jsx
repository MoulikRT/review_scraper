import { useMemo } from 'react'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ComposedChart,
} from 'recharts'
import './Dashboard.css'

// Helper functions
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

const extractReply = (text) => {
  if (!text) return null
  const replyPattern = /Reply\s+from\s+Fiverr?[:\s]/i
  const match = text.search(replyPattern)
  if (match !== -1) {
    return text.substring(match).trim()
  }
  return null
}

const extractMainReview = (text) => {
  if (!text) return ''
  const replyPattern = /Reply\s+from\s+Fiverr?[:\s]/i
  const match = text.search(replyPattern)
  if (match !== -1) {
    return text.substring(0, match).trim()
  }
  return text.trim()
}

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
    'sellers': ['seller', 'freelancer', 'gig', 'delivery', 'orders'],
    'buyers': ['buyer', 'client', 'hired', 'purchased', 'service'],
    'platform': ['platform', 'website', 'app', 'interface', 'user-friendly'],
    'competition': ['competitor', 'alternative', 'upwork', 'freelancer.com'],
  }
  
  Object.entries(topicKeywords).forEach(([topic, keywords]) => {
    if (keywords.some(kw => lowerText.includes(kw))) {
      topics.push(topic)
    }
  })
  
  return topics
}

const extractMoneyAmounts = (text) => {
  if (!text) return []
  const matches = text.match(/\$[\d,]+/g) || []
  return matches.map(m => m.replace(/[$,]/g, '')).map(Number).filter(n => n > 0)
}

const extractTimePeriods = (text) => {
  if (!text) return []
  const patterns = [
    /(\d+)\s*-\s*day/i,
    /(\d+)\s*day/i,
    /(\d+)\s*week/i,
    /(\d+)\s*month/i,
    /(\d+)\s*year/i,
  ]
  const periods = []
  patterns.forEach(pattern => {
    const matches = text.match(new RegExp(pattern.source, 'gi'))
    if (matches) {
      matches.forEach(m => {
        const num = parseInt(m.match(/\d+/)?.[0])
        if (num) periods.push(m.trim())
      })
    }
  })
  return periods
}

const calculateQualityScore = (review) => {
  const text = extractMainReview(review.review_text)
  let score = 0
  
  // Length score (0-30 points)
  const length = text.length
  if (length > 500) score += 30
  else if (length > 200) score += 20
  else if (length > 100) score += 10
  
  // Specificity score (0-30 points) - has numbers, amounts, specific details
  const hasAmount = /\$\d+/.test(text)
  const hasNumbers = /\d+/.test(text)
  const hasSpecificDetails = text.split('.').length > 3
  if (hasAmount) score += 10
  if (hasNumbers) score += 10
  if (hasSpecificDetails) score += 10
  
  // Constructiveness score (0-20 points) - provides feedback, not just complaint
  const hasFeedback = /suggest|recommend|improve|better|should|could/i.test(text)
  if (hasFeedback) score += 20
  
  // Engagement score (0-20 points) - useful count
  score += Math.min(parseInt(review.useful_count) * 2, 20)
  
  return Math.min(score, 100)
}

const calculateWordFrequency = (texts, minLength = 4) => {
  const words = {}
  const stopWords = new Set([
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our',
    'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see',
    'two', 'who', 'way', 'use', 'her', 'she', 'him', 'has', 'had', 'this', 'that', 'with',
    'from', 'they', 'them', 'their', 'there', 'these', 'those', 'have', 'been', 'were',
    'what', 'when', 'where', 'which', 'while', 'will', 'would', 'your', 'about', 'after',
    'before', 'during', 'fiverr', 'fiver', 'platform', 'seller', 'buyer', 'review', 'reviews'
  ])
  
  texts.forEach(text => {
    if (!text) return
    const wordsInText = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= minLength && !stopWords.has(w))
    
    wordsInText.forEach(word => {
      words[word] = (words[word] || 0) + 1
    })
  })
  
  return Object.entries(words)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([word, count]) => ({ word, count }))
}

function Dashboard({ reviews, onWordClick }) {

  // Process data for charts
  const chartData = useMemo(() => {
    if (!reviews || reviews.length === 0) return null

    // Enhanced review processing
    const enhancedReviews = reviews.map(review => {
      const mainText = extractMainReview(review.review_text)
      const reply = extractReply(review.review_text)
      const userType = detectUserType(mainText)
      const topics = extractTopics(mainText)
      const moneyAmounts = extractMoneyAmounts(mainText)
      const timePeriods = extractTimePeriods(mainText)
      const qualityScore = calculateQualityScore(review)
      
      return {
        ...review,
        mainText,
        reply,
        hasReply: !!reply,
        userType,
        topics,
        moneyAmounts,
        timePeriods,
        qualityScore,
        textLength: mainText.length,
      }
    })

    // Reviews over time (grouped by date)
    const reviewsByDate = {}
    enhancedReviews.forEach((review) => {
      const date = parseDate(review.date)
      const dateKey = date.toISOString().split('T')[0]
      if (!reviewsByDate[dateKey]) {
        reviewsByDate[dateKey] = {
          date: dateKey,
          total: 0,
          '1': 0,
          '2': 0,
          '3': 0,
          '4': 0,
          '5': 0,
          totalRating: 0,
          withReply: 0,
          avgQuality: 0,
          qualitySum: 0,
        }
      }
      reviewsByDate[dateKey].total++
      reviewsByDate[dateKey][review.star_rating]++
      reviewsByDate[dateKey].totalRating += parseInt(review.star_rating)
      if (review.hasReply) reviewsByDate[dateKey].withReply++
      reviewsByDate[dateKey].qualitySum += review.qualityScore
    })

    // Convert to array and calculate averages
    const timeSeriesData = Object.values(reviewsByDate)
      .map((item) => ({
        ...item,
        averageRating: item.totalRating / item.total,
        replyRate: (item.withReply / item.total) * 100,
        avgQuality: item.qualitySum / item.total,
        dateLabel: new Date(item.date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date))

    // Rating distribution
    const ratingDistribution = {
      '1': 0,
      '2': 0,
      '3': 0,
      '4': 0,
      '5': 0,
    }
    enhancedReviews.forEach((review) => {
      ratingDistribution[review.star_rating]++
    })

    const ratingData = Object.entries(ratingDistribution).map(([rating, count]) => ({
      rating: `${rating} Star${rating !== '1' ? 's' : ''}`,
      count,
      value: count,
    }))

    // Response rate analysis
    const reviewsByRating = {}
    enhancedReviews.forEach((review) => {
      const rating = review.star_rating
      if (!reviewsByRating[rating]) {
        reviewsByRating[rating] = { total: 0, withReply: 0 }
      }
      reviewsByRating[rating].total++
      if (review.hasReply) {
        reviewsByRating[rating].withReply++
      }
    })

    const responseRateData = Object.entries(reviewsByRating).map(([rating, data]) => ({
      rating: `${rating} Star${rating !== '1' ? 's' : ''}`,
      total: data.total,
      withReply: data.withReply,
      responseRate: (data.withReply / data.total) * 100,
    }))

    // Review length distribution
    const lengthRanges = {
      '0-50': 0,
      '51-100': 0,
      '101-200': 0,
      '201-500': 0,
      '500+': 0,
    }
    
    enhancedReviews.forEach((review) => {
      const len = review.textLength
      if (len <= 50) lengthRanges['0-50']++
      else if (len <= 100) lengthRanges['51-100']++
      else if (len <= 200) lengthRanges['101-200']++
      else if (len <= 500) lengthRanges['201-500']++
      else lengthRanges['500+']++
    })

    const lengthData = Object.entries(lengthRanges).map(([range, count]) => ({
      range,
      count,
    }))

    // Useful count vs rating
    const usefulByRating = {}
    enhancedReviews.forEach((review) => {
      const rating = review.star_rating
      const useful = parseInt(review.useful_count) || 0
      if (!usefulByRating[rating]) {
        usefulByRating[rating] = { total: 0, sum: 0, count: 0 }
      }
      usefulByRating[rating].total++
      usefulByRating[rating].sum += useful
      if (useful > 0) usefulByRating[rating].count++
    })

    const usefulData = Object.entries(usefulByRating).map(([rating, data]) => ({
      rating: `${rating} Star${rating !== '1' ? 's' : ''}`,
      avgUseful: data.sum / data.total,
      reviewsWithUseful: data.count,
      totalReviews: data.total,
    }))

    // Topic frequency
    const topicFrequency = {}
    enhancedReviews.forEach((review) => {
      review.topics.forEach(topic => {
        topicFrequency[topic] = (topicFrequency[topic] || 0) + 1
      })
    })

    const topTopics = Object.entries(topicFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([topic, count]) => ({
        topic: topic.charAt(0).toUpperCase() + topic.slice(1),
        count,
        percentage: ((count / enhancedReviews.length) * 100).toFixed(1),
      }))

    // Topic by rating
    const topicByRating = {}
    enhancedReviews.forEach((review) => {
      const rating = review.star_rating
      review.topics.forEach(topic => {
        if (!topicByRating[topic]) {
          topicByRating[topic] = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 }
        }
        topicByRating[topic][rating]++
      })
    })

    const topicRatingData = Object.entries(topicByRating).map(([topic, ratings]) => ({
      topic: topic.charAt(0).toUpperCase() + topic.slice(1),
      '1': ratings['1'],
      '2': ratings['2'],
      '3': ratings['3'],
      '4': ratings['4'],
      '5': ratings['5'],
      total: Object.values(ratings).reduce((a, b) => a + b, 0),
    })).sort((a, b) => b.total - a.total).slice(0, 8)

    // Seller vs Buyer analysis
    const userTypeStats = {
      seller: { total: 0, ratings: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 } },
      buyer: { total: 0, ratings: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 } },
      unknown: { total: 0, ratings: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 } },
    }

    enhancedReviews.forEach((review) => {
      const type = review.userType
      const rating = review.star_rating
      userTypeStats[type].total++
      userTypeStats[type].ratings[rating]++
    })

    const userTypeData = Object.entries(userTypeStats).map(([type, data]) => ({
      type: type.charAt(0).toUpperCase() + type.slice(1),
      total: data.total,
      avgRating: Object.entries(data.ratings).reduce((sum, [r, count]) => 
        sum + (parseInt(r) * count), 0) / data.total || 0,
      ...data.ratings,
    }))

    // Review quality by rating
    const qualityByRating = {}
    enhancedReviews.forEach((review) => {
      const rating = review.star_rating
      if (!qualityByRating[rating]) {
        qualityByRating[rating] = { sum: 0, count: 0 }
      }
      qualityByRating[rating].sum += review.qualityScore
      qualityByRating[rating].count++
    })

    const qualityData = Object.entries(qualityByRating).map(([rating, data]) => ({
      rating: `${rating} Star${rating !== '1' ? 's' : ''}`,
      avgQuality: data.sum / data.count,
    }))

    // Word frequency by rating
    const wordFreqByRating = {}
    Object.keys(ratingDistribution).forEach(rating => {
      const reviewsForRating = enhancedReviews
        .filter(r => r.star_rating === rating)
        .map(r => r.mainText)
      wordFreqByRating[rating] = calculateWordFrequency(reviewsForRating, 4).slice(0, 10)
    })

    // Overall word frequency for word cloud
    const allReviewTexts = enhancedReviews.map(r => r.mainText)
    const overallWordFreq = calculateWordFrequency(allReviewTexts, 4).slice(0, 50)

    // Temporal volatility (standard deviation of ratings over time)
    const volatilityData = timeSeriesData.map((item, index, arr) => {
      if (index < 7) return null // Need at least 7 days for meaningful volatility
      const window = arr.slice(Math.max(0, index - 7), index + 1)
      const ratings = window.flatMap(w => {
        const result = []
        for (let i = 1; i <= 5; i++) {
          for (let j = 0; j < w[i]; j++) {
            result.push(i)
          }
        }
        return result
      })
      
      if (ratings.length === 0) return { ...item, volatility: 0 }
      
      const mean = ratings.reduce((a, b) => a + b, 0) / ratings.length
      const variance = ratings.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / ratings.length
      const stdDev = Math.sqrt(variance)
      
      return {
        ...item,
        volatility: stdDev,
      }
    }).filter(Boolean)

    // Calculate metrics
    const totalReviews = enhancedReviews.length
    const reviewsWithReply = enhancedReviews.filter(r => r.hasReply).length
    const responseRate = ((reviewsWithReply / totalReviews) * 100).toFixed(1)
    const averageRating =
      enhancedReviews.reduce((sum, r) => sum + parseInt(r.star_rating), 0) / totalReviews
    const positiveReviews = ratingDistribution['4'] + ratingDistribution['5']
    const negativeReviews = ratingDistribution['1'] + ratingDistribution['2']
    const neutralReviews = ratingDistribution['3']
    const positivePercentage = ((positiveReviews / totalReviews) * 100).toFixed(1)
    const negativePercentage = ((negativeReviews / totalReviews) * 100).toFixed(1)
    const avgQualityScore = enhancedReviews.reduce((sum, r) => sum + r.qualityScore, 0) / totalReviews

    // Reviews per week
    const reviewsPerWeek = {}
    enhancedReviews.forEach((review) => {
      const date = parseDate(review.date)
      const weekStart = new Date(date)
      weekStart.setDate(date.getDate() - date.getDay())
      const weekKey = weekStart.toISOString().split('T')[0]
      if (!reviewsPerWeek[weekKey]) {
        reviewsPerWeek[weekKey] = 0
      }
      reviewsPerWeek[weekKey]++
    })

    const weeklyData = Object.entries(reviewsPerWeek)
      .map(([week, count]) => ({
        week: new Date(week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        count,
      }))
      .sort((a, b) => new Date(a.week) - new Date(b.week))
      .slice(-12) // Last 12 weeks

    // Rating migration (compare first half vs second half)
    const sortedByDate = enhancedReviews
      .filter(r => r.date)
      .sort((a, b) => parseDate(a.date) - parseDate(b.date))
    
    const firstHalf = sortedByDate.slice(0, Math.floor(sortedByDate.length / 2))
    const secondHalf = sortedByDate.slice(Math.floor(sortedByDate.length / 2))
    
    const firstHalfAvg = firstHalf.reduce((sum, r) => sum + parseInt(r.star_rating), 0) / firstHalf.length || 0
    const secondHalfAvg = secondHalf.reduce((sum, r) => sum + parseInt(r.star_rating), 0) / secondHalf.length || 0
    const ratingTrend = secondHalfAvg - firstHalfAvg

    return {
      timeSeriesData,
      ratingData,
      totalReviews,
      averageRating,
      positiveReviews,
      negativeReviews,
      neutralReviews,
      positivePercentage,
      negativePercentage,
      weeklyData,
      ratingDistribution,
      responseRateData,
      responseRate,
      reviewsWithReply,
      lengthData,
      usefulData,
      topTopics,
      topicRatingData,
      userTypeData,
      qualityData,
      qualityByRating,
      avgQualityScore,
      wordFreqByRating,
      overallWordFreq,
      volatilityData,
      ratingTrend,
      firstHalfAvg,
      secondHalfAvg,
    }
  }, [reviews])

  if (!chartData) {
    return <div className="dashboard-loading">Loading dashboard data...</div>
  }

  const COLORS = ['#dc3545', '#ffc107', '#ffc107', '#28a745', '#28a745']

  const handleWordClick = (word) => {
    if (onWordClick) {
      onWordClick(word)
    }
  }

  // Calculate font sizes for word cloud based on frequency
  const maxCount = chartData.overallWordFreq[0]?.count || 1
  const minFontSize = 14
  const maxFontSize = 48

  return (
    <div className="dashboard-container">
      <h1>Review Analytics Dashboard</h1>

      {/* Word Cloud */}
      <div className="word-cloud-container">
        <h2>Word Cloud - Click to Filter Reviews</h2>
        <div className="word-cloud">
          {chartData.overallWordFreq.map((item, index) => {
            const fontSize = minFontSize + ((item.count / maxCount) * (maxFontSize - minFontSize))
            const opacity = 0.6 + ((item.count / maxCount) * 0.4)
            return (
              <span
                key={index}
                className="word-cloud-word"
                style={{
                  fontSize: `${fontSize}px`,
                  opacity: opacity,
                  fontWeight: item.count > maxCount * 0.5 ? 700 : item.count > maxCount * 0.3 ? 600 : 500,
                }}
                onClick={() => handleWordClick(item.word)}
                title={`${item.count} mentions - Click to filter reviews`}
              >
                {item.word}
              </span>
            )
          })}
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">Total Reviews</div>
          <div className="metric-value">{chartData.totalReviews.toLocaleString()}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Average Rating</div>
          <div className="metric-value">{chartData.averageRating.toFixed(2)}</div>
          <div className="metric-subtext">out of 5.0</div>
        </div>
        <div className="metric-card positive">
          <div className="metric-label">Positive Reviews</div>
          <div className="metric-value">{chartData.positiveReviews}</div>
          <div className="metric-subtext">{chartData.positivePercentage}% (4-5 stars)</div>
        </div>
        <div className="metric-card negative">
          <div className="metric-label">Negative Reviews</div>
          <div className="metric-value">{chartData.negativeReviews}</div>
          <div className="metric-subtext">{chartData.negativePercentage}% (1-2 stars)</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Response Rate</div>
          <div className="metric-value">{chartData.responseRate}%</div>
          <div className="metric-subtext">{chartData.reviewsWithReply} reviews with replies</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Avg Quality Score</div>
          <div className="metric-value">{chartData.avgQualityScore.toFixed(0)}</div>
          <div className="metric-subtext">out of 100</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Rating Trend</div>
          <div className={`metric-value ${chartData.ratingTrend >= 0 ? 'positive' : 'negative'}`}>
            {chartData.ratingTrend >= 0 ? '+' : ''}{chartData.ratingTrend.toFixed(2)}
          </div>
          <div className="metric-subtext">
            {chartData.firstHalfAvg.toFixed(2)} → {chartData.secondHalfAvg.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="charts-grid">
        {/* Response Rate by Rating */}
        <div className="chart-card">
          <h2>Response Rate by Rating</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData.responseRateData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="rating" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="responseRate" fill="#646cff" name="Response Rate %" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Review Length Distribution */}
        <div className="chart-card">
          <h2>Review Length Distribution</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData.lengthData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="range" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#646cff" name="Number of Reviews" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Useful Count vs Rating */}
        <div className="chart-card">
          <h2>Average Useful Count by Rating</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData.usefulData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="rating" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="avgUseful" fill="#28a745" name="Avg Useful Count" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Topics */}
        <div className="chart-card">
          <h2>Top Issues/Topics</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData.topTopics} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="topic" type="category" width={100} />
              <Tooltip />
              <Bar dataKey="count" fill="#dc3545" name="Mentions" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Topics by Rating */}
        <div className="chart-card full-width">
          <h2>Top Topics by Rating</h2>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={chartData.topicRatingData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="topic" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="1" stackId="a" fill="#dc3545" name="1 Star" />
              <Bar dataKey="2" stackId="a" fill="#ff6b6b" name="2 Stars" />
              <Bar dataKey="3" stackId="a" fill="#ffc107" name="3 Stars" />
              <Bar dataKey="4" stackId="a" fill="#51cf66" name="4 Stars" />
              <Bar dataKey="5" stackId="a" fill="#28a745" name="5 Stars" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Seller vs Buyer Analysis */}
        <div className="chart-card">
          <h2>Seller vs Buyer Reviews</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData.userTypeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="type" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="total" fill="#646cff" name="Total Reviews" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Seller vs Buyer Average Rating */}
        <div className="chart-card">
          <h2>Avg Rating: Seller vs Buyer</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData.userTypeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="type" />
              <YAxis domain={[0, 5]} />
              <Tooltip />
              <Bar dataKey="avgRating" fill="#28a745" name="Avg Rating" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Review Quality by Rating */}
        <div className="chart-card">
          <h2>Review Quality Score by Rating</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData.qualityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="rating" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Bar dataKey="avgQuality" fill="#646cff" name="Quality Score" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Rating Volatility Over Time */}
        {chartData.volatilityData.length > 0 && (
          <div className="chart-card full-width">
            <h2>Rating Volatility Over Time</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData.volatilityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="dateLabel" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="volatility"
                  stroke="#dc3545"
                  strokeWidth={2}
                  name="Volatility (Std Dev)"
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Reviews Over Time */}
        <div className="chart-card">
          <h2>Reviews Over Time</h2>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData.timeSeriesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="dateLabel" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area
                type="monotone"
                dataKey="total"
                stroke="#646cff"
                fill="#646cff"
                fillOpacity={0.6}
                name="Total Reviews"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Average Rating Over Time */}
        <div className="chart-card">
          <h2>Average Rating Over Time</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData.timeSeriesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="dateLabel" />
              <YAxis domain={[0, 5]} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="averageRating"
                stroke="#28a745"
                strokeWidth={2}
                name="Avg Rating"
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Rating Distribution Pie */}
        <div className="chart-card">
          <h2>Rating Distribution</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData.ratingData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ rating, percent }) => `${rating}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.ratingData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Reviews by Rating Bar Chart */}
        <div className="chart-card">
          <h2>Reviews by Rating</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData.ratingData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="rating" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#646cff">
                {chartData.ratingData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Star Reviews Over Time */}
        <div className="chart-card full-width">
          <h2>Star Reviews Over Time</h2>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={chartData.timeSeriesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="dateLabel" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="5"
                stroke="#28a745"
                strokeWidth={2}
                name="5 Stars"
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="4"
                stroke="#28a745"
                strokeWidth={2}
                name="4 Stars"
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="3"
                stroke="#ffc107"
                strokeWidth={2}
                name="3 Stars"
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="2"
                stroke="#dc3545"
                strokeWidth={2}
                name="2 Stars"
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="1"
                stroke="#dc3545"
                strokeWidth={2}
                name="1 Star"
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Reviews Per Week */}
        <div className="chart-card full-width">
          <h2>Reviews Per Week (Last 12 Weeks)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData.weeklyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#646cff" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Word Frequency by Rating */}
        <div className="chart-card full-width">
          <h2>Top Words by Rating</h2>
          <div className="word-frequency-grid">
            {Object.entries(chartData.wordFreqByRating).map(([rating, words]) => (
              <div key={rating} className="word-frequency-card">
                <h3>{rating} Star{rating !== '1' ? 's' : ''}</h3>
                <div className="word-list">
                  {words.map((word, idx) => (
                    <span
                      key={idx}
                      className="word-tag"
                      style={{
                        fontSize: `${12 + (word.count / words[0].count) * 8}px`,
                        opacity: 0.7 + (word.count / words[0].count) * 0.3,
                      }}
                    >
                      {word.word} ({word.count})
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
