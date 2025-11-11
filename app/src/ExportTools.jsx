import { useState } from 'react'
import './ExportTools.css'

function ExportTools({ reviews = [], filteredReviews = [], filters = null }) {
  const [exportFormat, setExportFormat] = useState('csv')

  const exportToCSV = () => {
    const headers = ['Reviewer Name', 'Date', 'Rating', 'Review Text', 'Useful Count', 'Source URL', 'Has Reply']
    const rows = filteredReviews.map(review => {
      const hasReply = /Reply\s+from\s+Fiverr?[:\s]/i.test(review.review_text || '')
      return [
        review.reviewer_name || '',
        review.date || '',
        review.star_rating || '',
        (review.review_text || '').replace(/"/g, '""'), // Escape quotes
        review.useful_count || '0',
        review.source_url || '',
        hasReply ? 'Yes' : 'No'
      ]
    })

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `trustpilot_reviews_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const exportToJSON = () => {
    const dataStr = JSON.stringify(filteredReviews, null, 2)
    const blob = new Blob([dataStr], { type: 'application/json' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `trustpilot_reviews_${new Date().toISOString().split('T')[0]}.json`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const generateShareableLink = () => {
    if (!filters) {
      alert('No filters applied. Share link will show all reviews.')
      return
    }

    const params = new URLSearchParams()
    if (filters.searchText) params.set('search', filters.searchText)
    if (filters.filterRating && filters.filterRating !== 'all') params.set('rating', filters.filterRating)
    if (filters.filterUserType && filters.filterUserType !== 'all') params.set('userType', filters.filterUserType)
    if (filters.dateRange?.start) params.set('dateFrom', filters.dateRange.start)
    if (filters.dateRange?.end) params.set('dateTo', filters.dateRange.end)
    if (filters.hasReply && filters.hasReply !== 'all') params.set('hasReply', filters.hasReply)
    if (filters.minUsefulCount) params.set('minUseful', filters.minUsefulCount)

    const shareUrl = `${window.location.origin}${window.location.pathname}?${params.toString()}`
    
    navigator.clipboard.writeText(shareUrl).then(() => {
      alert('Shareable link copied to clipboard!')
    }).catch(() => {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = shareUrl
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      alert('Shareable link copied to clipboard!')
    })
  }

  const copyMetricsSummary = () => {
    const total = filteredReviews.length
    const ratings = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    let totalRating = 0
    let withReply = 0
    let totalUseful = 0

    filteredReviews.forEach(review => {
      const rating = parseInt(review.star_rating) || 0
      ratings[rating] = (ratings[rating] || 0) + 1
      totalRating += rating
      if (/Reply\s+from\s+Fiverr?[:\s]/i.test(review.review_text || '')) {
        withReply++
      }
      totalUseful += parseInt(review.useful_count) || 0
    })

    const avgRating = total > 0 ? (totalRating / total).toFixed(2) : '0.00'
    const replyRate = total > 0 ? ((withReply / total) * 100).toFixed(1) : '0.0'

    const summary = `Trustpilot Reviews Summary
Total Reviews: ${total}
Average Rating: ${avgRating}/5.0
Rating Distribution:
  5 Stars: ${ratings[5]} (${total > 0 ? ((ratings[5]/total)*100).toFixed(1) : 0}%)
  4 Stars: ${ratings[4]} (${total > 0 ? ((ratings[4]/total)*100).toFixed(1) : 0}%)
  3 Stars: ${ratings[3]} (${total > 0 ? ((ratings[3]/total)*100).toFixed(1) : 0}%)
  2 Stars: ${ratings[2]} (${total > 0 ? ((ratings[2]/total)*100).toFixed(1) : 0}%)
  1 Star: ${ratings[1]} (${total > 0 ? ((ratings[1]/total)*100).toFixed(1) : 0}%)
Response Rate: ${replyRate}%
Total Useful Votes: ${totalUseful}
Generated: ${new Date().toLocaleString()}`

    navigator.clipboard.writeText(summary).then(() => {
      alert('Metrics summary copied to clipboard!')
    }).catch(() => {
      const textarea = document.createElement('textarea')
      textarea.value = summary
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      alert('Metrics summary copied to clipboard!')
    })
  }

  const downloadChartAsImage = (chartId) => {
    const chartElement = document.getElementById(chartId)
    if (!chartElement) {
      alert('Chart not found')
      return
    }

    // Use html2canvas if available, otherwise fallback
    if (window.html2canvas) {
      window.html2canvas(chartElement).then(canvas => {
        const link = document.createElement('a')
        link.download = `chart_${chartId}_${new Date().toISOString().split('T')[0]}.png`
        link.href = canvas.toDataURL()
        link.click()
      })
    } else {
      alert('Chart export requires html2canvas library. Please install it or use screenshot tools.')
    }
  }

  return (
    <div className="export-tools">
      <div className="export-header">
        <h3>Export & Share</h3>
      </div>
      
      <div className="export-actions">
        <div className="export-group">
          <label>Export Format:</label>
          <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value)}>
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
          </select>
          <button 
            className="export-btn"
            onClick={exportFormat === 'csv' ? exportToCSV : exportToJSON}
          >
            Export {exportFormat.toUpperCase()}
          </button>
        </div>

        <div className="export-group">
          <button className="export-btn secondary" onClick={generateShareableLink}>
            Copy Shareable Link
          </button>
        </div>

        <div className="export-group">
          <button className="export-btn secondary" onClick={copyMetricsSummary}>
            Copy Metrics Summary
          </button>
        </div>
      </div>

      <div className="export-info">
        <p>Exporting {filteredReviews.length} of {reviews.length} reviews</p>
        {filters && (
          <div className="export-filters">
            <strong>Active Filters:</strong>
            {filters.searchText && <span>Search: "{filters.searchText}"</span>}
            {filters.filterRating && filters.filterRating !== 'all' && <span>Rating: {filters.filterRating} stars</span>}
            {filters.filterUserType && filters.filterUserType !== 'all' && <span>User: {filters.filterUserType}</span>}
            {filters.dateRange?.start && <span>From: {filters.dateRange.start}</span>}
            {filters.dateRange?.end && <span>To: {filters.dateRange.end}</span>}
          </div>
        )}
      </div>
    </div>
  )
}

export default ExportTools
