import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmDeleteDialog } from '../ConfirmDeleteDialog';

describe('ConfirmDeleteDialog', () => {
  it('does not render when open is false', () => {
    render(
      <ConfirmDeleteDialog open={false} onConfirm={() => {}} onCancel={() => {}} />
    );
    expect(screen.queryByText('Confirm Delete')).not.toBeInTheDocument();
  });

  it('renders when open is true', () => {
    render(
      <ConfirmDeleteDialog open={true} onConfirm={() => {}} onCancel={() => {}} />
    );
    expect(screen.getByText('Confirm Delete')).toBeInTheDocument();
    expect(screen.getByText(/cannot be undone/)).toBeInTheDocument();
  });

  it('calls onConfirm when delete button is clicked', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDeleteDialog open={true} onConfirm={onConfirm} onCancel={() => {}} />
    );
    fireEvent.click(screen.getByText('Delete'));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('calls onCancel when cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDeleteDialog open={true} onConfirm={() => {}} onCancel={onCancel} />
    );
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('shows custom title and message', () => {
    render(
      <ConfirmDeleteDialog
        open={true}
        title="Remove Service"
        message="This will permanently remove the service."
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );
    expect(screen.getByText('Remove Service')).toBeInTheDocument();
    expect(screen.getByText('This will permanently remove the service.')).toBeInTheDocument();
  });

  it('shows pending state', () => {
    render(
      <ConfirmDeleteDialog open={true} isPending={true} onConfirm={() => {}} onCancel={() => {}} />
    );
    expect(screen.getByText('Deleting…')).toBeInTheDocument();
  });
});
