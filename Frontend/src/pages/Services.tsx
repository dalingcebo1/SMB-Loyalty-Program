// Frontend/src/pages/Services.tsx
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/api'

export type Service = { id: number; name: string; base_price: number }
export type Extra   = { id: number; name: string; price_map: Record<string, number> }

// one line in your Cart.tsx will destructure this shape from location.state
export interface CartItem {
  serviceId: number
  name:      string
  basePrice: number
  qty:       number
  extras:    number[]           // IDs of selected extras
}

const Services: React.FC = () => {
  const navigate = useNavigate()

  // the two payloads
  const [servicesByCat, setServicesByCat] = useState<Record<string,Service[]>>({})
  const [extrasList,    setExtrasList]    = useState<Extra[]>([])

  const [selectedCat,   setSelectedCat]   = useState<string>('')
  const [cart,          setCart]          = useState<CartItem[]>([])

  // load data once
  useEffect(() => {
    api.get<Record<string,Service[]>>('/catalog/services')
      .then(r => {
        setServicesByCat(r.data)
        const cats = Object.keys(r.data)
        if (cats.length) setSelectedCat(cats[0])
      })
      .catch(console.error)

    api.get<Extra[]>('/catalog/extras')
      .then(r => setExtrasList(r.data))
      .catch(console.error)
  }, [])

  // add a new line to the cart
  const handleAdd = (svc: Service) => {
    setCart(c => [
      ...c,
      { serviceId: svc.id, name: svc.name, basePrice: svc.base_price, qty: 1, extras: [] }
    ])
  }

  // toggle one extra on one cart row
  const toggleExtra = (row: number, eid: number) => {
    setCart(c => {
      const copy = [...c]
      const item = copy[row]
      item.extras = item.extras.includes(eid)
        ? item.extras.filter(x => x !== eid)
        : [...item.extras, eid]
      return copy
    })
  }

  // push to /cart with all the state we need
  const goToCart = () => {
    navigate('/cart', { state: { cart, servicesByCat, extrasList, selectedCat } })
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Pick a Category</h1>
      <select
        value={selectedCat}
        onChange={e => setSelectedCat(e.target.value)}
      >
        {Object.keys(servicesByCat).map(cat => (
          <option key={cat} value={cat}>{cat}</option>
        ))}
      </select>

      <h2>Services — {selectedCat}</h2>
      <ul>
        {(servicesByCat[selectedCat] || []).map(svc => (
          <li key={svc.id} style={{ margin: '8px 0' }}>
            {svc.name} — R{svc.base_price}
            <button
              style={{ marginLeft: 8 }}
              onClick={() => handleAdd(svc)}
            >
              Add
            </button>
          </li>
        ))}
      </ul>

      {cart.length > 0 && (
        <>
          <h2>Your Cart</h2>
          {cart.map((item, idx) => (
            <div
              key={idx}
              style={{
                border: '1px solid #ddd',
                padding: 12,
                marginBottom: 12,
              }}
            >
              <strong>{item.name}</strong> (x{item.qty})
              <div style={{ marginTop: 8 }}>
                <em>Extras:</em>
                <div>
                  {extrasList.map(ext => (
                    <label key={ext.id} style={{ marginRight: 12 }}>
                      <input
                        type="checkbox"
                        checked={item.extras.includes(ext.id)}
                        onChange={() => toggleExtra(idx, ext.id)}
                      />{' '}
                      {ext.name} (+R{ext.price_map[selectedCat] ?? 0})
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ))}

          <button onClick={goToCart} style={{ marginTop: 16 }}>
            Review Cart &amp; Pay
          </button>
        </>
      )}
    </div>
  )
}

export default Services
