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
} from 'recharts'
import './Dashboard.css'

function Dashboard({ reviews }) {
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

  // Process data for charts
  const chartData = useMemo(() => {
    if (!reviews || reviews.length === 0) return null

    // Reviews over time (grouped by date)
    const reviewsByDate = {}
    reviews.forEach((review) => {
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
        }
      }
      reviewsByDate[dateKey].total++
      reviewsByDate[dateKey][review.star_rating]++
      reviewsByDate[dateKey].totalRating += parseInt(review.star_rating)
    })

    // Convert to array and calculate averages
    const timeSeriesData = Object.values(reviewsByDate)
      .map((item) => ({
        ...item,
        averageRating: item.totalRating / item.total,
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
    reviews.forEach((review) => {
      ratingDistribution[review.star_rating]++
    })

    const ratingData = Object.entries(ratingDistribution).map(([rating, count]) => ({
      rating: `${rating} Star${rating !== '1' ? 's' : ''}`,
      count,
      value: count,
    }))

    // Calculate metrics
    const totalReviews = reviews.length
    const averageRating =
      reviews.reduce((sum, r) => sum + parseInt(r.star_rating), 0) / totalReviews
    const positiveReviews = ratingDistribution['4'] + ratingDistribution['5']
    const negativeReviews = ratingDistribution['1'] + ratingDistribution['2']
    const neutralReviews = ratingDistribution['3']
    const positivePercentage = ((positiveReviews / totalReviews) * 100).toFixed(1)
    const negativePercentage = ((negativeReviews / totalReviews) * 100).toFixed(1)

    // Reviews per week
    const reviewsPerWeek = {}
    reviews.forEach((review) => {
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
    }
  }, [reviews])

  if (!chartData) {
    return <div className="dashboard-loading">Loading dashboard data...</div>
  }

  const COLORS = ['#dc3545', '#ffc107', '#ffc107', '#28a745', '#28a745']

  return (
    <div className="dashboard-container">
      <h1>Review Analytics Dashboard</h1>

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
      </div>

      {/* Charts Grid */}
      <div className="charts-grid">
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
      </div>
    </div>
  )
}

export default Dashboard

