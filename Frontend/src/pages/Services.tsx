// src/pages/Services.tsx
import React, { useEffect, useState } from "react";
import api from "../api/api";
import { UserCard, UserHero, UserPage, UserSection } from "../components/user";
import { formatCents } from "../utils/format";
import { track } from "../utils/analytics";
import "./Services.css";
// TODO: migrate styling to design tokens once centralized (design tokens harmonization task)

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
  const [isSwitching, setIsSwitching] = useState(false); // subtle skeleton during category switch

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
      setIsSwitching(true);
      // simulate small delay for skeleton visibility (UX polish)
      const timer = setTimeout(() => {
        setServices(byCategory[selectedCategory] || []);
        setIsSwitching(false);
      }, 120);
      return () => clearTimeout(timer);
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
          variant="compact"
          align="start"
        />
        <UserSection>
          <UserCard muted className="services-state" aria-busy="true">
            <div className="skeleton-lines" aria-hidden="true">
              <p className="skeleton skeleton-text" style={{ width: '60%' }}>Loading services…</p>
              <p className="skeleton skeleton-text" style={{ width: '45%' }}>Fetching catalog…</p>
            </div>
            <p className="visually-hidden">Loading services, please wait.</p>
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
        variant="compact"
        align="start"
      />

      <UserSection title="Choose a category">
        <UserCard className="services-card" padding="loose">
          <label className="services-field">
            <span className="services-label">Service category</span>
            <select
              className="services-select"
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
              aria-label="Select a service category"
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
        </UserCard>
      </UserSection>

      <UserSection title="Available services">
        <UserCard className="services-card" padding="loose">
          {isSwitching && (
            <div className="u-grid u-grid--cols-2" aria-hidden="true">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="service-skeleton">
                  <div className="skeleton skeleton-text" style={{ width: '70%', height: '1rem' }} />
                  <div className="skeleton skeleton-text" style={{ width: '40%', height: '0.875rem', marginTop: '0.4rem' }} />
                  <div className="skeleton skeleton-text" style={{ width: '50%', height: '0.875rem', marginTop: '0.6rem' }} />
                </div>
              ))}
            </div>
          )}
          {!isSwitching && services.length > 0 ? (
            <div className="u-grid u-grid--cols-2 services-grid" data-count={services.length}>
              {services.map((svc) => (
                <div key={svc.id} className="service-card" role="group" aria-label={`${svc.name} service`}>
                  <div className="service-card__header">
                    <h3 className="service-card__title">{svc.name}</h3>
                    <span className="badge badge--neutral">Base price</span>
                  </div>
                  <p className="service-card__price" aria-label="Base price">{formatCents(svc.base_price)}</p>
                  <div className="service-card__actions u-actions">
                    <a
                      href="/order"
                      className="btn btn--secondary btn--sm"
                      onClick={() => track('cta_click', { label: 'Select Service', page: 'Services', service: svc.name })}
                    >
                      Select
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : !isSwitching && (
            <div className="services-state services-state--empty" role="status">
              <p>No services in this category yet.</p>
              <p>Try another category or check back soon.</p>
            </div>
          )}
        </UserCard>
      </UserSection>

      <UserSection>
        <UserCard muted className="services-cta" padding="loose">
          <div>
            <h2 className="surface-card__title">Ready to book?</h2>
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
