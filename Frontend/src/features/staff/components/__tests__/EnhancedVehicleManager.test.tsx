import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../api/api', () => {
  const get = vi.fn();
  const post = vi.fn();
  const del = vi.fn();
  return {
    default: {
      get,
      post,
      delete: del,
    },
  };
});

import EnhancedVehicleManager from '../EnhancedVehicleManager';
import api from '../../../../api/api';

type MockedApi = {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

const mockedApi = api as unknown as MockedApi;

describe('EnhancedVehicleManager', () => {
  beforeEach(() => {
    mockedApi.get.mockReset();
    mockedApi.post.mockReset();
    mockedApi.delete.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('searches vehicles using the shared API client without duplicating /api', async () => {
    mockedApi.get.mockResolvedValue({ data: [] });

    render(<EnhancedVehicleManager />);

    const searchInput = screen.getByPlaceholderText('Search by registration, make, model, or owner name...');
    fireEvent.change(searchInput, { target: { value: 'CA123' } });

    await waitFor(() => expect(mockedApi.get).toHaveBeenCalled());

    expect(mockedApi.get).toHaveBeenCalledWith('/users/vehicles/search', expect.objectContaining({
      params: { q: 'CA123' },
    }));
  });

  it('searches users when adding a vehicle using the shared API client', async () => {
    mockedApi.get.mockResolvedValue({ data: [] });

    render(<EnhancedVehicleManager />);

    const addTab = screen.getByText('Add Vehicle');
    fireEvent.click(addTab);

    const userSearchInput = screen.getByPlaceholderText('Search customer by name or phone...');
    fireEvent.change(userSearchInput, { target: { value: 'Nom' } });

    await waitFor(() => expect(mockedApi.get).toHaveBeenCalled());

    expect(mockedApi.get).toHaveBeenLastCalledWith('/users/search', expect.objectContaining({
      params: { query: 'Nom' },
    }));
  });
});
