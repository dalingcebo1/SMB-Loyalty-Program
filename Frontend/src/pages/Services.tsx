// Frontend/src/pages/Services.tsx
import React, { useEffect, useState } from 'react'
import { api } from '../api/api'

export interface Service {
  id: number
  name: string
  base_price: number
  category: string
}

export interface Extra {
  id: number
  name: string
  price_map: Record<string, number>
}

interface CartItem {
  service_id: number
  category: string
  qty: number
  extras: number[]
}

export const Services: React.FC = () => {
  const [categories, setCategories] = useState<Record<string, Service[]>>({})
  const [extrasList, setExtrasList] = useState<Extra[]>([])
  const [selectedCat, setSelectedCat] = useState<string>('')
  const [cart, setCart] = useState<CartItem[]>([])

  useEffect(() => {
    api.get('/catalog/services')
      .then(r => setCategories(r.data))
      .catch(err => console.error('Error loading services:', err))

    api.get('/catalog/extras')
      .then(r => setExtrasList(r.data))
      .catch(err => console.error('Error loading extras:', err))
  }, [])

  const addToCart = (svc: Service) => {
    setCart([...cart, {
      service_id: svc.id,
      category: svc.category,
      qty: 1,
      extras: []
    }])
  }

  const toggleExtra = (idx: number, extraId: number) => {
    setCart(c =>
      c.map((item, i) =>
        i !== idx
          ? item
          : {
              ...item,
              extras: item.extras.includes(extraId)
                ? item.extras.filter(e => e !== extraId)
                : [...item.extras, extraId]
            }
      )
    )
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Pick a Category</h1>
      <select
        value={selectedCat}
        onChange={e => setSelectedCat(e.target.value)}
      >
        <option value="">-- select --</option>
        {Object.keys(categories).map(cat => (
          <option key={cat} value={cat}>{cat}</option>
        ))}
      </select>

      {selectedCat && (
        <div style={{ marginTop: 16 }}>
          <h2>Services —</h2>
          {categories[selectedCat]?.map(svc => (
            <button
              key={svc.id}
              style={{ display: 'block', margin: '8px 0' }}
              onClick={() => addToCart(svc)}
            >
              {svc.name} — R{svc.base_price}
            </button>
          ))}
        </div>
      )}

      {cart.map((item, idx) => (
        <div
          key={idx}
          style={{
            border: '1px solid #ddd',
            padding: 8,
            marginTop: 16,
            borderRadius: 4
          }}
        >
          <strong>
            {categories[item.category].find(s => s.id === item.service_id)?.name}
          </strong>
          <div style={{ marginTop: 8 }}>
            <h4>Add Extras:</h4>
            {extrasList.map(ext => (
              <label key={ext.id} style={{ display: 'block' }}>
                <input
                  type="checkbox"
                  checked={item.extras.includes(ext.id)}
                  onChange={() => toggleExtra(idx, ext.id)}
                />{' '}
                {ext.name} (+R{ext.price_map[item.category] ?? 0})
              </label>
            ))}
          </div>
        </div>
      ))}

      {cart.length > 0 && (
        <button
          onClick={() => window.location.assign('/cart')}
          style={{ marginTop: 24 }}
        >
          Review Cart & Pay
        </button>
      )}
    </div>
  )
}

