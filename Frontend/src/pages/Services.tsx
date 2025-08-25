// src/pages/Services.tsx
import React, { useEffect, useState } from "react";
import api from "../api/api";
import Loading from "../components/Loading";
import ErrorMessage from "../components/ErrorMessage";
import PageLayout from "../components/PageLayout";

interface Service {
  id: number;
  name: string;
  base_price: number;
}

const Services: React.FC = () => {
  // 1) Raw map from the API: category → Service[]
  const [byCategory, setByCategory] = useState<Record<string, Service[]>>({});
  // 2) Dropdown state
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [services, setServices] = useState<Service[]>([]);
  // Loading and error state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch and initialize on mount
  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .get("/catalog/services")
      .then((res) => {
        const data: Record<string, Service[]> = res.data;
        setByCategory(data);
        const cats = Object.keys(data);
        setCategories(cats);
        if (cats.length) {
          setSelectedCategory(cats[0]);
          setServices(data[cats[0]]);
        }
      })
      .catch(() => {
        setError("Failed to load services.");
      })
      .finally(() => setLoading(false));
  }, []);
  
  // Update services list whenever the category changes
  useEffect(() => {
    if (selectedCategory) {
      setServices(byCategory[selectedCategory] || []);
    }
  }, [selectedCategory, byCategory]);
  
  // Loading and error states
  if (loading) {
    return <Loading text="Loading services..." />;
  }
  if (error) {
    return <ErrorMessage message={error} onRetry={() => window.location.reload()} />;
  }

  return (
    <PageLayout>
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
    </PageLayout>
  );
};

export default Services;
