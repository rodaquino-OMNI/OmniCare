'use client';

import { Card, Text, Stack, Button, Group, Select, SimpleGrid, Table } from '@mantine/core';
import { DatePicker } from '@mantine/dates';
import { IconFileText, IconDownload, IconCalendar, IconPrinter } from '@tabler/icons-react';
import { useState } from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';

export default function ClinicalReportsPage() {
  const [reportType, setReportType] = useState('');
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);

  const reportTypes = [
    { value: 'patient-summary', label: 'Patient Summary Report' },
    { value: 'clinical-outcomes', label: 'Clinical Outcomes Report' },
    { value: 'medication-adherence', label: 'Medication Adherence Report' },
    { value: 'diagnosis-statistics', label: 'Diagnosis Statistics' },
    { value: 'procedure-analysis', label: 'Procedure Analysis' },
    { value: 'quality-measures', label: 'Quality Measures Report' },
  ];

  const recentReports = [
    { name: 'Monthly Clinical Outcomes', date: '2024-01-10', type: 'PDF', size: '2.4 MB' },
    { name: 'Diabetes Patient Summary', date: '2024-01-08', type: 'Excel', size: '1.8 MB' },
    { name: 'Q4 Quality Measures', date: '2024-01-05', type: 'PDF', size: '3.2 MB' },
    { name: 'Medication Adherence Analysis', date: '2024-01-03', type: 'PDF', size: '1.5 MB' },
  ];

  return (
    <ProtectedRoute requiredRoles={['physician', 'admin']}>
      <AppLayout
        title="Clinical Reports"
        subtitle="View and generate clinical reports"
      >
        <Stack gap="lg">
          {/* Report Generation */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Text size="lg" fw={600} mb="md">Generate New Report</Text>
            
            <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
              <Select
                label="Report Type"
                placeholder="Select report type"
                value={reportType}
                onChange={(val) => setReportType(val || '')}
                data={reportTypes}
                leftSection={<IconFileText size={16} />}
              />
              
              <DatePicker
                type="range"
                label="Date Range"
                placeholder="Select date range"
                value={dateRange}
                onChange={setDateRange}
                leftSection={<IconCalendar size={16} />}
              />
              
              <Select
                label="Format"
                placeholder="Select format"
                defaultValue="pdf"
                data={[
                  { value: 'pdf', label: 'PDF Document' },
                  { value: 'excel', label: 'Excel Spreadsheet' },
                  { value: 'csv', label: 'CSV File' },
                ]}
              />
            </SimpleGrid>
            
            <Group mt="md">
              <Button leftSection={<IconFileText size={16} />}>
                Generate Report
              </Button>
              <Button variant="light" leftSection={<IconPrinter size={16} />}>
                Preview
              </Button>
            </Group>
          </Card>

          {/* Quick Reports */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Text size="lg" fw={600} mb="md">Quick Reports</Text>
            
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
              <Button variant="light" fullWidth leftSection={<IconFileText size={16} />}>
                Daily Census Report
              </Button>
              <Button variant="light" fullWidth leftSection={<IconFileText size={16} />}>
                Active Patients List
              </Button>
              <Button variant="light" fullWidth leftSection={<IconFileText size={16} />}>
                Discharge Summary
              </Button>
              <Button variant="light" fullWidth leftSection={<IconFileText size={16} />}>
                Lab Results Summary
              </Button>
              <Button variant="light" fullWidth leftSection={<IconFileText size={16} />}>
                Medication List
              </Button>
              <Button variant="light" fullWidth leftSection={<IconFileText size={16} />}>
                Appointment Schedule
              </Button>
            </SimpleGrid>
          </Card>

          {/* Recent Reports */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Text size="lg" fw={600} mb="md">Recent Reports</Text>
            
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Report Name</Table.Th>
                  <Table.Th>Date Generated</Table.Th>
                  <Table.Th>Format</Table.Th>
                  <Table.Th>Size</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {recentReports.map((report, index) => (
                  <Table.Tr key={index}>
                    <Table.Td>{report.name}</Table.Td>
                    <Table.Td>{report.date}</Table.Td>
                    <Table.Td>{report.type}</Table.Td>
                    <Table.Td>{report.size}</Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Button size="xs" variant="light" leftSection={<IconDownload size={14} />}>
                          Download
                        </Button>
                        <Button size="xs" variant="subtle">
                          View
                        </Button>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Card>

          {/* Report Templates */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Text size="lg" fw={600} mb="md">Saved Templates</Text>
            <Text size="sm" c="dimmed" mb="md">
              Create and manage report templates for frequently generated reports
            </Text>
            <Button variant="light">
              Manage Templates
            </Button>
          </Card>
        </Stack>
      </AppLayout>
    </ProtectedRoute>
  );
}