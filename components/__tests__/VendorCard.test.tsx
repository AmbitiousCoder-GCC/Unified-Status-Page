import { expect, test, describe } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VendorCard } from '../VendorCard';

describe('VendorCard', () => {
  const mockStatus: any = {
    vendorId: 'github',
    overallStatus: 'operational',
    statusDescription: 'All Systems Operational',
    uptimePct15d: 100,
    uptimeHistory: [],
    activeIncidents: [],
    pastIncidents: [],
    scheduledMaintenances: [],
    components: []
  };

  test('renders operational badge correctly', () => {
    render(<VendorCard status={mockStatus} onClick={() => {}} />);
    
    expect(screen.getByText('Operational')).toBeInTheDocument();
    // Badge color is dynamic but we can check if it renders the base text
  });

  test('renders outage badge correctly', () => {
    const outageStatus = { ...mockStatus, overallStatus: 'major_outage' };
    render(<VendorCard status={outageStatus} onClick={() => {}} />);
    
    expect(screen.getByText('Major Outage')).toBeInTheDocument();
  });
});
