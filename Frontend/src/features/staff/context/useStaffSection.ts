import { useContext } from 'react';
import { StaffSectionContext } from './StaffSectionContext';

export function useStaffSection() {
  return useContext(StaffSectionContext);
}
