# Clinical Workflow API Integration Examples

## Table of Contents
1. [Quick Start](#quick-start)
2. [JavaScript/TypeScript SDK](#javascripttypescript-sdk)
3. [Python Integration](#python-integration)
4. [React Integration](#react-integration)
5. [Mobile Integration](#mobile-integration)
6. [Webhook Integration](#webhook-integration)
7. [Real-World Scenarios](#real-world-scenarios)

## Quick Start

### Prerequisites
- API credentials (client ID and secret)
- Base API URL: `https://api.omnicare.com`
- Valid user credentials or API key

### Basic Setup

```javascript
// Environment variables
const API_BASE_URL = process.env.OMNICARE_API_URL || 'https://api.omnicare.com';
const CLIENT_ID = process.env.OMNICARE_CLIENT_ID;
const CLIENT_SECRET = process.env.OMNICARE_CLIENT_SECRET;
```

## JavaScript/TypeScript SDK

### Complete TypeScript SDK

```typescript
// omnicare-sdk.ts
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

export interface OmniCareConfig {
  baseURL: string;
  clientId?: string;
  clientSecret?: string;
  onTokenRefresh?: (token: string) => void;
}

export interface LoginCredentials {
  username: string;
  password: string;
  mfaToken?: string;
}

export interface Task {
  id?: string;
  resourceType: 'Task';
  status: 'requested' | 'accepted' | 'in-progress' | 'completed' | 'cancelled' | 'failed';
  priority: 'routine' | 'urgent' | 'asap' | 'stat';
  description: string;
  for?: { reference: string };
  owner?: { reference: string };
  authoredOn?: string;
  lastModified?: string;
  code?: {
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
  };
}

export interface CreateTaskRequest {
  patientId: string;
  practitionerId?: string;
  description: string;
  priority?: 'routine' | 'urgent' | 'asap' | 'stat';
  category?: string;
  code?: {
    code: string;
    display: string;
  };
  dueDate?: string;
  encounterId?: string;
  serviceRequestId?: string;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  tasks: Array<{
    category: string;
    description: string;
    priority: string;
    dueDateOffset: number;
  }>;
}

export class OmniCareSDK {
  private api: AxiosInstance;
  private accessToken?: string;
  private refreshToken?: string;
  private config: OmniCareConfig;

  constructor(config: OmniCareConfig) {
    this.config = config;
    this.api = axios.create({
      baseURL: config.baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor
    this.api.interceptors.request.use(
      (config) => {
        if (this.accessToken) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for token refresh
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        
        if (error.response?.status === 401 && !originalRequest._retry && this.refreshToken) {
          originalRequest._retry = true;
          
          try {
            await this.refreshAccessToken();
            originalRequest.headers.Authorization = `Bearer ${this.accessToken}`;
            return this.api(originalRequest);
          } catch (refreshError) {
            this.logout();
            throw refreshError;
          }
        }
        
        return Promise.reject(error);
      }
    );
  }

  // Authentication Methods
  async login(credentials: LoginCredentials) {
    const response = await this.api.post('/api/auth/login', credentials);
    const { accessToken, refreshToken, user } = response.data;
    
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    
    if (this.config.onTokenRefresh) {
      this.config.onTokenRefresh(accessToken);
    }
    
    return { user, accessToken };
  }

  async logout() {
    try {
      await this.api.post('/api/auth/logout');
    } finally {
      this.accessToken = undefined;
      this.refreshToken = undefined;
    }
  }

  async refreshAccessToken() {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }
    
    const response = await this.api.post('/api/auth/refresh', {
      refreshToken: this.refreshToken,
    });
    
    this.accessToken = response.data.accessToken;
    
    if (this.config.onTokenRefresh) {
      this.config.onTokenRefresh(this.accessToken);
    }
  }

  // Task Management Methods
  async createTask(task: CreateTaskRequest): Promise<Task> {
    const response = await this.api.post('/api/clinical-workflow/tasks', task);
    return response.data.task;
  }

  async getTasks(params?: {
    status?: string;
    priority?: string;
    category?: string;
    patient?: string;
    practitioner?: string;
    _count?: number;
    _sort?: string;
  }): Promise<{ tasks: Task[]; total: number }> {
    const response = await this.api.get('/api/clinical-workflow/tasks', { params });
    return response.data;
  }

  async getTask(taskId: string): Promise<Task> {
    const response = await this.api.get(`/api/clinical-workflow/tasks/${taskId}`);
    return response.data;
  }

  async updateTaskStatus(taskId: string, status: Task['status'], note?: string): Promise<Task> {
    const response = await this.api.patch(`/api/clinical-workflow/tasks/${taskId}/status`, {
      status,
      note,
    });
    return response.data.task;
  }

  async assignTask(taskId: string, practitionerId?: string, note?: string): Promise<Task> {
    const response = await this.api.patch(`/api/clinical-workflow/tasks/${taskId}/assign`, {
      practitionerId,
      note,
    });
    return response.data.task;
  }

  async getPatientTasks(patientId: string, status?: string): Promise<{ tasks: Task[]; total: number }> {
    const response = await this.api.get(`/api/clinical-workflow/patients/${patientId}/tasks`, {
      params: { status },
    });
    return response.data;
  }

  async getPractitionerTasks(
    practitionerId: string,
    filters?: { status?: string; priority?: string }
  ): Promise<{ tasks: Task[]; total: number }> {
    const response = await this.api.get(
      `/api/clinical-workflow/practitioners/${practitionerId}/tasks`,
      { params: filters }
    );
    return response.data;
  }

  // Workflow Methods
  async createWorkflow(params: {
    templateId: string;
    patientId: string;
    encounterId?: string;
    parameters?: Record<string, any>;
  }) {
    const response = await this.api.post('/api/clinical-workflow/workflows', params);
    return response.data;
  }

  async getWorkflowTemplates(): Promise<WorkflowTemplate[]> {
    const response = await this.api.get('/api/clinical-workflow/templates');
    return response.data.templates;
  }

  // Utility Methods
  setAccessToken(token: string) {
    this.accessToken = token;
  }

  setRefreshToken(token: string) {
    this.refreshToken = token;
  }

  getAccessToken(): string | undefined {
    return this.accessToken;
  }
}

// Export singleton instance
export const omnicare = new OmniCareSDK({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'https://api.omnicare.com',
});
```

### Usage Examples

```typescript
import { omnicare } from './omnicare-sdk';

// Login
async function loginExample() {
  try {
    const { user, accessToken } = await omnicare.login({
      username: 'dr.smith',
      password: 'SecurePass123!',
      mfaToken: '123456'
    });
    
    console.log('Logged in as:', user.username);
    console.log('Role:', user.role);
    
    // Store token in secure storage
    secureStorage.setItem('accessToken', accessToken);
  } catch (error) {
    console.error('Login failed:', error.response?.data);
  }
}

// Create a task
async function createTaskExample() {
  try {
    const task = await omnicare.createTask({
      patientId: 'patient-123',
      description: 'Complete initial assessment',
      priority: 'urgent',
      category: 'assessment',
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });
    
    console.log('Task created:', task.id);
  } catch (error) {
    console.error('Failed to create task:', error.response?.data);
  }
}

// Get and update tasks
async function taskManagementExample() {
  // Get all urgent tasks
  const { tasks } = await omnicare.getTasks({
    priority: 'urgent',
    status: 'requested',
    _count: 50
  });
  
  console.log(`Found ${tasks.length} urgent tasks`);
  
  // Update first task status
  if (tasks.length > 0) {
    const updatedTask = await omnicare.updateTaskStatus(
      tasks[0].id!,
      'in-progress',
      'Starting assessment now'
    );
    
    console.log('Task updated:', updatedTask.status);
  }
}

// Create workflow from template
async function workflowExample() {
  // Get available templates
  const templates = await omnicare.getWorkflowTemplates();
  
  // Find admission workflow
  const admissionTemplate = templates.find(t => t.id === 'admission-workflow');
  
  if (admissionTemplate) {
    const workflow = await omnicare.createWorkflow({
      templateId: admissionTemplate.id,
      patientId: 'patient-123',
      encounterId: 'encounter-456',
      parameters: {
        urgency: 'high',
        department: 'Emergency'
      }
    });
    
    console.log('Created workflow with tasks:', workflow.tasks.length);
  }
}
```

## Python Integration

### Complete Python Client

```python
# omnicare_client.py
import requests
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
import json
from urllib.parse import urljoin

class OmniCareClient:
    """OmniCare Clinical Workflow API Client"""
    
    def __init__(self, base_url: str, client_id: Optional[str] = None, 
                 client_secret: Optional[str] = None):
        self.base_url = base_url.rstrip('/')
        self.client_id = client_id
        self.client_secret = client_secret
        self.access_token = None
        self.refresh_token = None
        self.token_expires_at = None
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })
    
    def _request(self, method: str, endpoint: str, **kwargs) -> requests.Response:
        """Make authenticated request with automatic token refresh"""
        url = urljoin(self.base_url, endpoint)
        
        # Check if token needs refresh
        if self.access_token and self.token_expires_at:
            if datetime.now() >= self.token_expires_at - timedelta(minutes=1):
                self.refresh_access_token()
        
        # Add authorization header
        if self.access_token:
            self.session.headers['Authorization'] = f'Bearer {self.access_token}'
        
        response = self.session.request(method, url, **kwargs)
        
        # Handle token expiration
        if response.status_code == 401 and self.refresh_token:
            self.refresh_access_token()
            response = self.session.request(method, url, **kwargs)
        
        response.raise_for_status()
        return response
    
    def login(self, username: str, password: str, mfa_token: Optional[str] = None) -> Dict:
        """Authenticate user and store tokens"""
        data = {
            'username': username,
            'password': password
        }
        if mfa_token:
            data['mfaToken'] = mfa_token
        
        response = self._request('POST', '/api/auth/login', json=data)
        result = response.json()
        
        self.access_token = result['accessToken']
        self.refresh_token = result['refreshToken']
        self.token_expires_at = datetime.now() + timedelta(seconds=result.get('expiresIn', 900))
        
        return result['user']
    
    def logout(self):
        """Logout and clear tokens"""
        try:
            self._request('POST', '/api/auth/logout')
        finally:
            self.access_token = None
            self.refresh_token = None
            self.token_expires_at = None
    
    def refresh_access_token(self):
        """Refresh the access token"""
        if not self.refresh_token:
            raise ValueError("No refresh token available")
        
        response = self._request('POST', '/api/auth/refresh', 
                               json={'refreshToken': self.refresh_token})
        result = response.json()
        
        self.access_token = result['accessToken']
        self.token_expires_at = datetime.now() + timedelta(seconds=result.get('expiresIn', 900))
    
    # Task Management
    def create_task(self, patient_id: str, description: str, 
                   priority: str = 'routine', **kwargs) -> Dict:
        """Create a new clinical task"""
        data = {
            'patientId': patient_id,
            'description': description,
            'priority': priority,
            **kwargs
        }
        
        response = self._request('POST', '/api/clinical-workflow/tasks', json=data)
        return response.json()['task']
    
    def get_tasks(self, **filters) -> Dict:
        """Get tasks with optional filters"""
        response = self._request('GET', '/api/clinical-workflow/tasks', params=filters)
        return response.json()
    
    def update_task_status(self, task_id: str, status: str, note: Optional[str] = None) -> Dict:
        """Update task status"""
        data = {'status': status}
        if note:
            data['note'] = note
        
        response = self._request('PATCH', f'/api/clinical-workflow/tasks/{task_id}/status', 
                               json=data)
        return response.json()['task']
    
    def assign_task(self, task_id: str, practitioner_id: Optional[str] = None, 
                   note: Optional[str] = None) -> Dict:
        """Assign task to practitioner"""
        data = {}
        if practitioner_id:
            data['practitionerId'] = practitioner_id
        if note:
            data['note'] = note
        
        response = self._request('PATCH', f'/api/clinical-workflow/tasks/{task_id}/assign', 
                               json=data)
        return response.json()['task']
    
    def get_patient_tasks(self, patient_id: str, status: Optional[str] = None) -> Dict:
        """Get all tasks for a patient"""
        params = {}
        if status:
            params['status'] = status
        
        response = self._request('GET', 
                               f'/api/clinical-workflow/patients/{patient_id}/tasks', 
                               params=params)
        return response.json()
    
    def get_practitioner_tasks(self, practitioner_id: str, **filters) -> Dict:
        """Get all tasks for a practitioner"""
        response = self._request('GET', 
                               f'/api/clinical-workflow/practitioners/{practitioner_id}/tasks', 
                               params=filters)
        return response.json()
    
    # Workflow Management
    def create_workflow(self, template_id: str, patient_id: str, 
                       encounter_id: Optional[str] = None, 
                       parameters: Optional[Dict] = None) -> Dict:
        """Create workflow from template"""
        data = {
            'templateId': template_id,
            'patientId': patient_id
        }
        if encounter_id:
            data['encounterId'] = encounter_id
        if parameters:
            data['parameters'] = parameters
        
        response = self._request('POST', '/api/clinical-workflow/workflows', json=data)
        return response.json()
    
    def get_workflow_templates(self) -> List[Dict]:
        """Get available workflow templates"""
        response = self._request('GET', '/api/clinical-workflow/templates')
        return response.json()['templates']


# Example usage
if __name__ == '__main__':
    # Initialize client
    client = OmniCareClient('https://api.omnicare.com')
    
    # Login
    try:
        user = client.login('dr.smith', 'SecurePass123!', mfa_token='123456')
        print(f"Logged in as: {user['username']} ({user['role']})")
    except requests.HTTPError as e:
        print(f"Login failed: {e.response.text}")
        exit(1)
    
    # Create a task
    try:
        task = client.create_task(
            patient_id='patient-123',
            description='Perform medication reconciliation',
            priority='urgent',
            category='medication',
            dueDate=(datetime.now() + timedelta(hours=2)).isoformat()
        )
        print(f"Created task: {task['id']}")
    except requests.HTTPError as e:
        print(f"Failed to create task: {e.response.text}")
    
    # Get urgent tasks
    tasks_response = client.get_tasks(priority='urgent', status='requested')
    print(f"Found {tasks_response['total']} urgent tasks")
    
    # Update task status
    if tasks_response['tasks']:
        first_task = tasks_response['tasks'][0]
        updated_task = client.update_task_status(
            first_task['id'], 
            'in-progress',
            'Starting medication reconciliation'
        )
        print(f"Updated task status to: {updated_task['status']}")
    
    # Create admission workflow
    templates = client.get_workflow_templates()
    admission_template = next((t for t in templates if t['id'] == 'admission-workflow'), None)
    
    if admission_template:
        workflow = client.create_workflow(
            template_id='admission-workflow',
            patient_id='patient-123',
            encounter_id='encounter-456',
            parameters={'urgency': 'high'}
        )
        print(f"Created admission workflow with {len(workflow['tasks'])} tasks")
    
    # Logout
    client.logout()
```

### Async Python Client (with asyncio)

```python
# async_omnicare_client.py
import aiohttp
import asyncio
from typing import Dict, List, Optional
from datetime import datetime, timedelta

class AsyncOmniCareClient:
    """Async OmniCare Clinical Workflow API Client"""
    
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip('/')
        self.access_token = None
        self.refresh_token = None
        self.token_expires_at = None
        self._session = None
    
    async def __aenter__(self):
        self._session = aiohttp.ClientSession(
            headers={
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self._session:
            await self._session.close()
    
    async def _request(self, method: str, endpoint: str, **kwargs) -> Dict:
        """Make authenticated async request"""
        url = f"{self.base_url}{endpoint}"
        
        # Add authorization header
        headers = kwargs.get('headers', {})
        if self.access_token:
            headers['Authorization'] = f'Bearer {self.access_token}'
        kwargs['headers'] = headers
        
        async with self._session.request(method, url, **kwargs) as response:
            response.raise_for_status()
            return await response.json()
    
    async def login(self, username: str, password: str, mfa_token: Optional[str] = None) -> Dict:
        """Authenticate user asynchronously"""
        data = {'username': username, 'password': password}
        if mfa_token:
            data['mfaToken'] = mfa_token
        
        result = await self._request('POST', '/api/auth/login', json=data)
        
        self.access_token = result['accessToken']
        self.refresh_token = result['refreshToken']
        self.token_expires_at = datetime.now() + timedelta(seconds=result.get('expiresIn', 900))
        
        return result['user']
    
    async def create_task(self, patient_id: str, description: str, **kwargs) -> Dict:
        """Create task asynchronously"""
        data = {
            'patientId': patient_id,
            'description': description,
            **kwargs
        }
        
        result = await self._request('POST', '/api/clinical-workflow/tasks', json=data)
        return result['task']
    
    async def get_tasks(self, **filters) -> Dict:
        """Get tasks asynchronously"""
        return await self._request('GET', '/api/clinical-workflow/tasks', params=filters)
    
    async def update_task_status(self, task_id: str, status: str, note: Optional[str] = None) -> Dict:
        """Update task status asynchronously"""
        data = {'status': status}
        if note:
            data['note'] = note
        
        result = await self._request('PATCH', 
                                   f'/api/clinical-workflow/tasks/{task_id}/status', 
                                   json=data)
        return result['task']
    
    async def batch_create_tasks(self, tasks: List[Dict]) -> List[Dict]:
        """Create multiple tasks concurrently"""
        create_tasks = [
            self.create_task(**task) for task in tasks
        ]
        return await asyncio.gather(*create_tasks)
    
    async def batch_update_status(self, updates: List[Dict]) -> List[Dict]:
        """Update multiple task statuses concurrently"""
        update_tasks = [
            self.update_task_status(update['taskId'], update['status'], update.get('note'))
            for update in updates
        ]
        return await asyncio.gather(*update_tasks)


# Example async usage
async def main():
    async with AsyncOmniCareClient('https://api.omnicare.com') as client:
        # Login
        user = await client.login('dr.smith', 'SecurePass123!')
        print(f"Logged in as: {user['username']}")
        
        # Create multiple tasks concurrently
        tasks_to_create = [
            {
                'patient_id': 'patient-123',
                'description': 'Initial assessment',
                'priority': 'urgent'
            },
            {
                'patient_id': 'patient-123',
                'description': 'Order lab tests',
                'priority': 'routine'
            },
            {
                'patient_id': 'patient-123',
                'description': 'Schedule follow-up',
                'priority': 'routine'
            }
        ]
        
        created_tasks = await client.batch_create_tasks(tasks_to_create)
        print(f"Created {len(created_tasks)} tasks")
        
        # Update multiple task statuses
        updates = [
            {'taskId': task['id'], 'status': 'accepted'}
            for task in created_tasks
        ]
        
        updated_tasks = await client.batch_update_status(updates)
        print(f"Updated {len(updated_tasks)} tasks")

if __name__ == '__main__':
    asyncio.run(main())
```

## React Integration

### React Hooks and Components

```typescript
// hooks/useClinicalWorkflow.ts
import { useState, useEffect, useCallback } from 'react';
import { omnicare } from '../lib/omnicare-sdk';
import { Task, CreateTaskRequest } from '../types/clinical-workflow';

export function useClinicalWorkflow() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async (filters?: any) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await omnicare.getTasks(filters);
      setTasks(response.tasks);
      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const createTask = useCallback(async (task: CreateTaskRequest) => {
    setLoading(true);
    setError(null);
    
    try {
      const newTask = await omnicare.createTask(task);
      setTasks(prev => [newTask, ...prev]);
      return newTask;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateTaskStatus = useCallback(async (taskId: string, status: Task['status'], note?: string) => {
    try {
      const updatedTask = await omnicare.updateTaskStatus(taskId, status, note);
      setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));
      return updatedTask;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const assignTask = useCallback(async (taskId: string, practitionerId?: string, note?: string) => {
    try {
      const updatedTask = await omnicare.assignTask(taskId, practitionerId, note);
      setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));
      return updatedTask;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  return {
    tasks,
    loading,
    error,
    fetchTasks,
    createTask,
    updateTaskStatus,
    assignTask
  };
}

// components/TaskList.tsx
import React, { useEffect, useState } from 'react';
import { useClinicalWorkflow } from '../hooks/useClinicalWorkflow';
import { Task } from '../types/clinical-workflow';

interface TaskListProps {
  patientId?: string;
  practitionerId?: string;
  filters?: {
    status?: string;
    priority?: string;
    category?: string;
  };
}

export const TaskList: React.FC<TaskListProps> = ({ 
  patientId, 
  practitionerId, 
  filters 
}) => {
  const { tasks, loading, error, fetchTasks, updateTaskStatus } = useClinicalWorkflow();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  useEffect(() => {
    const params = {
      ...filters,
      patient: patientId,
      practitioner: practitionerId,
      _count: 50,
      _sort: '-_lastUpdated'
    };
    
    fetchTasks(params);
  }, [patientId, practitionerId, filters, fetchTasks]);

  const handleStatusChange = async (task: Task, newStatus: Task['status']) => {
    try {
      await updateTaskStatus(task.id!, newStatus);
      // Show success notification
    } catch (error) {
      // Show error notification
    }
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      stat: 'red',
      asap: 'orange',
      urgent: 'yellow',
      routine: 'green'
    };
    return colors[priority] || 'gray';
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      requested: { color: 'blue', text: 'New' },
      accepted: { color: 'indigo', text: 'Accepted' },
      'in-progress': { color: 'yellow', text: 'In Progress' },
      completed: { color: 'green', text: 'Completed' },
      cancelled: { color: 'gray', text: 'Cancelled' },
      failed: { color: 'red', text: 'Failed' }
    };
    return badges[status] || { color: 'gray', text: status };
  };

  if (loading) return <div>Loading tasks...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="task-list">
      {tasks.map((task) => {
        const statusBadge = getStatusBadge(task.status);
        
        return (
          <div key={task.id} className="task-card">
            <div className="task-header">
              <h3>{task.description}</h3>
              <span className={`priority-${getPriorityColor(task.priority)}`}>
                {task.priority.toUpperCase()}
              </span>
            </div>
            
            <div className="task-body">
              <div className="task-meta">
                <span className={`status-badge ${statusBadge.color}`}>
                  {statusBadge.text}
                </span>
                {task.code?.coding?.[0]?.display && (
                  <span className="task-category">
                    {task.code.coding[0].display}
                  </span>
                )}
              </div>
              
              <div className="task-actions">
                {task.status === 'requested' && (
                  <button onClick={() => handleStatusChange(task, 'accepted')}>
                    Accept
                  </button>
                )}
                {task.status === 'accepted' && (
                  <button onClick={() => handleStatusChange(task, 'in-progress')}>
                    Start
                  </button>
                )}
                {task.status === 'in-progress' && (
                  <button onClick={() => handleStatusChange(task, 'completed')}>
                    Complete
                  </button>
                )}
              </div>
            </div>
            
            <div className="task-footer">
              <span className="task-date">
                Created: {new Date(task.authoredOn!).toLocaleString()}
              </span>
              {task.owner?.reference && (
                <span className="task-owner">
                  Assigned to: {task.owner.reference}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// components/CreateTaskForm.tsx
import React, { useState } from 'react';
import { useClinicalWorkflow } from '../hooks/useClinicalWorkflow';
import { CreateTaskRequest } from '../types/clinical-workflow';

interface CreateTaskFormProps {
  patientId: string;
  onSuccess?: (task: any) => void;
  onCancel?: () => void;
}

export const CreateTaskForm: React.FC<CreateTaskFormProps> = ({ 
  patientId, 
  onSuccess, 
  onCancel 
}) => {
  const { createTask, loading } = useClinicalWorkflow();
  const [formData, setFormData] = useState<Partial<CreateTaskRequest>>({
    patientId,
    priority: 'routine'
  });

  const taskCategories = [
    { value: 'assessment', label: 'Assessment' },
    { value: 'medication', label: 'Medication Administration' },
    { value: 'procedure', label: 'Procedure' },
    { value: 'observation', label: 'Observation' },
    { value: 'education', label: 'Patient Education' },
    { value: 'consultation', label: 'Consultation' },
    { value: 'follow-up', label: 'Follow-up' },
    { value: 'lab-order', label: 'Laboratory Order' },
    { value: 'imaging-order', label: 'Imaging Order' }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const task = await createTask(formData as CreateTaskRequest);
      onSuccess?.(task);
      // Reset form
      setFormData({ patientId, priority: 'routine' });
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="create-task-form">
      <div className="form-group">
        <label htmlFor="description">Task Description*</label>
        <textarea
          id="description"
          required
          value={formData.description || ''}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Describe the task to be completed..."
          rows={3}
        />
      </div>

      <div className="form-group">
        <label htmlFor="priority">Priority</label>
        <select
          id="priority"
          value={formData.priority}
          onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
        >
          <option value="routine">Routine</option>
          <option value="urgent">Urgent</option>
          <option value="asap">ASAP</option>
          <option value="stat">STAT</option>
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="category">Category</label>
        <select
          id="category"
          value={formData.category || ''}
          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
        >
          <option value="">Select category...</option>
          {taskCategories.map(cat => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="dueDate">Due Date</label>
        <input
          type="datetime-local"
          id="dueDate"
          value={formData.dueDate || ''}
          onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
        />
      </div>

      <div className="form-group">
        <label htmlFor="practitionerId">Assign To</label>
        <select
          id="practitionerId"
          value={formData.practitionerId || ''}
          onChange={(e) => setFormData({ ...formData, practitionerId: e.target.value })}
        >
          <option value="">Unassigned</option>
          {/* Populate with practitioners */}
        </select>
      </div>

      <div className="form-actions">
        <button type="submit" disabled={loading}>
          {loading ? 'Creating...' : 'Create Task'}
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
};

// components/WorkflowBuilder.tsx
import React, { useState, useEffect } from 'react';
import { omnicare } from '../lib/omnicare-sdk';
import { WorkflowTemplate } from '../types/clinical-workflow';

interface WorkflowBuilderProps {
  patientId: string;
  encounterId?: string;
}

export const WorkflowBuilder: React.FC<WorkflowBuilderProps> = ({ 
  patientId, 
  encounterId 
}) => {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [parameters, setParameters] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const templateList = await omnicare.getWorkflowTemplates();
      setTemplates(templateList);
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  const handleCreateWorkflow = async () => {
    if (!selectedTemplate) return;

    setLoading(true);
    try {
      const result = await omnicare.createWorkflow({
        templateId: selectedTemplate,
        patientId,
        encounterId,
        parameters
      });

      // Show success message
      console.log('Workflow created:', result);
    } catch (error) {
      console.error('Failed to create workflow:', error);
    } finally {
      setLoading(false);
    }
  };

  const template = templates.find(t => t.id === selectedTemplate);

  return (
    <div className="workflow-builder">
      <h3>Create Clinical Workflow</h3>

      <div className="form-group">
        <label>Select Workflow Template</label>
        <select
          value={selectedTemplate}
          onChange={(e) => setSelectedTemplate(e.target.value)}
        >
          <option value="">Choose template...</option>
          {templates.map(template => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
      </div>

      {template && (
        <div className="template-preview">
          <h4>{template.name}</h4>
          <p>{template.description}</p>
          
          <h5>Tasks to be created:</h5>
          <ul>
            {template.tasks.map((task, index) => (
              <li key={index}>
                <strong>{task.description}</strong>
                <span className={`priority-${task.priority}`}>
                  {task.priority}
                </span>
                {task.dueDateOffset > 0 && (
                  <span>Due in {task.dueDateOffset} day(s)</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        onClick={handleCreateWorkflow}
        disabled={!selectedTemplate || loading}
      >
        {loading ? 'Creating Workflow...' : 'Create Workflow'}
      </button>
    </div>
  );
};
```

## Mobile Integration

### React Native Integration

```typescript
// OmniCareAPI.ts - React Native
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

class OmniCareAPI {
  private baseURL: string;
  private accessToken: string | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  async init() {
    // Restore token from secure storage
    this.accessToken = await AsyncStorage.getItem('omnicare_access_token');
  }

  private async request(method: string, endpoint: string, data?: any) {
    const url = `${this.baseURL}${endpoint}`;
    
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': `OmniCare-Mobile/${Platform.OS}`,
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const options: RequestInit = {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
    };

    const response = await fetch(url, options);
    
    if (!response.ok) {
      if (response.status === 401) {
        // Handle token refresh
        await this.refreshToken();
        // Retry request
        return this.request(method, endpoint, data);
      }
      throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
  }

  async login(username: string, password: string, mfaToken?: string) {
    const result = await this.request('POST', '/api/auth/login', {
      username,
      password,
      mfaToken,
    });

    this.accessToken = result.accessToken;
    await AsyncStorage.setItem('omnicare_access_token', result.accessToken);
    await AsyncStorage.setItem('omnicare_refresh_token', result.refreshToken);

    return result.user;
  }

  async refreshToken() {
    const refreshToken = await AsyncStorage.getItem('omnicare_refresh_token');
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const result = await this.request('POST', '/api/auth/refresh', {
      refreshToken,
    });

    this.accessToken = result.accessToken;
    await AsyncStorage.setItem('omnicare_access_token', result.accessToken);
  }

  async getTasks(filters?: any) {
    const queryString = new URLSearchParams(filters).toString();
    return this.request('GET', `/api/clinical-workflow/tasks?${queryString}`);
  }

  async createTask(task: any) {
    const result = await this.request('POST', '/api/clinical-workflow/tasks', task);
    return result.task;
  }
}

// Usage in React Native component
import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native';

const api = new OmniCareAPI('https://api.omnicare.com');

export const TaskListScreen = () => {
  const [tasks, setTasks] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    api.init().then(() => loadTasks());
  }, []);

  const loadTasks = async () => {
    try {
      const response = await api.getTasks({ 
        status: 'requested',
        _count: 20 
      });
      setTasks(response.tasks);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTasks();
    setRefreshing(false);
  };

  const renderTask = ({ item }) => (
    <TouchableOpacity style={styles.taskCard}>
      <Text style={styles.taskDescription}>{item.description}</Text>
      <View style={styles.taskMeta}>
        <Text style={[styles.priority, styles[`priority_${item.priority}`]]}>
          {item.priority.toUpperCase()}
        </Text>
        <Text style={styles.status}>{item.status}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <FlatList
      data={tasks}
      renderItem={renderTask}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    />
  );
};
```

## Webhook Integration

### Webhook Handler Example

```typescript
// webhook-handler.ts
import express from 'express';
import crypto from 'crypto';

const router = express.Router();

// Webhook secret for signature verification
const WEBHOOK_SECRET = process.env.OMNICARE_WEBHOOK_SECRET;

// Verify webhook signature
function verifyWebhookSignature(payload: string, signature: string): boolean {
  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  const digest = hmac.update(payload).digest('hex');
  return digest === signature;
}

// Webhook endpoint
router.post('/webhooks/omnicare', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-omnicare-signature'] as string;
  const payload = req.body.toString();

  // Verify signature
  if (!verifyWebhookSignature(payload, signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = JSON.parse(payload);

  // Handle different event types
  switch (event.type) {
    case 'task.created':
      handleTaskCreated(event.data);
      break;
    
    case 'task.status_changed':
      handleTaskStatusChanged(event.data);
      break;
    
    case 'task.assigned':
      handleTaskAssigned(event.data);
      break;
    
    case 'workflow.completed':
      handleWorkflowCompleted(event.data);
      break;
    
    default:
      console.log('Unhandled webhook event:', event.type);
  }

  // Acknowledge receipt
  res.json({ received: true });
});

// Event handlers
async function handleTaskCreated(data: any) {
  console.log('New task created:', data.task.id);
  
  // Send notification to assigned practitioner
  if (data.task.owner?.reference) {
    await sendNotification({
      to: data.task.owner.reference,
      title: 'New Task Assigned',
      body: data.task.description,
      data: {
        taskId: data.task.id,
        priority: data.task.priority
      }
    });
  }
}

async function handleTaskStatusChanged(data: any) {
  console.log('Task status changed:', data.task.id, data.previousStatus, '->', data.task.status);
  
  // Update internal tracking
  await updateTaskTracking(data.task.id, data.task.status);
  
  // Notify relevant parties
  if (data.task.status === 'completed') {
    await notifyTaskCompletion(data.task);
  }
}

async function handleTaskAssigned(data: any) {
  console.log('Task assigned:', data.task.id, 'to', data.task.owner?.reference);
  
  // Update practitioner workload
  await updatePractitionerWorkload(data.task.owner?.reference);
}

async function handleWorkflowCompleted(data: any) {
  console.log('Workflow completed:', data.workflow.id);
  
  // Generate completion report
  await generateWorkflowReport(data.workflow);
}

// Helper functions
async function sendNotification(notification: any) {
  // Implement push notification logic
  console.log('Sending notification:', notification);
}

async function updateTaskTracking(taskId: string, status: string) {
  // Update internal database
  console.log('Updating task tracking:', taskId, status);
}

async function notifyTaskCompletion(task: any) {
  // Send completion notifications
  console.log('Notifying task completion:', task.id);
}

async function updatePractitionerWorkload(practitionerId: string) {
  // Update workload metrics
  console.log('Updating practitioner workload:', practitionerId);
}

async function generateWorkflowReport(workflow: any) {
  // Generate and store report
  console.log('Generating workflow report:', workflow.id);
}

export default router;
```

## Real-World Scenarios

### 1. Emergency Department Admission Workflow

```typescript
// emergency-admission.ts
async function handleEmergencyAdmission(patientData: any) {
  const client = new OmniCareSDK({ baseURL: API_URL });
  
  try {
    // Step 1: Authenticate
    await client.login(process.env.SERVICE_USERNAME, process.env.SERVICE_PASSWORD);
    
    // Step 2: Create patient encounter
    const encounterId = await createEncounter(patientData);
    
    // Step 3: Create emergency admission workflow
    const workflow = await client.createWorkflow({
      templateId: 'emergency-admission',
      patientId: patientData.id,
      encounterId: encounterId,
      parameters: {
        triageLevel: patientData.triageLevel,
        chiefComplaint: patientData.chiefComplaint,
        arrivalTime: new Date().toISOString()
      }
    });
    
    // Step 4: Auto-assign triage nurse task
    const triageTask = workflow.tasks.find(t => t.description.includes('triage'));
    if (triageTask) {
      const availableNurse = await findAvailableNurse('emergency');
      await client.assignTask(triageTask.id, availableNurse.id);
    }
    
    // Step 5: Mark initial assessment as urgent if high triage level
    if (patientData.triageLevel <= 2) {
      const assessmentTask = workflow.tasks.find(t => t.category === 'assessment');
      if (assessmentTask) {
        await client.updateTaskStatus(assessmentTask.id, 'accepted', 'High priority patient');
      }
    }
    
    // Step 6: Create stat lab orders if indicated
    if (patientData.requiresStatLabs) {
      await client.createTask({
        patientId: patientData.id,
        description: 'STAT Lab Orders: CBC, BMP, PT/INR',
        priority: 'stat',
        category: 'lab-order',
        encounterId: encounterId
      });
    }
    
    return {
      success: true,
      workflowId: workflow.id,
      tasksCreated: workflow.tasks.length
    };
    
  } catch (error) {
    console.error('Emergency admission workflow failed:', error);
    
    // Fallback: Create manual high-priority task
    await client.createTask({
      patientId: patientData.id,
      description: `URGENT: Manual admission required for ${patientData.name}`,
      priority: 'stat',
      category: 'assessment'
    });
    
    throw error;
  }
}
```

### 2. Medication Reconciliation Process

```typescript
// medication-reconciliation.ts
class MedicationReconciliation {
  private client: OmniCareSDK;
  
  constructor(apiClient: OmniCareSDK) {
    this.client = apiClient;
  }
  
  async performReconciliation(patientId: string, admissionType: 'admission' | 'discharge') {
    // Step 1: Create medication reconciliation task
    const task = await this.client.createTask({
      patientId,
      description: `${admissionType === 'admission' ? 'Admission' : 'Discharge'} medication reconciliation`,
      priority: 'urgent',
      category: 'medication',
      code: {
        code: 'med-rec',
        display: 'Medication Reconciliation'
      }
    });
    
    // Step 2: Get current medications
    const currentMeds = await this.getCurrentMedications(patientId);
    
    // Step 3: Get home medications (for admission) or discharge medications
    const compareMeds = admissionType === 'admission' 
      ? await this.getHomeMedications(patientId)
      : await this.getDischargeMedications(patientId);
    
    // Step 4: Identify discrepancies
    const discrepancies = this.findDiscrepancies(currentMeds, compareMeds);
    
    // Step 5: Create sub-tasks for each discrepancy
    for (const discrepancy of discrepancies) {
      await this.client.createTask({
        patientId,
        description: `Review medication discrepancy: ${discrepancy.medication}`,
        priority: 'urgent',
        category: 'medication',
        code: {
          code: 'med-discrepancy',
          display: 'Medication Discrepancy'
        }
      });
    }
    
    // Step 6: Assign to pharmacist for review
    const pharmacist = await this.findAvailablePharmacist();
    await this.client.assignTask(task.id, pharmacist.id, 
      `${discrepancies.length} discrepancies found`);
    
    return {
      taskId: task.id,
      discrepanciesFound: discrepancies.length,
      assignedTo: pharmacist.id
    };
  }
  
  private async getCurrentMedications(patientId: string) {
    // Implementation to fetch current medications
    return [];
  }
  
  private async getHomeMedications(patientId: string) {
    // Implementation to fetch home medications
    return [];
  }
  
  private async getDischargeMedications(patientId: string) {
    // Implementation to fetch discharge medications
    return [];
  }
  
  private findDiscrepancies(meds1: any[], meds2: any[]) {
    // Implementation to compare medication lists
    return [];
  }
  
  private async findAvailablePharmacist() {
    // Implementation to find available pharmacist
    return { id: 'pharmacist-123' };
  }
}
```

### 3. Shift Handoff Automation

```typescript
// shift-handoff.ts
class ShiftHandoffManager {
  private client: OmniCareSDK;
  
  async performHandoff(
    outgoingPractitionerId: string,
    incomingPractitionerId: string,
    shiftType: 'day-to-night' | 'night-to-day'
  ) {
    // Step 1: Get all active tasks for outgoing practitioner
    const { tasks } = await this.client.getPractitionerTasks(outgoingPractitionerId, {
      status: 'in-progress'
    });
    
    console.log(`Handing off ${tasks.length} active tasks`);
    
    // Step 2: Categorize tasks by priority and patient
    const tasksByPatient = this.groupTasksByPatient(tasks);
    
    // Step 3: Create handoff summary for each patient
    for (const [patientId, patientTasks] of Object.entries(tasksByPatient)) {
      const summary = this.createHandoffSummary(patientTasks);
      
      // Create handoff task
      await this.client.createTask({
        patientId,
        description: `Shift handoff: ${summary}`,
        priority: 'urgent',
        category: 'handoff',
        practitionerId: incomingPractitionerId
      });
    }
    
    // Step 4: Reassign critical tasks
    const criticalTasks = tasks.filter(t => 
      t.priority === 'stat' || t.priority === 'asap'
    );
    
    for (const task of criticalTasks) {
      await this.client.assignTask(
        task.id!,
        incomingPractitionerId,
        `Shift handoff from ${outgoingPractitionerId}`
      );
    }
    
    // Step 5: Update non-critical task notes
    const nonCriticalTasks = tasks.filter(t => 
      t.priority === 'routine' || t.priority === 'urgent'
    );
    
    for (const task of nonCriticalTasks) {
      await this.client.updateTaskStatus(
        task.id!,
        task.status,
        `Handoff note: Continue monitoring, reassign if becomes urgent`
      );
    }
    
    return {
      totalTasks: tasks.length,
      criticalReassigned: criticalTasks.length,
      patientsAffected: Object.keys(tasksByPatient).length
    };
  }
  
  private groupTasksByPatient(tasks: any[]) {
    return tasks.reduce((acc, task) => {
      const patientId = task.for?.reference?.split('/')[1];
      if (patientId) {
        acc[patientId] = acc[patientId] || [];
        acc[patientId].push(task);
      }
      return acc;
    }, {});
  }
  
  private createHandoffSummary(tasks: any[]) {
    const priorities = tasks.map(t => t.priority);
    const hasUrgent = priorities.includes('urgent') || priorities.includes('stat');
    return `${tasks.length} tasks${hasUrgent ? ' (URGENT)' : ''}: ${
      tasks.map(t => t.description).join(', ')
    }`;
  }
}
```

## Error Handling and Retry Logic

```typescript
// error-handler.ts
class APIErrorHandler {
  private maxRetries = 3;
  private retryDelay = 1000; // Start with 1 second
  
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on client errors (4xx)
        if (this.isClientError(error)) {
          throw error;
        }
        
        // Log the error
        console.error(`${context} failed (attempt ${attempt}/${this.maxRetries}):`, error);
        
        // Wait before retrying (exponential backoff)
        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }
      }
    }
    
    // All retries failed
    throw new Error(`${context} failed after ${this.maxRetries} attempts: ${lastError?.message}`);
  }
  
  private isClientError(error: any): boolean {
    return error.response && error.response.status >= 400 && error.response.status < 500;
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Usage with error handling
const errorHandler = new APIErrorHandler();

async function createTaskWithRetry(taskData: CreateTaskRequest) {
  try {
    const task = await errorHandler.executeWithRetry(
      () => omnicare.createTask(taskData),
      'Create clinical task'
    );
    
    console.log('Task created successfully:', task.id);
    return task;
    
  } catch (error) {
    // Handle specific error types
    if (error.response?.status === 400) {
      console.error('Invalid task data:', error.response.data);
      // Show validation errors to user
    } else if (error.response?.status === 401) {
      console.error('Authentication failed');
      // Redirect to login
    } else if (error.response?.status === 403) {
      console.error('Insufficient permissions');
      // Show permission error
    } else {
      console.error('Unexpected error:', error);
      // Show generic error message
    }
    
    throw error;
  }
}
```

## Testing and Monitoring

```typescript
// api-monitor.ts
class APIMonitor {
  private metrics: Map<string, any> = new Map();
  
  async trackAPICall(endpoint: string, method: string, duration: number, success: boolean) {
    const key = `${method} ${endpoint}`;
    
    if (!this.metrics.has(key)) {
      this.metrics.set(key, {
        totalCalls: 0,
        successCalls: 0,
        totalDuration: 0,
        errors: []
      });
    }
    
    const metric = this.metrics.get(key);
    metric.totalCalls++;
    metric.totalDuration += duration;
    
    if (success) {
      metric.successCalls++;
    }
  }
  
  getMetrics() {
    const report: any[] = [];
    
    for (const [endpoint, metric] of this.metrics) {
      report.push({
        endpoint,
        totalCalls: metric.totalCalls,
        successRate: (metric.successCalls / metric.totalCalls * 100).toFixed(2) + '%',
        avgDuration: (metric.totalDuration / metric.totalCalls).toFixed(2) + 'ms',
        errorCount: metric.totalCalls - metric.successCalls
      });
    }
    
    return report;
  }
}

// Integration test example
describe('Clinical Workflow API Integration', () => {
  let client: OmniCareSDK;
  let testPatientId: string;
  
  beforeAll(async () => {
    client = new OmniCareSDK({ baseURL: process.env.TEST_API_URL });
    await client.login(process.env.TEST_USERNAME, process.env.TEST_PASSWORD);
    
    // Create test patient
    testPatientId = 'test-patient-123';
  });
  
  test('Complete task lifecycle', async () => {
    // Create task
    const task = await client.createTask({
      patientId: testPatientId,
      description: 'Test task',
      priority: 'routine'
    });
    
    expect(task.id).toBeDefined();
    expect(task.status).toBe('requested');
    
    // Accept task
    const acceptedTask = await client.updateTaskStatus(task.id!, 'accepted');
    expect(acceptedTask.status).toBe('accepted');
    
    // Start task
    const inProgressTask = await client.updateTaskStatus(task.id!, 'in-progress');
    expect(inProgressTask.status).toBe('in-progress');
    
    // Complete task
    const completedTask = await client.updateTaskStatus(task.id!, 'completed', 'Test completed');
    expect(completedTask.status).toBe('completed');
  });
  
  test('Workflow creation', async () => {
    const templates = await client.getWorkflowTemplates();
    expect(templates.length).toBeGreaterThan(0);
    
    const workflow = await client.createWorkflow({
      templateId: templates[0].id,
      patientId: testPatientId
    });
    
    expect(workflow.tasks).toBeDefined();
    expect(workflow.tasks.length).toBeGreaterThan(0);
  });
});
```

## Summary

This integration guide provides comprehensive examples for integrating with the OmniCare Clinical Workflow API across multiple platforms and languages. The examples cover:

1. **SDK Development** - Full-featured TypeScript and Python clients
2. **React Integration** - Hooks, components, and state management
3. **Mobile Support** - React Native implementation
4. **Webhook Handling** - Event-driven integrations
5. **Real-World Scenarios** - Emergency workflows, medication reconciliation, shift handoffs
6. **Error Handling** - Retry logic and graceful degradation
7. **Testing & Monitoring** - Integration tests and API metrics

For additional support or custom integration needs, contact the API team at api-support@omnicare.com.