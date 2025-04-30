import { useEffect, useState } from "react";
import api from "../api/api";

interface Service {
  id: number;
  name: string;
  base_price: number;
}

export default function CatalogPicker() {
  // Raw map from the API
  const [byCategory, setByCategory] = useState<Record<string, Service[]>>({});
  // Dropdown state
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [services, setServices] = useState<Service[]>([]);

  // 1) Fetch and initialize
  useEffect(() => {
    api
      .get("/catalog/services")
      .then((res) => {
        const data: Record<string, Service[]> = res.data;
        setByCategory(data);

        const cats = Object.keys(data);
        setCategories(cats);
        if (cats.length > 0) {
          setSelectedCategory(cats[0]);
          setServices(data[cats[0]]);
        }
      })
      .catch(console.error);
  }, []);

  // 2) Whenever category changes, update the services list
  useEffect(() => {
    if (selectedCategory) {
      setServices(byCategory[selectedCategory] || []);
    }
  }, [selectedCategory, byCategory]);

  return (
    <div>
      <h2>Pick a Category</h2>
      <select
        value={selectedCategory}
        onChange={(e) => setSelectedCategory(e.target.value)}
      >
        {categories.map((cat) => (
          <option key={cat} value={cat}>
            {cat}
          </option>
        ))}
      </select>

      <h2>Pick a Service</h2>
      <select disabled={!services.length}>
        {services.map((svc) => (
          <option key={svc.id} value={svc.id}>
            {svc.name} — R{svc.base_price}
          </option>
        ))}
      </select>
    </div>
  );
}
