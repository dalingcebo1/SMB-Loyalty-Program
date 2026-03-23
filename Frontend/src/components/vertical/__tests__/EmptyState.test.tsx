import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { EmptyState } from '../EmptyState';

describe('EmptyState', () => {
  it('renders default message', () => {
    render(<EmptyState />);
    expect(screen.getByText('No items found')).toBeInTheDocument();
  });

  it('renders custom message', () => {
    render(<EmptyState message="No products available" />);
    expect(screen.getByText('No products available')).toBeInTheDocument();
  });

  it('renders action button when actionLabel and onAction are provided', () => {
    const onAction = vi.fn();
    render(<EmptyState actionLabel="Create New" onAction={onAction} />);
    expect(screen.getByText('Create New')).toBeInTheDocument();
  });

  it('does not render action button when only label is provided', () => {
    render(<EmptyState actionLabel="Create New" />);
    expect(screen.queryByText('Create New')).not.toBeInTheDocument();
  });
});
