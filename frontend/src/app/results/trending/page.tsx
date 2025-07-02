'use client';

import { Card, Text, Stack, Select, Group, Button, SegmentedControl, Badge } from '@mantine/core';
import { IconTrendingUp, IconDownload, IconCalendar } from '@tabler/icons-react';
import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';

export default function TrendingResultsPage() {
  const [selectedTest, setSelectedTest] = useState('glucose');
  const [timeRange, setTimeRange] = useState('month');

  // Mock data for trending
  const trendData = {
    glucose: [
      { date: '2024-01-01', value: 95, normal: true },
      { date: '2024-01-05', value: 102, normal: true },
      { date: '2024-01-10', value: 110, normal: true },
      { date: '2024-01-12', value: 125, normal: false },
      { date: '2024-01-15', value: 118, normal: true },
    ],
    hemoglobin: [
      { date: '2024-01-01', value: 14.2, normal: true },
      { date: '2024-01-05', value: 14.0, normal: true },
      { date: '2024-01-10', value: 13.8, normal: true },
      { date: '2024-01-12', value: 13.5, normal: true },
      { date: '2024-01-15', value: 13.9, normal: true },
    ],
    creatinine: [
      { date: '2024-01-01', value: 0.9, normal: true },
      { date: '2024-01-05', value: 0.95, normal: true },
      { date: '2024-01-10', value: 1.0, normal: true },
      { date: '2024-01-12', value: 1.1, normal: true },
      { date: '2024-01-15', value: 1.05, normal: true },
    ],
  };

  const testOptions = [
    { value: 'glucose', label: 'Glucose', unit: 'mg/dL', normalRange: '70-110' },
    { value: 'hemoglobin', label: 'Hemoglobin', unit: 'g/dL', normalRange: '13.5-17.5' },
    { value: 'creatinine', label: 'Creatinine', unit: 'mg/dL', normalRange: '0.6-1.2' },
    { value: 'cholesterol', label: 'Total Cholesterol', unit: 'mg/dL', normalRange: '<200' },
    { value: 'blood_pressure', label: 'Blood Pressure', unit: 'mmHg', normalRange: '<120/80' },
  ];

  const currentTest = testOptions.find(t => t.value === selectedTest);
  const data = trendData[selectedTest as keyof typeof trendData] || [];

  return (
    <ProtectedRoute requiredRoles={['physician', 'nurse']}>
      <AppLayout
        title="Trending Results"
        subtitle="Monitor patient lab values and vital signs over time"
      >
        <Stack gap="lg">
          {/* Patient Selection */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group justify="space-between">
              <div>
                <Text size="lg" fw={600}>Current Patient</Text>
                <Text size="sm" c="dimmed">Select a patient to view trending results</Text>
              </div>
              <Button leftSection={<IconCalendar size={16} />}>
                Select Patient
              </Button>
            </Group>
          </Card>

          {/* Controls */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group justify="space-between" mb="md">
              <Select
                label="Select Test"
                placeholder="Choose a test to trend"
                value={selectedTest}
                onChange={(val) => setSelectedTest(val || 'glucose')}
                data={testOptions}
                style={{ width: 250 }}
              />
              <SegmentedControl
                value={timeRange}
                onChange={setTimeRange}
                data={[
                  { label: 'Week', value: 'week' },
                  { label: 'Month', value: 'month' },
                  { label: '3 Months', value: 'quarter' },
                  { label: 'Year', value: 'year' },
                ]}
              />
            </Group>

            {/* Chart */}
            <Card shadow="xs" padding="md" radius="sm" withBorder>
              <Group justify="space-between" mb="md">
                <div>
                  <Text fw={500}>{currentTest?.label} Trend</Text>
                  <Text size="sm" c="dimmed">
                    Normal Range: {currentTest?.normalRange} {currentTest?.unit}
                  </Text>
                </div>
                <Button
                  size="xs"
                  variant="light"
                  leftSection={<IconDownload size={14} />}
                >
                  Export Data
                </Button>
              </Group>
              
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', r: 4 }}
                    name={currentTest?.label}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            {/* Values Table */}
            <Card shadow="xs" padding="md" radius="sm" withBorder mt="md">
              <Text fw={500} mb="sm">Recent Values</Text>
              <Stack gap="xs">
                {data.slice().reverse().map((entry, index) => (
                  <Group key={index} justify="space-between" p="xs" style={{ borderBottom: '1px solid #e0e0e0' }}>
                    <Text size="sm">{entry.date}</Text>
                    <Group gap="xs">
                      <Text size="sm" fw={500} c={entry.normal ? 'green' : 'red'}>
                        {entry.value} {currentTest?.unit}
                      </Text>
                      <Badge size="sm" color={entry.normal ? 'green' : 'red'} variant="light">
                        {entry.normal ? 'Normal' : 'Abnormal'}
                      </Badge>
                    </Group>
                  </Group>
                ))}
              </Stack>
            </Card>
          </Card>

          {/* Additional Trending Options */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Text size="lg" fw={600} mb="md">Multi-Test Comparison</Text>
            <Group>
              <Button variant="light" leftSection={<IconTrendingUp size={16} />}>
                Compare Multiple Tests
              </Button>
              <Button variant="light">
                Add Reference Ranges
              </Button>
              <Button variant="light">
                Set Alert Thresholds
              </Button>
            </Group>
          </Card>
        </Stack>
      </AppLayout>
    </ProtectedRoute>
  );
}