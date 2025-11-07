// src/pages/Services.tsx
import React, { useEffect, useState } from "react";
import api from "../api/api";
import { UserCard, UserHero, UserPage, UserSection } from "../components/user";
import { formatCents } from "../utils/format";
import { track } from "../utils/analytics";
import "./Services.css";

interface Service {
  id: number;
  name: string;
  base_price: number;
}

const Services: React.FC = () => {
  const [byCategory, setByCategory] = useState<Record<string, Service[]>>({});
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    track("page_view", { page: "Services" });
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .get("/catalog/services")
      .then((res) => {
        const data: Record<string, Service[]> = res.data;
        setByCategory(data);
        const availableCategories = Object.keys(data);
        setCategories(availableCategories);
        if (availableCategories.length > 0) {
          setSelectedCategory(availableCategories[0]);
          setServices(data[availableCategories[0]]);
        }
      })
      .catch(() => {
        setError("Failed to load services.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedCategory) {
      setServices(byCategory[selectedCategory] || []);
    }
  }, [selectedCategory, byCategory]);

  const handleRetry = () => {
    setSelectedCategory("");
    setServices([]);
    setCategories([]);
    setByCategory({});
    setLoading(true);
    setError(null);
    api
      .get("/catalog/services")
      .then((res) => {
        const data: Record<string, Service[]> = res.data;
        setByCategory(data);
        const availableCategories = Object.keys(data);
        setCategories(availableCategories);
        if (availableCategories.length > 0) {
          setSelectedCategory(availableCategories[0]);
          setServices(data[availableCategories[0]]);
        }
      })
      .catch(() => {
        setError("Failed to load services.");
      })
      .finally(() => setLoading(false));
  };

  if (loading) {
    return (
      <UserPage className="services-page" size="narrow">
        <UserHero
          eyebrow="Services"
          title="Browse our service menu"
          subtitle="We are fetching the most recent catalogue."
          variant="compact"
          align="start"
        />
        <UserSection>
          <UserCard muted className="services-state">
            <p>Loading services, please wait.</p>
          </UserCard>
        </UserSection>
      </UserPage>
    );
  }

  if (error) {
    return (
      <UserPage className="services-page" size="narrow">
        <UserHero
          eyebrow="Services"
          title="Browse our service menu"
          subtitle="We could not load the catalogue right now."
          variant="compact"
          align="start"
        />
        <UserSection>
          <UserCard className="services-state services-state--error">
            <p>{error}</p>
            <button type="button" className="btn btn--primary" onClick={handleRetry}>
              Try again
            </button>
          </UserCard>
        </UserSection>
      </UserPage>
    );
  }

  return (
    <UserPage className="services-page" size="narrow">
      <UserHero
        eyebrow="Services"
        title="Browse our service menu"
        subtitle="Choose a category to see what is available and plan your next visit."
        variant="compact"
        align="start"
      />

      <UserSection title="Choose a category" subtitle="Pick the service family you are interested in.">
        <UserCard className="services-card" padding="loose">
          <label className="services-field">
            <span className="services-label">Service category</span>
            <select
              className="services-select"
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <p className="services-helper">
            Categories group similar services together so you can compare pricing easily.
          </p>
        </UserCard>
      </UserSection>

      <UserSection
        title="Available services"
        subtitle={services.length ? "Select a service to see pricing details." : "No services found in this category."}
      >
        <UserCard className="services-card" padding="loose">
          {services.length > 0 ? (
            <ul className="services-list">
              {services.map((svc) => (
                <li key={svc.id} className="services-item">
                  <div className="services-item__meta">
                    <h3>{svc.name}</h3>
                    <p>Base price</p>
                  </div>
                  <span className="services-item__price">{formatCents(svc.base_price)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="services-state services-state--empty">
              <p>We do not have services listed under this category yet.</p>
              <p>Please select another category or check back soon.</p>
            </div>
          )}
        </UserCard>
      </UserSection>

      <UserSection>
        <UserCard muted className="services-cta" padding="loose">
          <div>
            <h2 className="surface-card__title">Ready to book?</h2>
            <p className="surface-card__subtitle">
              Head to the booking flow to choose a date and confirm your order.
            </p>
          </div>
          <a className="btn btn--primary" href="/order">
            Start booking
          </a>
        </UserCard>
      </UserSection>
    </UserPage>
  );
};

export default Services;
