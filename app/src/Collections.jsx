import { useState, useEffect } from 'react'
import './Collections.css'

function Collections({ selectedReviews, reviews = [], onCollectionSelect }) {
  const [collections, setCollections] = useState([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [collectionName, setCollectionName] = useState('')

  // Load collections from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('review_collections')
    if (saved) {
      try {
        setCollections(JSON.parse(saved))
      } catch (e) {
        console.error('Error loading collections:', e)
      }
    }
  }, [])

  // Save collections to localStorage
  const saveCollections = (newCollections) => {
    setCollections(newCollections)
    localStorage.setItem('review_collections', JSON.stringify(newCollections))
  }

  const createCollection = () => {
    if (!collectionName.trim() || selectedReviews.size === 0) {
      alert('Please enter a collection name and select reviews first.')
      return
    }

    const newCollection = {
      id: Date.now(),
      name: collectionName.trim(),
      reviewIds: Array.from(selectedReviews),
      createdAt: new Date().toISOString()
    }

    const updated = [...collections, newCollection]
    saveCollections(updated)
    setCollectionName('')
    setShowCreateForm(false)
    alert(`Collection "${newCollection.name}" created with ${selectedReviews.size} reviews!`)
  }

  const deleteCollection = (id) => {
    if (window.confirm('Are you sure you want to delete this collection?')) {
      const updated = collections.filter(c => c.id !== id)
      saveCollections(updated)
    }
  }

  const loadCollection = (collection) => {
    if (onCollectionSelect) {
      // Filter reviews by the stored IDs (using source_url as unique identifier)
      const collectionReviews = reviews.filter(r => collection.reviewIds.includes(r.source_url))
      onCollectionSelect(collectionReviews.map(r => r.source_url))
    }
  }

  const exportCollection = (collection, reviews) => {
    const collectionReviews = reviews.filter(r => collection.reviewIds.includes(r.source_url))
    const dataStr = JSON.stringify(collectionReviews, null, 2)
    const blob = new Blob([dataStr], { type: 'application/json' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `${collection.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="collections-panel">
      <div className="collections-header">
        <h3>Review Collections</h3>
        <button
          className="create-collection-btn"
          onClick={() => setShowCreateForm(!showCreateForm)}
          disabled={selectedReviews.size === 0}
        >
          + Create Collection
        </button>
      </div>

      {showCreateForm && (
        <div className="create-collection-form">
          <input
            type="text"
            placeholder="Collection name..."
            value={collectionName}
            onChange={(e) => setCollectionName(e.target.value)}
            className="collection-name-input"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                createCollection()
              }
            }}
          />
          <div className="form-actions">
            <button className="btn-primary" onClick={createCollection}>
              Create ({selectedReviews.size} reviews)
            </button>
            <button className="btn-secondary" onClick={() => {
              setShowCreateForm(false)
              setCollectionName('')
            }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {collections.length === 0 ? (
        <div className="no-collections">
          <p>No collections yet. Select reviews and create your first collection!</p>
        </div>
      ) : (
        <div className="collections-list">
          {collections.map((collection) => (
            <div key={collection.id} className="collection-item">
              <div className="collection-info">
                <div className="collection-name">{collection.name}</div>
                <div className="collection-meta">
                  {collection.reviewIds.length} reviews • Created {new Date(collection.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div className="collection-actions">
                <button
                  className="collection-action-btn"
                  onClick={() => loadCollection(collection)}
                  title="Load collection"
                >
                  Load
                </button>
                <button
                  className="collection-action-btn delete"
                  onClick={() => deleteCollection(collection.id)}
                  title="Delete collection"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedReviews.size > 0 && (
        <div className="selection-info">
          {selectedReviews.size} review{selectedReviews.size !== 1 ? 's' : ''} selected
        </div>
      )}
    </div>
  )
}

export default Collections
