import { expect, test, describe } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VendorCard } from '../VendorCard';

describe('VendorCard', () => {
  const mockStatus: any = {
    vendorId: '00000000-0000-4000-8000-000000000001',
    overallStatus: 'operational',
    statusDescription: 'All Systems Operational',
    uptimePct15d: 100,
    uptimeHistory: [],
    activeIncidents: [],
    pastIncidents: [],
    scheduledMaintenances: [],
    components: [],
    fetchedAt: new Date().toISOString()
  };

  test('renders operational badge correctly', () => {
    render(<VendorCard status={mockStatus} onClick={() => {}} index={0} />);
    
    expect(screen.getByText(/operational/i)).toBeInTheDocument();
  });

  test('renders outage badge correctly', () => {
    const outageStatus = { ...mockStatus, overallStatus: 'major_outage' };
    render(<VendorCard status={outageStatus} onClick={() => {}} index={0} />);
    
    expect(screen.getByText(/major outage/i)).toBeInTheDocument();
  });
});
