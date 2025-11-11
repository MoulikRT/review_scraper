import { useState, useEffect } from 'react'
import Reviews from './Reviews'
import Dashboard from './Dashboard'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState('reviews')
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/trustpilot_reviews.json')
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        return response.json()
      })
      .then((data) => {
        setReviews(data)
        setLoading(false)
      })
      .catch((error) => {
        console.error('Error loading reviews:', error)
        setLoading(false)
      })
  }, [])

  return (
    <div className="app">
      <div className="tabs">
        <button
          className={`tab-button ${activeTab === 'reviews' ? 'active' : ''}`}
          onClick={() => setActiveTab('reviews')}
        >
          Reviews
        </button>
        <button
          className={`tab-button ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          Dashboard
        </button>
      </div>
      {activeTab === 'reviews' ? (
        <Reviews reviews={reviews} loading={loading} />
      ) : (
        <Dashboard reviews={reviews} />
      )}
    </div>
  )
}

export default App
