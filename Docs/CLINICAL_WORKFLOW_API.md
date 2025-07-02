# Clinical Workflow API Documentation

## Overview

The Clinical Workflow API provides a comprehensive set of endpoints for managing clinical tasks and workflows within the OmniCare EMR system. This API follows FHIR standards and integrates with the Medplum platform for healthcare data management.

## Base URL

```
Production: https://api.omnicare.com/api/clinical-workflow
Staging: https://staging-api.omnicare.com/api/clinical-workflow
Development: http://localhost:8080/api/clinical-workflow
```

## Authentication

All API endpoints require authentication using JWT Bearer tokens. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

### Required Scopes

The API uses OAuth 2.0 scopes for fine-grained access control:

- `Task:read` - Read access to tasks
- `Task:write` - Write access to tasks
- `user/*.read` - General read access
- `user/*.write` - General write access

## Rate Limiting

All endpoints are rate-limited to 100 requests per 15-minute window per user. Rate limit headers are included in responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1703187600
```

## API Endpoints

### 1. Create Clinical Task

Create a new clinical task for patient care coordination.

**Endpoint:** `POST /tasks`

**Request Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "patientId": "patient-123",
  "practitionerId": "practitioner-456",
  "description": "Complete initial patient assessment",
  "priority": "urgent",
  "category": "assessment",
  "code": {
    "code": "initial-assessment",
    "display": "Initial Patient Assessment"
  },
  "dueDate": "2024-01-15T14:00:00Z",
  "encounterId": "encounter-789",
  "serviceRequestId": "service-request-012"
}
```

**Request Parameters:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| patientId | string | Yes | The ID of the patient this task is for |
| practitionerId | string | No | The ID of the practitioner assigned to the task |
| description | string | Yes | A detailed description of the task (5-500 chars) |
| priority | string | No | Task priority: routine, urgent, asap, stat (default: routine) |
| category | string | No | Task category (see Task Categories section) |
| code | object | No | Custom task code with code and display properties |
| dueDate | string | No | ISO 8601 datetime when the task is due |
| encounterId | string | No | Related encounter ID |
| serviceRequestId | string | No | Related service request ID |

**Response:** `201 Created`
```json
{
  "message": "Task created successfully",
  "task": {
    "resourceType": "Task",
    "id": "task-abc-123",
    "status": "requested",
    "priority": "urgent",
    "intent": "order",
    "description": "Complete initial patient assessment",
    "for": {
      "reference": "Patient/patient-123"
    },
    "owner": {
      "reference": "Practitioner/practitioner-456"
    },
    "authoredOn": "2024-01-10T10:30:00Z",
    "lastModified": "2024-01-10T10:30:00Z",
    "code": {
      "coding": [
        {
          "system": "http://hl7.org/fhir/CodeSystem/task-type",
          "code": "assessment",
          "display": "Assessment"
        },
        {
          "system": "http://omnicare.com/task-codes",
          "code": "initial-assessment",
          "display": "Initial Patient Assessment"
        }
      ]
    },
    "restriction": {
      "period": {
        "end": "2024-01-15T14:00:00Z"
      }
    },
    "encounter": {
      "reference": "Encounter/encounter-789"
    },
    "basedOn": [{
      "reference": "ServiceRequest/service-request-012"
    }]
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid request data or missing required fields
- `404 Not Found` - Patient or practitioner not found
- `500 Internal Server Error` - Server error

### 2. Get Clinical Tasks

Retrieve clinical tasks with various filtering options.

**Endpoint:** `GET /tasks`

**Request Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | Filter by task status (requested, accepted, in-progress, completed, cancelled, failed) |
| priority | string | Filter by priority (routine, urgent, asap, stat) |
| category | string | Filter by task category |
| patient | string | Filter by patient ID |
| practitioner | string | Filter by assigned practitioner ID |
| _count | integer | Number of results to return (default: 20) |
| _sort | string | Sort order (default: -_lastUpdated) |

**Example Request:**
```
GET /tasks?status=requested&priority=urgent&_count=50
```

**Response:** `200 OK`
```json
{
  "tasks": [
    {
      "resourceType": "Task",
      "id": "task-abc-123",
      "status": "requested",
      "priority": "urgent",
      "description": "Complete initial patient assessment",
      "for": {
        "reference": "Patient/patient-123"
      },
      "_patient": {
        "resourceType": "Patient",
        "id": "patient-123",
        "name": [{
          "given": ["John"],
          "family": "Doe"
        }]
      },
      "_owner": {
        "resourceType": "Practitioner",
        "id": "practitioner-456",
        "name": [{
          "given": ["Jane"],
          "family": "Smith"
        }]
      }
    }
  ],
  "total": 25
}
```

### 3. Update Task Status

Update the status of an existing task.

**Endpoint:** `PATCH /tasks/{id}/status`

**Request Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Path Parameters:**
- `id` - The task ID

**Request Body:**
```json
{
  "status": "in-progress",
  "note": "Started patient assessment"
}
```

**Valid Status Values:**
- `requested` - Task has been requested but not accepted
- `accepted` - Task has been accepted and is ready to start
- `in-progress` - Task is currently being performed
- `completed` - Task has been completed
- `cancelled` - Task has been cancelled
- `failed` - Task failed to complete

**Response:** `200 OK`
```json
{
  "message": "Task status updated successfully",
  "task": {
    "resourceType": "Task",
    "id": "task-abc-123",
    "status": "in-progress",
    "statusReason": {
      "text": "Started patient assessment"
    },
    "lastModified": "2024-01-10T11:00:00Z"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid status value
- `404 Not Found` - Task not found

### 4. Assign Task to Practitioner

Assign or reassign a task to a specific practitioner.

**Endpoint:** `PATCH /tasks/{id}/assign`

**Request Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Path Parameters:**
- `id` - The task ID

**Request Body:**
```json
{
  "practitionerId": "practitioner-789",
  "note": "Reassigned to Dr. Johnson due to availability"
}
```

**Response:** `200 OK`
```json
{
  "message": "Task assigned successfully",
  "task": {
    "resourceType": "Task",
    "id": "task-abc-123",
    "owner": {
      "reference": "Practitioner/practitioner-789"
    },
    "note": [{
      "text": "Reassigned to Dr. Johnson due to availability",
      "time": "2024-01-10T11:30:00Z"
    }],
    "lastModified": "2024-01-10T11:30:00Z"
  }
}
```

### 5. Get Tasks by Patient

Retrieve all tasks for a specific patient.

**Endpoint:** `GET /patients/{patientId}/tasks`

**Request Headers:**
```
Authorization: Bearer <token>
```

**Path Parameters:**
- `patientId` - The patient ID

**Query Parameters:**
- `status` - Filter by task status
- `_count` - Number of results (default: 50)

**Response:** `200 OK`
```json
{
  "tasks": [
    {
      "resourceType": "Task",
      "id": "task-abc-123",
      "status": "requested",
      "description": "Complete initial patient assessment",
      "for": {
        "reference": "Patient/patient-123"
      }
    }
  ],
  "total": 10
}
```

### 6. Get Tasks by Practitioner

Retrieve all tasks assigned to a specific practitioner.

**Endpoint:** `GET /practitioners/{practitionerId}/tasks`

**Request Headers:**
```
Authorization: Bearer <token>
```

**Path Parameters:**
- `practitionerId` - The practitioner ID

**Query Parameters:**
- `status` - Filter by task status
- `priority` - Filter by task priority
- `_count` - Number of results (default: 50)

**Response:** `200 OK`
```json
{
  "tasks": [
    {
      "resourceType": "Task",
      "id": "task-abc-123",
      "status": "in-progress",
      "priority": "urgent",
      "description": "Complete initial patient assessment",
      "owner": {
        "reference": "Practitioner/practitioner-456"
      }
    }
  ],
  "total": 15
}
```

### 7. Create Clinical Workflow

Create a complete clinical workflow from a predefined template.

**Endpoint:** `POST /workflows`

**Request Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "templateId": "admission-workflow",
  "patientId": "patient-123",
  "encounterId": "encounter-789",
  "parameters": {
    "urgency": "high",
    "department": "cardiology"
  }
}
```

**Response:** `201 Created`
```json
{
  "message": "Clinical workflow created successfully",
  "workflow": {
    "templateId": "admission-workflow",
    "patientId": "patient-123",
    "encounterId": "encounter-789",
    "createdAt": "2024-01-10T12:00:00Z"
  },
  "tasks": [
    {
      "resourceType": "Task",
      "id": "task-001",
      "description": "Complete initial patient assessment",
      "priority": "urgent"
    },
    {
      "resourceType": "Task", 
      "id": "task-002",
      "description": "Medication reconciliation",
      "priority": "routine"
    }
  ]
}
```

### 8. Get Workflow Templates

Retrieve all available workflow templates.

**Endpoint:** `GET /templates`

**Request Headers:**
```
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "templates": [
    {
      "id": "admission-workflow",
      "name": "Patient Admission Workflow",
      "description": "Standard workflow for patient admission",
      "tasks": [
        {
          "category": "assessment",
          "description": "Complete initial patient assessment",
          "priority": "urgent",
          "dueDateOffset": 0
        },
        {
          "category": "medication",
          "description": "Medication reconciliation",
          "priority": "routine",
          "dueDateOffset": 1
        }
      ]
    },
    {
      "id": "discharge-workflow",
      "name": "Patient Discharge Workflow",
      "description": "Standard workflow for patient discharge",
      "tasks": [...]
    }
  ]
}
```

## Task Categories

The API supports the following task categories:

| Category | Display Name | Description |
|----------|--------------|-------------|
| assessment | Assessment | Clinical assessments and evaluations |
| medication | Medication Administration | Tasks related to medication management |
| procedure | Procedure | Clinical procedures and interventions |
| observation | Observation | Patient monitoring and observations |
| education | Patient Education | Educational activities for patients |
| consultation | Consultation | Specialist consultations |
| follow-up | Follow-up | Follow-up appointments and checks |
| discharge | Discharge Planning | Discharge preparation tasks |
| referral | Referral | Patient referrals |
| lab-order | Laboratory Order | Laboratory test orders |
| imaging-order | Imaging Order | Imaging study orders |

## Available Workflow Templates

### 1. Admission Workflow
- **ID:** `admission-workflow`
- **Description:** Standard workflow for patient admission
- **Tasks:**
  - Initial patient assessment (urgent, due immediately)
  - Medication reconciliation (routine, due in 1 day)
  - Admission laboratory tests (routine, due immediately)
  - Patient orientation and education (routine, due in 1 day)

### 2. Discharge Workflow
- **ID:** `discharge-workflow`
- **Description:** Standard workflow for patient discharge
- **Tasks:**
  - Discharge planning (urgent, due immediately)
  - Discharge medication reconciliation (urgent, due immediately)
  - Discharge education and instructions (routine, due immediately)
  - Schedule follow-up appointments (routine, due in 1 day)

### 3. Diabetes Management
- **ID:** `diabetes-management`
- **Description:** Comprehensive diabetes care workflow
- **Tasks:**
  - Diabetes assessment and glucose monitoring (routine, due immediately)
  - Order HbA1c and lipid panel (routine, due in 1 day)
  - Diabetes self-management education (routine, due in 2 days)
  - Referral to diabetes educator if needed (routine, due in 7 days)

### 4. Post-Operative Care
- **ID:** `post-op-care`
- **Description:** Standard post-operative care workflow
- **Tasks:**
  - Post-operative assessment (urgent, due immediately)
  - Monitor vital signs and pain level (urgent, due immediately)
  - Pain management and medication (urgent, due immediately)
  - Wound care and dressing change (routine, due in 1 day)

## Error Handling

The API returns standardized error responses:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable error message",
  "details": "Additional error details if available"
}
```

Common error codes:
- `MISSING_AUTHORIZATION` - Authorization header missing
- `INVALID_TOKEN_FORMAT` - Invalid authorization header format
- `SESSION_EXPIRED` - JWT token or session expired
- `INSUFFICIENT_PERMISSIONS` - User lacks required permissions
- `VALIDATION_ERROR` - Request validation failed
- `RESOURCE_NOT_FOUND` - Requested resource not found
- `INTERNAL_SERVER_ERROR` - Server error occurred

## Best Practices

1. **Pagination**: Always use `_count` parameter for large result sets
2. **Filtering**: Use query parameters to filter results and reduce response size
3. **Status Updates**: Update task status as work progresses for accurate tracking
4. **Error Handling**: Implement proper error handling for all possible error responses
5. **Rate Limiting**: Implement exponential backoff when hitting rate limits
6. **Caching**: Cache workflow templates as they rarely change

## Integration Examples

### TypeScript SDK (Recommended)

```typescript
import { ClinicalWorkflowAPI } from '@omnicare/sdk';
import { Task, TaskStatus, TaskPriority } from '@omnicare/fhir-types';

// Initialize the SDK
const workflowAPI = new ClinicalWorkflowAPI({
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
  accessToken: await getAccessToken()
});

// Create a new task with full typing
async function createClinicalTask(
  patientId: string, 
  description: string,
  options?: {
    priority?: TaskPriority;
    category?: string;
    dueDate?: Date;
    practitionerId?: string;
  }
): Promise<Task> {
  return await workflowAPI.createTask({
    patientId,
    description,
    priority: options?.priority || 'routine',
    category: options?.category || 'assessment',
    dueDate: options?.dueDate?.toISOString(),
    practitionerId: options?.practitionerId
  });
}

// Get tasks with filtering and pagination
async function getPatientTasks(
  patientId: string,
  filters?: {
    status?: TaskStatus[];
    priority?: TaskPriority[];
    category?: string[];
    limit?: number;
    offset?: number;
  }
) {
  const queryParams = new URLSearchParams();
  queryParams.append('patient', patientId);
  
  if (filters?.status) {
    filters.status.forEach(s => queryParams.append('status', s));
  }
  if (filters?.priority) {
    filters.priority.forEach(p => queryParams.append('priority', p));
  }
  if (filters?.limit) {
    queryParams.append('_count', filters.limit.toString());
  }
  
  return await workflowAPI.getTasks(queryParams.toString());
}

// Real-time task updates with WebSocket
const taskSubscription = workflowAPI.subscribeToTaskUpdates({
  patientId,
  onUpdate: (task: Task) => {
    console.log('Task updated:', task);
    // Update UI or store
  },
  onError: (error) => {
    console.error('Task subscription error:', error);
  }
});

// Cleanup subscription
// taskSubscription.unsubscribe();
```

### Direct REST API Usage

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

// Create a new task
async function createClinicalTask(patientId: string, description: string) {
  const response = await fetch(`${API_BASE}/clinical-workflow/tasks`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Client-Version': '1.0.0'
    },
    body: JSON.stringify({
      patientId,
      description,
      priority: 'routine',
      category: 'assessment',
      metadata: {
        source: 'clinical-ui',
        timestamp: new Date().toISOString()
      }
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to create task: ${error.message}`);
  }
  
  return await response.json();
}

// Get tasks with advanced filtering
async function getPatientTasks(patientId: string, options = {}) {
  const params = new URLSearchParams({
    patient: patientId,
    _include: 'Task:patient,Task:owner',
    _sort: '-_lastUpdated',
    _count: '50',
    ...options
  });
  
  const response = await fetch(
    `${API_BASE}/clinical-workflow/tasks?${params}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/fhir+json'
      }
    }
  );
  
  if (!response.ok) {
    throw new Error(`Failed to fetch tasks: ${response.statusText}`);
  }
  
  return await response.json();
}
```

### Python SDK

```python
import asyncio
import aiohttp
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
from datetime import datetime

@dataclass
class TaskCreateRequest:
    patient_id: str
    description: str
    priority: str = 'routine'
    category: Optional[str] = None
    due_date: Optional[datetime] = None
    practitioner_id: Optional[str] = None
    encounter_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class ClinicalWorkflowAPI:
    def __init__(self, base_url: str, access_token: str):
        self.base_url = base_url.rstrip('/')
        self.headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json',
            'User-Agent': 'OmniCare-Python-SDK/1.0.0'
        }
        self.session: Optional[aiohttp.ClientSession] = None
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession(
            headers=self.headers,
            timeout=aiohttp.ClientTimeout(total=30)
        )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def create_task(self, request: TaskCreateRequest) -> Dict[str, Any]:
        """Create a new clinical task with comprehensive error handling"""
        url = f"{self.base_url}/clinical-workflow/tasks"
        
        payload = {
            'patientId': request.patient_id,
            'description': request.description,
            'priority': request.priority
        }
        
        if request.category:
            payload['category'] = request.category
        if request.due_date:
            payload['dueDate'] = request.due_date.isoformat()
        if request.practitioner_id:
            payload['practitionerId'] = request.practitioner_id
        if request.encounter_id:
            payload['encounterId'] = request.encounter_id
        if request.metadata:
            payload['metadata'] = request.metadata
        
        async with self.session.post(url, json=payload) as response:
            if response.status == 429:
                retry_after = int(response.headers.get('Retry-After', 60))
                raise RateLimitExceeded(f"Rate limit exceeded. Retry after {retry_after} seconds")
            
            response.raise_for_status()
            return await response.json()
    
    async def get_patient_tasks(
        self, 
        patient_id: str,
        status: Optional[List[str]] = None,
        priority: Optional[List[str]] = None,
        category: Optional[str] = None,
        limit: int = 50,
        include_resolved: bool = False
    ) -> Dict[str, Any]:
        """Get tasks for a patient with filtering options"""
        url = f"{self.base_url}/clinical-workflow/patients/{patient_id}/tasks"
        
        params = {'_count': limit}
        
        if status:
            params['status'] = ','.join(status)
        if priority:
            params['priority'] = ','.join(priority)
        if category:
            params['category'] = category
        if not include_resolved:
            params['status:not'] = 'completed,cancelled'
        
        async with self.session.get(url, params=params) as response:
            response.raise_for_status()
            return await response.json()
    
    async def update_task_status(
        self, 
        task_id: str, 
        status: str, 
        note: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Update task status with optional notes and metadata"""
        url = f"{self.base_url}/clinical-workflow/tasks/{task_id}/status"
        
        payload = {'status': status}
        if note:
            payload['note'] = note
        if metadata:
            payload['metadata'] = metadata
        
        async with self.session.patch(url, json=payload) as response:
            response.raise_for_status()
            return await response.json()
    
    async def bulk_update_tasks(
        self,
        updates: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Bulk update multiple tasks in a single request"""
        url = f"{self.base_url}/clinical-workflow/tasks/bulk-update"
        
        async with self.session.post(url, json={'updates': updates}) as response:
            response.raise_for_status()
            return await response.json()

class RateLimitExceeded(Exception):
    pass

# Usage example
async def main():
    async with ClinicalWorkflowAPI(
        base_url="http://localhost:8080/api",
        access_token="your-jwt-token"
    ) as api:
        # Create a task
        task_request = TaskCreateRequest(
            patient_id="patient-123",
            description="Complete initial assessment",
            priority="urgent",
            category="assessment",
            due_date=datetime.now().replace(hour=14, minute=0),
            metadata={"department": "emergency", "urgency_level": 1}
        )
        
        new_task = await api.create_task(task_request)
        print(f"Created task: {new_task['task']['id']}")
        
        # Get patient tasks
        tasks = await api.get_patient_tasks(
            patient_id="patient-123",
            status=["requested", "in-progress"],
            priority=["urgent", "stat"]
        )
        
        print(f"Found {len(tasks['tasks'])} urgent tasks")

if __name__ == "__main__":
    asyncio.run(main())
```

## Support

For API support and questions:
- Email: api-support@omnicare.com
- Documentation: https://docs.omnicare.com/api
- Status Page: https://status.omnicare.com