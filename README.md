# Next-Generation Clinical EMR Development Guide: OmniCare Platform

## Executive Summary

This guide presents a comprehensive approach to building a pure clinical EMR that leverages Medplum's extensive component library to create a feature-rich system designed to integrate seamlessly with existing EHR platforms. By utilizing Medplum's 120+ healthcare-specific React components and FHIR-native architecture, we can build a clinical-focused EMR that handles all patient care workflows while delegating billing, procurement, and logistics to the underlying EHR system. This separation of concerns allows for rapid development of sophisticated clinical features using production-tested components.

## 1. Enhanced Technology Stack

### 1.1 Frontend Architecture

**Core Framework**
- **React 18+** with TypeScript 5.x for type-safe development
- **Next.js 14** for server-side rendering and optimal performance
- **React Query (TanStack Query)** for server state management
- **Zustand** for client state management (lighter than Redux)
- **Mantine 7+** as the base UI framework (required by Medplum)

**Medplum Clinical Components**
Medplum provides 120+ healthcare-specific components that form the backbone of our EMR:

**Patient Management Components**
- **PatientTimeline** - Comprehensive patient history with events, notes, and attachments
- **PatientSummary** - Condensed patient demographics and key information
- **ResourceAvatar** - Smart avatars for patients, practitioners, and organizations
- **PatientHeader** - Consistent patient context header across all views

**Clinical Documentation Components**
- **EncounterTimeline** - Encounter-specific event tracking and documentation
- **ClinicalImpressionForm** - Structured clinical assessment forms
- **SmartText** - AI-powered clinical concept detection with SNOMED/ICD coding
- **NoteInput** - Rich text editor for clinical notes with templates
- **QuestionnaireForm** - Dynamic form rendering from FHIR Questionnaires
- **QuestionnaireBuilder** - Visual questionnaire designer

**Clinical Data Display Components**
- **ResourceTable** - Sortable, filterable tables for any FHIR resource
- **ResourceHistoryTable** - Complete audit trail with diff visualization
- **ObservationGraph** - Time-series visualization for vitals and lab results
- **DiagnosticReportDisplay** - Formatted diagnostic report viewer
- **AllergyIntoleranceDisplay** - Allergy list with severity indicators
- **ConditionTimeline** - Problem list with temporal relationships

**Medication Management Components**
- **MedicationRequestForm** - Complete e-prescribing interface
- **MedicationTimeline** - Medication history and adherence tracking
- **MedicationStatementForm** - Patient-reported medication recording
- **MedicationKnowledge** - Drug information and interaction checking

**Order Management Components**
- **ServiceRequestForm** - Lab, imaging, and procedure ordering
- **TaskList** - Clinical task management with priority queuing
- **RequestGroupForm** - Order sets and care protocols

**Communication Components**
- **ChatControl** - Secure clinical messaging interface
- **CommunicationThreads** - Organized clinical conversations
- **VideoCall** - Integrated telemedicine capabilities

**Search and Navigation Components**
- **SearchControl** - Powerful FHIR search with autocomplete
- **ResourcePicker** - Resource selection modals
- **FhirPathDisplay** - Dynamic data display using FHIRPath
- **Breadcrumbs** - Context-aware navigation

**Specialized Clinical Components**
- **CarePlanTimeline** - Visual care plan tracking
- **ImmunizationTable** - Vaccination records with schedule tracking
- **ProcedureForm** - Procedure documentation
- **ReferralForm** - Referral management
- **ConsentForm** - Digital consent collection

**LTHT React Integration (Optional)**
- **@ltht-react/diagnosis** - Enhanced diagnosis management
- **@ltht-react/flag** - Clinical alerts and warnings
- **@ltht-react/questionnaire** - NHS-specific questionnaire patterns

### 1.2 Backend Infrastructure

**FHIR Platform**
```typescript
// Primary FHIR backend options
interface FHIRBackend {
  option1: {
    type: "Medplum Server";
    deployment: "Self-hosted or SaaS";
    features: ["Complete FHIR R4", "Built-in auth", "Subscriptions", "Bots"];
  };
  option2: {
    type: "External EHR FHIR API";
    integration: "SMART on FHIR";
    features: ["Leverage existing data", "No data migration"];
  };
}
```

**Integration Architecture**
- **SMART on FHIR** for EHR integration
- **FHIR Subscriptions** for real-time updates
- **Clinical Decision Support Hooks**
- **HL7 v2 interfaces** (if needed)

### 1.3 Mobile Architecture

**React Native with Medplum**
- **@medplum/react-native** - Native healthcare components
- **@medplum/expo-polyfills** - Expo compatibility
- **Offline-first architecture** with sync
- **Biometric authentication**

## 2. Clinical-Focused Architecture

### 2.1 EMR-EHR Integration Pattern

```typescript
// Clean separation between EMR (clinical) and EHR (administrative)
interface SystemArchitecture {
  emr: {
    scope: "Clinical workflows and patient care";
    components: ["Charting", "Orders", "Results", "Medications", "Care Plans"];
    data: "FHIR clinical resources";
  };
  ehr: {
    scope: "Administrative and financial";
    components: ["Billing", "Claims", "Procurement", "Inventory", "Revenue Cycle"];
    data: "Financial and operational data";
  };
  integration: {
    method: "SMART on FHIR + Webhooks";
    sync: "Bidirectional for clinical data";
  };
}
```

### 2.2 Clinical Module Architecture

```typescript
// Domain-driven clinical modules
src/
├── modules/
│   ├── patient-chart/
│   │   ├── components/
│   │   │   ├── ChartHeader.tsx
│   │   │   ├── ProblemList.tsx
│   │   │   ├── MedicationList.tsx
│   │   │   └── AllergyList.tsx
│   │   ├── views/
│   │   │   ├── SummaryView.tsx
│   │   │   ├── TimelineView.tsx
│   │   │   └── FlowsheetView.tsx
│   │   └── hooks/
│   ├── clinical-notes/
│   │   ├── templates/
│   │   ├── components/
│   │   └── services/
│   ├── orders-results/
│   │   ├── laboratory/
│   │   ├── radiology/
│   │   ├── medications/
│   │   └── procedures/
│   ├── care-coordination/
│   │   ├── care-plans/
│   │   ├── referrals/
│   │   ├── tasks/
│   │   └── communications/
│   └── clinical-decision-support/
│       ├── alerts/
│       ├── reminders/
│       ├── guidelines/
│       └── calculators/
├── shared/
│   ├── fhir-client/
│   ├── auth/
│   └── ui-components/
└── integration/
    ├── ehr-connector/
    ├── lab-interfaces/
    └── pharmacy-interfaces/
```

## 3. Comprehensive Clinical Features

### 3.1 Patient Chart System

**Chart Navigation and Context**
```typescript
// Universal patient header with context
export const PatientChartLayout: React.FC = () => {
  const patient = useCurrentPatient();
  
  return (
    <div className="flex flex-col h-screen">
      <PatientHeader 
        patient={patient}
        showAlerts
        showAllergies
        showMedications
      />
      <TabNavigation tabs={[
        'Summary', 'Timeline', 'Problems', 'Medications', 
        'Orders', 'Results', 'Notes', 'Care Plan'
      ]} />
      <Outlet /> {/* Render active tab content */}
    </div>
  );
};
```

**Summary Dashboard**
- **Clinical Snapshot**: Latest vitals, active problems, current medications
- **Risk Scores**: Fall risk, pressure ulcer risk, readmission risk
- **Care Gaps**: Overdue screenings, missing immunizations
- **Recent Activity**: Last 5 encounters, recent results

**Timeline View**
```typescript
// Rich clinical timeline using Medplum components
<PatientTimeline
  patient={patient}
  showEncounters
  showObservations
  showMedications
  showProcedures
  showDocuments
  showCommunications
  filters={['encounters', 'labs', 'vitals', 'notes']}
  onAddNote={(note) => handleAddNote(note)}
  onUploadFile={(file) => handleFileUpload(file)}
/>
```

### 3.2 Clinical Documentation

**Smart Clinical Notes**
```typescript
// AI-enhanced note creation with templates
export const ClinicalNoteEditor: React.FC = () => {
  const templates = useNoteTemplates();
  const [note, setNote] = useState('');
  
  return (
    <div className="clinical-note-editor">
      <TemplateSelector 
        templates={templates}
        onSelect={(template) => applyTemplate(template)}
      />
      <SmartText
        value={note}
        onChange={setNote}
        onConceptDetected={(concept) => {
          // Auto-tag with SNOMED/ICD codes
          addClinicalConcept(concept);
        }}
        suggestions={true}
        macros={clinicalMacros}
      />
      <div className="mt-4">
        <h3>Detected Concepts</h3>
        <ConceptList concepts={detectedConcepts} />
      </div>
    </div>
  );
};
```

**Structured Documentation Forms**
- **History & Physical (H&P)**: Comprehensive intake documentation
- **Progress Notes**: SOAP, DAP, and custom formats
- **Procedure Notes**: Pre-defined templates by specialty
- **Discharge Summaries**: Auto-populated from encounter data

### 3.3 Order Management System

**Computerized Provider Order Entry (CPOE)**
```typescript
// Comprehensive order entry with decision support
export const OrderEntry: React.FC = () => {
  const [orderType, setOrderType] = useState<OrderType>('lab');
  
  return (
    <OrderWorkflow>
      <OrderTypeSelector 
        value={orderType}
        onChange={setOrderType}
        options={['lab', 'radiology', 'medication', 'procedure', 'consult']}
      />
      
      {orderType === 'lab' && (
        <LabOrderForm
          onSubmit={handleLabOrder}
          frequentOrders={getFrequentLabOrders()}
          orderSets={labOrderSets}
        />
      )}
      
      {orderType === 'medication' && (
        <MedicationRequestForm
          onSubmit={handleMedicationOrder}
          drugInteractionCheck={true}
          dosageCalculator={true}
          formularyCheck={true}
        />
      )}
      
      <ClinicalDecisionSupport
        context={currentOrderContext}
        showAlerts={true}
        showRecommendations={true}
      />
    </OrderWorkflow>
  );
};
```

**Order Sets and Protocols**
- **Admission Order Sets**: Standardized orders by condition
- **Post-Operative Protocols**: Surgery-specific order sets
- **Clinical Pathways**: Evidence-based care protocols
- **Standing Orders**: Nurse-initiated protocols

### 3.4 Results Management

**Laboratory Results**
```typescript
// Interactive lab results with trending
export const LabResults: React.FC = () => {
  return (
    <div className="lab-results">
      <ResultsFilter 
        categories={['Chemistry', 'Hematology', 'Microbiology', 'Pathology']}
        dateRange={dateRange}
        abnormalOnly={showAbnormalOnly}
      />
      
      <ObservationGraph
        observations={labResults}
        showTrends={true}
        showReferenceRanges={true}
        highlightAbnormal={true}
        interactive={true}
      />
      
      <ResourceTable
        resourceType="Observation"
        columns={['Date', 'Test', 'Result', 'Reference', 'Flag']}
        sortable={true}
        exportable={true}
        onRowClick={(obs) => showObservationDetail(obs)}
      />
    </div>
  );
};
```

**Radiology & Imaging**
- **PACS Integration**: View images directly in EMR
- **Report Display**: Structured radiology reports
- **Comparison Tools**: Side-by-side image comparison
- **Critical Results**: Automatic alerting for critical findings

### 3.5 Medication Management

**E-Prescribing System**
```typescript
// Complete medication workflow
export const MedicationManagement: React.FC = () => {
  const medications = usePatientMedications(patientId);
  const [showReconciliation, setShowReconciliation] = useState(false);
  
  return (
    <div className="medication-management">
      <MedicationTimeline
        medications={medications}
        showAdherence={true}
        showInteractions={true}
      />
      
      <div className="grid grid-cols-2 gap-4">
        <ActiveMedications 
          medications={medications.active}
          onRefill={handleRefill}
          onDiscontinue={handleDiscontinue}
        />
        
        <MedicationHistory 
          medications={medications.all}
          groupBy="class"
        />
      </div>
      
      <Button onClick={() => setShowReconciliation(true)}>
        Medication Reconciliation
      </Button>
      
      {showReconciliation && (
        <MedicationReconciliation
          homeMeds={medications.home}
          hospitalMeds={medications.hospital}
          onComplete={handleReconciliationComplete}
        />
      )}
    </div>
  );
};
```

**Drug Interaction Checking**
- **Real-time interaction alerts**
- **Allergy cross-checking**
- **Duplicate therapy warnings**
- **Dosage range validation**

### 3.6 Care Coordination

**Care Plans**
```typescript
// Collaborative care planning
export const CarePlanManager: React.FC = () => {
  const carePlans = useCarePlans(patientId);
  
  return (
    <CarePlanWorkspace>
      <CarePlanTimeline
        carePlans={carePlans}
        showGoals={true}
        showInterventions={true}
        showOutcomes={true}
      />
      
      <GoalSetting
        patient={patient}
        templates={goalTemplates}
        onGoalCreate={handleGoalCreate}
      />
      
      <TaskList
        tasks={carePlanTasks}
        assignees={careTeamMembers}
        onTaskUpdate={handleTaskUpdate}
      />
      
      <CareTeamDirectory
        members={careTeam}
        showRoles={true}
        showContact={true}
      />
    </CarePlanWorkspace>
  );
};
```

**Communication Hub**
```typescript
// Secure clinical messaging
<ChatControl
  criteria={`Communication?subject=Patient/${patientId}`}
  participants={careTeam}
  templates={messageTemplates}
  attachments={true}
  urgencyLevels={['routine', 'urgent', 'stat']}
/>
```

### 3.7 Clinical Decision Support

**Real-time Alerts and Reminders**
```typescript
// Intelligent clinical alerts
export const ClinicalAlerts: React.FC = () => {
  const alerts = useClinicalAlerts(patient, context);
  
  return (
    <AlertPanel>
      {alerts.map(alert => (
        <Alert
          key={alert.id}
          severity={alert.severity}
          dismissible={alert.userDismissible}
          actions={alert.suggestedActions}
        >
          <AlertTitle>{alert.title}</AlertTitle>
          <AlertDescription>{alert.description}</AlertDescription>
          {alert.evidence && (
            <EvidenceLink source={alert.evidence} />
          )}
        </Alert>
      ))}
    </AlertPanel>
  );
};
```

**Clinical Calculators and Tools**
- **Risk Scores**: MELD, CHA2DS2-VASc, Wells Criteria
- **Dosage Calculators**: Weight-based, renal dosing
- **Clinical Pathways**: Guideline-based recommendations
- **Quality Measures**: Real-time quality metric tracking

### 3.8 Specialty-Specific Features

**Procedure Documentation**
```typescript
// Comprehensive procedure tracking
<ProcedureForm
  procedure={currentProcedure}
  templates={procedureTemplates}
  timeTracking={true}
  complications={true}
  implantTracking={true}
  onComplete={handleProcedureComplete}
/>
```

**Immunization Management**
```typescript
<ImmunizationTable
  patient={patient}
  showSchedule={true}
  showContraindications={true}
  forecastNextDue={true}
  registrySync={true}
/>
```

**Chronic Disease Management**
- **Disease Registries**: Diabetes, hypertension, heart failure
- **Protocol-driven Care**: Automated care gap identification
- **Outcome Tracking**: Quality metrics and benchmarking
- **Patient Engagement**: Educational materials and reminders

## 4. Implementation Examples

### 4.1 Patient Chart Implementation

```typescript
// Complete patient chart using Medplum components
import { 
  PatientTimeline,
  ResourceTable,
  SearchControl,
  QuestionnaireForm,
  MedicationTimeline,
  ObservationGraph
} from '@medplum/react';

export const PatientChart: React.FC<{ patientId: string }> = ({ patientId }) => {
  const medplum = useMedplum();
  const [activeView, setActiveView] = useState<'timeline' | 'problems' | 'meds'>('timeline');
  
  // Fetch patient data with related resources
  const { data: patient } = useQuery({
    queryKey: ['patient', patientId, 'full'],
    queryFn: () => medplum.readResource('Patient', patientId, {
      _revinclude: ['Condition:subject', 'MedicationRequest:subject', 'Observation:subject']
    })
  });
  
  return (
    <div className="patient-chart">
      <PatientHeader patient={patient} />
      
      <TabGroup value={activeView} onChange={setActiveView}>
        <TabList>
          <Tab value="timeline">Timeline</Tab>
          <Tab value="problems">Problems</Tab>
          <Tab value="meds">Medications</Tab>
          <Tab value="vitals">Vitals</Tab>
          <Tab value="notes">Notes</Tab>
        </TabList>
        
        <TabPanels>
          <TabPanel value="timeline">
            <PatientTimeline
              patient={patient}
              showEncounters
              showObservations
              showMedications
              showDocuments
              onAddComment={(text) => createCommunication(patient, text)}
              onUploadFile={(file) => uploadDocument(patient, file)}
            />
          </TabPanel>
          
          <TabPanel value="problems">
            <ProblemList patientId={patientId} />
          </TabPanel>
          
          <TabPanel value="meds">
            <MedicationTimeline
              patient={patient}
              showAdministrations
              showRefills
              onPrescribe={() => openPrescriptionDialog()}
            />
          </TabPanel>
          
          <TabPanel value="vitals">
            <VitalsFlowsheet patientId={patientId} />
          </TabPanel>
          
          <TabPanel value="notes">
            <ClinicalNotes patientId={patientId} />
          </TabPanel>
        </TabPanels>
      </TabGroup>
    </div>
  );
};
```

### 4.2 Clinical Note Creation with Smart Features

```typescript
// Advanced clinical note editor with AI assistance
import { SmartText, QuestionnaireForm } from '@medplum/react';
import { detectClinicalConcepts } from '@/services/nlp';

export const ClinicalNoteEditor: React.FC<{ encounterId: string }> = ({ encounterId }) => {
  const [noteText, setNoteText] = useState('');
  const [detectedConcepts, setDetectedConcepts] = useState<ClinicalConcept[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Questionnaire>();
  
  // Real-time concept detection
  useEffect(() => {
    const detectConcepts = debounce(async (text: string) => {
      const concepts = await detectClinicalConcepts(text);
      setDetectedConcepts(concepts);
    }, 500);
    
    detectConcepts(noteText);
  }, [noteText]);
  
  const handleSaveNote = async () => {
    // Create ClinicalImpression with detected concepts
    const clinicalImpression: ClinicalImpression = {
      resourceType: 'ClinicalImpression',
      status: 'completed',
      subject: { reference: `Patient/${patientId}` },
      encounter: { reference: `Encounter/${encounterId}` },
      effectiveDateTime: new Date().toISOString(),
      summary: noteText,
      finding: detectedConcepts.map(concept => ({
        itemCodeableConcept: {
          coding: [{
            system: concept.system,
            code: concept.code,
            display: concept.display
          }]
        }
      }))
    };
    
    await medplum.createResource(clinicalImpression);
  };
  
  return (
    <div className="clinical-note-editor">
      <div className="mb-4">
        <TemplateSelector
          templates={noteTemplates}
          onSelect={setSelectedTemplate}
        />
      </div>
      
      {selectedTemplate ? (
        <QuestionnaireForm
          questionnaire={selectedTemplate}
          onSubmit={(response) => handleStructuredNote(response)}
        />
      ) : (
        <>
          <SmartText
            value={noteText}
            onChange={setNoteText}
            placeholder="Start typing clinical note..."
            suggestions={clinicalPhrases}
            macros={{
              '.vitals': () => insertLatestVitals(),
              '.meds': () => insertMedicationList(),
              '.problems': () => insertProblemList()
            }}
          />
          
          <div className="mt-4 p-4 bg-blue-50 rounded">
            <h4 className="font-semibold mb-2">Detected Clinical Concepts</h4>
            <div className="flex flex-wrap gap-2">
              {detectedConcepts.map((concept, idx) => (
                <Badge key={idx} variant="outline">
                  {concept.display}
                  <span className="ml-1 text-xs text-gray-500">
                    ({concept.system})
                  </span>
                </Badge>
              ))}
            </div>
          </div>
        </>
      )}
      
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline" onClick={() => setNoteText('')}>
          Cancel
        </Button>
        <Button onClick={handleSaveNote}>
          Sign Note
        </Button>
      </div>
    </div>
  );
};
```

### 4.3 Order Entry with Clinical Decision Support

```typescript
// Intelligent order entry system
import { ServiceRequestForm, SearchControl } from '@medplum/react';
import { checkOrderAppropriateness } from '@/services/cds';

export const OrderEntry: React.FC = () => {
  const [orderType, setOrderType] = useState<'lab' | 'imaging' | 'procedure'>('lab');
  const [selectedTests, setSelectedTests] = useState<ServiceRequest[]>([]);
  const [cdsAlerts, setCdsAlerts] = useState<CDSAlert[]>([]);
  
  const handleTestSelection = async (test: ServiceRequest) => {
    // Check clinical appropriateness
    const alerts = await checkOrderAppropriateness(test, patient);
    if (alerts.length > 0) {
      setCdsAlerts(alerts);
    }
    
    setSelectedTests([...selectedTests, test]);
  };
  
  return (
    <div className="order-entry">
      <OrderTypeSelector value={orderType} onChange={setOrderType} />
      
      <div className="grid grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-semibold mb-3">Search Orders</h3>
          <SearchControl
            resourceType="ActivityDefinition"
            searchParams={{
              topic: orderType,
              status: 'active'
            }}
            onSelect={handleTestSelection}
            placeholder={`Search ${orderType} orders...`}
          />
          
          <div className="mt-4">
            <h4 className="font-medium mb-2">Quick Orders</h4>
            <QuickOrderButtons
              orderType={orderType}
              onSelect={handleTestSelection}
            />
          </div>
          
          <div className="mt-4">
            <h4 className="font-medium mb-2">Order Sets</h4>
            <OrderSetList
              specialty={currentUser.specialty}
              onSelect={(orderSet) => addOrderSet(orderSet)}
            />
          </div>
        </div>
        
        <div>
          <h3 className="text-lg font-semibold mb-3">Selected Orders</h3>
          
          {cdsAlerts.length > 0 && (
            <AlertPanel alerts={cdsAlerts} className="mb-4" />
          )}
          
          <SelectedOrdersList
            orders={selectedTests}
            onRemove={(order) => removeOrder(order)}
            onEdit={(order) => editOrder(order)}
          />
          
          <div className="mt-6">
            <ServiceRequestForm
              serviceRequests={selectedTests}
              onSubmit={handleSubmitOrders}
              showPriority
              showInstructions
              showScheduling
            />
          </div>
        </div>
      </div>
    </div>
  );
};
```

### 4.4 Results Review Interface

```typescript
// Comprehensive results management
import { ObservationGraph, DiagnosticReportDisplay } from '@medplum/react';

export const ResultsReview: React.FC = () => {
  const [filter, setFilter] = useState<ResultFilter>({
    category: 'all',
    dateRange: 'week',
    abnormalOnly: false
  });
  
  const results = useLabResults(patientId, filter);
  const criticalResults = results.filter(r => r.interpretation?.coding?.[0].code === 'critical');
  
  return (
    <div className="results-review">
      {criticalResults.length > 0 && (
        <Alert severity="error" className="mb-4">
          <AlertTitle>Critical Results Requiring Review</AlertTitle>
          <CriticalResultsList results={criticalResults} />
        </Alert>
      )}
      
      <ResultsFilter value={filter} onChange={setFilter} />
      
      <Tabs defaultValue="table">
        <TabsList>
          <TabsTrigger value="table">Table View</TabsTrigger>
          <TabsTrigger value="graph">Trends</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>
        
        <TabsContent value="table">
          <ResourceTable
            resourceType="Observation"
            searchParams={{
              patient: patientId,
              category: filter.category,
              date: filter.dateRange,
              'value-quantity': filter.abnormalOnly ? 'abnormal' : undefined
            }}
            columns={[
              { key: 'effectiveDateTime', header: 'Date', type: 'date' },
              { key: 'code.display', header: 'Test' },
              { key: 'valueQuantity', header: 'Result', render: renderResult },
              { key: 'referenceRange', header: 'Reference' },
              { key: 'interpretation', header: 'Flag', render: renderFlag }
            ]}
            onRowClick={(obs) => showObservationDetail(obs)}
          />
        </TabsContent>
        
        <TabsContent value="graph">
          <TrendSelector
            commonPanels={['CBC', 'CMP', 'Lipids', 'Thyroid']}
            onSelect={(tests) => setGraphTests(tests)}
          />
          <ObservationGraph
            observations={graphTests}
            patient={patient}
            showReferenceRange
            showAnnotations
            interactive
          />
        </TabsContent>
        
        <TabsContent value="reports">
          <DiagnosticReportList
            patient={patient}
            category={filter.category}
            onSelect={(report) => setSelectedReport(report)}
          />
          {selectedReport && (
            <DiagnosticReportDisplay
              report={selectedReport}
              showImages
              showAttachments
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
```

## 5. Clinical Workflow Implementation

### 5.1 Encounter Management

```typescript
// Complete encounter workflow from check-in to discharge
export const EncounterWorkflow: React.FC = () => {
  const [encounter, setEncounter] = useState<Encounter>();
  const [stage, setStage] = useState<EncounterStage>('check-in');
  
  return (
    <EncounterContainer>
      <EncounterHeader 
        encounter={encounter}
        stage={stage}
        onStageChange={setStage}
      />
      
      {stage === 'check-in' && (
        <CheckInWorkflow
          onComplete={(enc) => {
            setEncounter(enc);
            setStage('triage');
          }}
        />
      )}
      
      {stage === 'triage' && (
        <TriageAssessment
          encounter={encounter}
          onComplete={() => setStage('assessment')}
        >
          <VitalsCapture required />
          <ChiefComplaintForm />
          <PainAssessment />
          <QuestionnaireForm questionnaire={triageQuestionnaire} />
        </TriageAssessment>
      )}
      
      {stage === 'assessment' && (
        <ClinicalAssessment
          encounter={encounter}
          templates={assessmentTemplates}
          onComplete={() => setStage('plan')}
        />
      )}
      
      {stage === 'plan' && (
        <TreatmentPlanning
          encounter={encounter}
          onOrdersPlaced={() => setStage('treatment')}
        />
      )}
      
      {stage === 'treatment' && (
        <TreatmentPhase
          encounter={encounter}
          onComplete={() => setStage('discharge')}
        />
      )}
      
      {stage === 'discharge' && (
        <DischargeWorkflow
          encounter={encounter}
          onComplete={handleDischarge}
        />
      )}
    </EncounterContainer>
  );
};
```

### 5.2 Clinical Task Management

```typescript
// Task-based clinical workflow orchestration
import { TaskList, TaskForm } from '@medplum/react';

export const ClinicalTaskManager: React.FC = () => {
  const tasks = useClinicalTasks({
    assignee: currentUser.id,
    status: ['ready', 'in-progress'],
    priority: ['stat', 'urgent', 'routine']
  });
  
  return (
    <div className="task-manager">
      <TaskFilters>
        <FilterByPriority />
        <FilterByType />
        <FilterByPatient />
        <FilterByDueDate />
      </TaskFilters>
      
      <TaskList
        tasks={tasks}
        groupBy="priority"
        showPatient
        showDueDate
        onTaskClick={(task) => openTaskDetail(task)}
        renderActions={(task) => (
          <TaskActions
            task={task}
            onStart={() => startTask(task)}
            onComplete={() => completeTask(task)}
            onDelegate={() => delegateTask(task)}
          />
        )}
      />
      
      <QuickTaskCreation>
        <Button onClick={() => createTask('vitals', 'routine')}>
          Request Vitals
        </Button>
        <Button onClick={() => createTask('lab-draw', 'urgent')}>
          Order Lab Draw
        </Button>
        <Button onClick={() => createTask('medication-admin', 'stat')}>
          Administer Medication
        </Button>
      </QuickTaskCreation>
    </div>
  );
};
```

### 5.3 Care Team Collaboration

```typescript
// Real-time care team coordination
export const CareTeamCollaboration: React.FC<{ patientId: string }> = ({ patientId }) => {
  const careTeam = useCareTeam(patientId);
  const [showHandoff, setShowHandoff] = useState(false);
  
  return (
    <div className="care-team-collaboration">
      <CareTeamRoster
        members={careTeam.members}
        showAvailability
        showRole
        showSpecialty
      />
      
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div>
          <h3 className="font-semibold mb-2">Team Communication</h3>
          <ChatControl
            criteria={`Communication?subject=Patient/${patientId}`}
            participants={careTeam.members}
            showUrgency
            templates={[
              'Consultation Request',
              'Status Update',
              'Handoff Note'
            ]}
          />
        </div>
        
        <div>
          <h3 className="font-semibold mb-2">Shared Tasks</h3>
          <TeamTaskBoard
            tasks={careTeam.tasks}
            onAssign={(task, member) => assignTask(task, member)}
            onStatusChange={(task, status) => updateTaskStatus(task, status)}
          />
        </div>
      </div>
      
      <Button 
        className="mt-4"
        onClick={() => setShowHandoff(true)}
      >
        Create Handoff Report
      </Button>
      
      {showHandoff && (
        <HandoffReport
          patient={patient}
          careTeam={careTeam}
          onComplete={(report) => {
            createHandoffCommunication(report);
            setShowHandoff(false);
          }}
        />
      )}
    </div>
  );
};
```

## 6. Mobile Clinical Applications

### 6.1 Point-of-Care Mobile App

```typescript
// React Native clinical app for bedside care
import { MedplumProvider } from '@medplum/react-native';
import { BiometricAuth } from '@/components/BiometricAuth';

export const MobileClinicalApp: React.FC = () => {
  const [authenticated, setAuthenticated] = useState(false);
  
  return (
    <MedplumProvider config={medplumConfig}>
      {!authenticated ? (
        <BiometricAuth
          onSuccess={() => setAuthenticated(true)}
          fallbackToPin
        />
      ) : (
        <NavigationContainer>
          <Stack.Navigator>
            <Stack.Screen name="PatientList" component={PatientListScreen} />
            <Stack.Screen name="PatientChart" component={PatientChartScreen} />
            <Stack.Screen name="VitalsCapture" component={VitalsCaptureScreen} />
            <Stack.Screen name="MedicationAdmin" component={MedAdminScreen} />
            <Stack.Screen name="TaskList" component={TaskListScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      )}
    </MedplumProvider>
  );
};

// Offline-capable vitals capture
export const VitalsCaptureScreen: React.FC = () => {
  const [vitals, setVitals] = useState<VitalSigns>({});
  const syncManager = useOfflineSync();
  
  const handleSaveVitals = async () => {
    const observations = createVitalSignObservations(vitals);
    
    // Save locally first
    await syncManager.saveOffline('Observation', observations);
    
    // Sync when online
    syncManager.syncWhenOnline();
    
    navigation.goBack();
  };
  
  return (
    <ScrollView>
      <VitalsForm
        value={vitals}
        onChange={setVitals}
        validation={vitalSignRanges}
      />
      <BarcodeMedScanner
        onScan={(medication) => setScannedMed(medication)}
      />
      <SaveButton onPress={handleSaveVitals} />
    </ScrollView>
  );
};
```

### 6.2 Home Care Mobile Solution

```typescript
// Mobile app for home health visits
export const HomeCareApp: React.FC = () => {
  const location = useLocation();
  const [currentVisit, setCurrentVisit] = useState<Encounter>();
  
  return (
    <HomeCareDashboard>
      <TodaysSchedule
        visits={scheduledVisits}
        onStartVisit={(visit) => {
          // Verify location for compliance
          if (verifyVisitLocation(visit, location)) {
            startVisit(visit);
            setCurrentVisit(visit);
          }
        }}
      />
      
      {currentVisit && (
        <VisitWorkflow
          visit={currentVisit}
          offlineCapable
        >
          <VisitChecklist tasks={visitTasks} />
          <VitalSignsCapture />
          <WoundAssessment camera />
          <MedicationReconciliation />
          <PatientEducation resources={educationMaterials} />
          <VisitNote template={homeVisitTemplate} />
        </VisitWorkflow>
      )}
      
      <OfflineSyncStatus
        pendingItems={syncManager.pendingCount}
        lastSync={syncManager.lastSyncTime}
        onManualSync={() => syncManager.syncNow()}
      />
    </HomeCareDashboard>
  );
};
```

## 7. Clinical Decision Support Integration

### 7.1 Real-time CDS Implementation

```typescript
// CDS Hooks integration for clinical intelligence
export const ClinicalDecisionSupport = {
  // Hook: medication-prescribe
  medicationPrescribe: async (context: CDSContext): Promise<CDSResponse> => {
    const patient = context.patient;
    const medication = context.medications[0];
    
    const cards: CDSCard[] = [];
    
    // Check drug interactions
    const interactions = await checkDrugInteractions(medication, patient);
    if (interactions.length > 0) {
      cards.push({
        summary: 'Drug Interaction Warning',
        indicator: 'warning',
        detail: formatInteractions(interactions),
        suggestions: alternativeMedications(medication)
      });
    }
    
    // Check allergies
    const allergyCheck = await checkAllergies(medication, patient);
    if (allergyCheck.hasAllergy) {
      cards.push({
        summary: 'Allergy Alert',
        indicator: 'critical',
        detail: allergyCheck.detail,
        suggestions: [{
          label: 'Cancel prescription',
          actions: [{ type: 'delete', resource: medication }]
        }]
      });
    }
    
    // Renal dosing
    const renalAdjustment = await checkRenalDosing(medication, patient);
    if (renalAdjustment.needed) {
      cards.push({
        summary: 'Renal Dosing Adjustment',
        indicator: 'info',
        detail: renalAdjustment.recommendation,
        suggestions: [{
          label: 'Adjust dose',
          actions: [{ 
            type: 'update', 
            resource: adjustDose(medication, renalAdjustment) 
          }]
        }]
      });
    }
    
    return { cards };
  },
  
  // Hook: order-select
  orderSelect: async (context: CDSContext): Promise<CDSResponse> => {
    const appropriateness = await checkOrderAppropriateness(context);
    const duplicates = await checkDuplicateOrders(context);
    const guidelines = await getRelevantGuidelines(context);
    
    return {
      cards: [
        ...appropriateness.cards,
        ...duplicates.cards,
        ...guidelines.cards
      ]
    };
  }
};
```

### 7.2 Clinical Quality Measures

```typescript
// Real-time quality measure tracking
export const QualityMeasuresDashboard: React.FC = () => {
  const measures = useQualityMeasures({
    program: 'MIPS',
    reportingPeriod: currentYear
  });
  
  return (
    <div className="quality-measures">
      <MeasuresSummary
        measures={measures}
        showProgress
        showGaps
      />
      
      <div className="grid grid-cols-3 gap-4 mt-6">
        {measures.map(measure => (
          <MeasureCard key={measure.id}>
            <MeasureHeader
              title={measure.title}
              score={measure.score}
              target={measure.target}
            />
            <ProgressBar
              value={measure.numerator}
              max={measure.denominator}
              showPercentage
            />
            <MeasureActions
              gaps={measure.gaps}
              onViewGaps={() => showCareGaps(measure)}
              onRunReport={() => generateMeasureReport(measure)}
            />
          </MeasureCard>
        ))}
      </div>
      
      <CareGapsList
        gaps={allCareGaps}
        onResolve={(gap) => openGapResolution(gap)}
      />
    </div>
  );
};
```

## 8. Implementation Roadmap

### Phase 1: Foundation & Core EMR (Months 0-2)
- Set up development environment with Medplum
- Implement SMART on FHIR integration with existing EHR
- Deploy basic patient chart with Medplum components
- Create provider authentication and authorization
- Implement patient search and demographics
- Build basic clinical note creation
- Set up development and staging environments

### Phase 2: Clinical Documentation (Months 2-4)
- Implement comprehensive note templates
- Add SmartText with clinical concept detection
- Deploy QuestionnaireForm for structured documentation
- Create specialty-specific documentation workflows
- Implement voice-to-text capabilities
- Add clinical photo capture and annotation
- Build document management system

### Phase 3: Orders & Results (Months 4-6)
- Build CPOE with order sets
- Implement laboratory integration
- Create results review interface with trending
- Add radiology order and results workflow
- Implement critical value alerting
- Build procedure order management
- Create referral management system

### Phase 4: Medication Management (Months 6-8)
- Deploy e-prescribing with drug interaction checking
- Implement medication reconciliation
- Add medication administration recording
- Create drug allergy and intolerance management
- Build formulary integration
- Implement controlled substance workflows
- Add patient medication education

### Phase 5: Care Coordination (Months 8-10)
- Build care team collaboration tools
- Implement care plans with goal tracking
- Create task management system
- Add secure clinical messaging
- Deploy handoff tools
- Implement care transitions workflow
- Build patient communication portal

### Phase 6: Mobile & Advanced Features (Months 10-12)
- Deploy mobile clinical applications
- Implement offline synchronization
- Add clinical decision support
- Build quality measure tracking
- Create analytics dashboards
- Implement telemedicine capabilities
- Complete regulatory compliance validation

## 9. Best Practices & Guidelines

### Clinical Safety
- [ ] Implement patient identification verification at every step
- [ ] Add allergy checking to all medication workflows  
- [ ] Create hard stops for critical safety checks
- [ ] Implement comprehensive audit logging
- [ ] Add timeout and re-authentication for sensitive actions
- [ ] Build clinical error reporting system
- [ ] Implement downtime procedures

### Performance & Scalability
- [ ] Optimize FHIR queries with proper search parameters
- [ ] Implement progressive data loading
- [ ] Use React Query for efficient caching
- [ ] Optimize bundle sizes with code splitting
- [ ] Implement virtual scrolling for large datasets
- [ ] Add performance monitoring
- [ ] Plan for horizontal scaling

### User Experience
- [ ] Maintain consistent clinical workflows
- [ ] Minimize clicks for common tasks
- [ ] Implement smart defaults
- [ ] Add keyboard shortcuts for power users
- [ ] Create role-specific interfaces
- [ ] Build comprehensive help system
- [ ] Implement user preference persistence

## Conclusion

This comprehensive clinical EMR built on Medplum's robust component library provides a complete solution for patient care while seamlessly integrating with existing EHR systems. By leveraging Medplum's 120+ healthcare-specific React components and FHIR-native architecture, healthcare organizations can rapidly deploy a modern, user-friendly EMR that enhances clinical efficiency and improves patient outcomes. The modular architecture ensures flexibility for customization while maintaining standardization where it matters most.# OmniCare
