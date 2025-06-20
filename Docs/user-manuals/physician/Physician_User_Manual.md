# OmniCare EMR Physician User Manual

## Table of Contents

1. [Getting Started](#getting-started)
2. [Patient Chart Navigation](#patient-chart-navigation)
3. [Clinical Documentation](#clinical-documentation)
4. [Order Management (CPOE)](#order-management-cpoe)
5. [Medication Management](#medication-management)
6. [Results Review](#results-review)
7. [Clinical Decision Support](#clinical-decision-support)
8. [Patient Communication](#patient-communication)
9. [Quality Measures](#quality-measures)
10. [Mobile Access](#mobile-access)
11. [Troubleshooting](#troubleshooting)
12. [Quick Reference](#quick-reference)

## Getting Started

### System Access

#### Web Application
1. Navigate to https://omnicare.health/provider
2. Click "Sign In with Institution"
3. Enter your credentials or use single sign-on (SSO)
4. Complete two-factor authentication if required

#### Mobile Application
1. Download "OmniCare Provider" from app store
2. Use same credentials as web application
3. Enable biometric authentication for quick access

### Dashboard Overview

Upon login, you'll see your personalized dashboard:

- **Today's Schedule**: Upcoming appointments and procedures
- **Inbox**: Messages, results, and alerts requiring attention
- **Quick Actions**: Commonly used functions (new patient, write prescription, etc.)
- **Patient Search**: Quick access to patient records
- **Clinical Reminders**: Overdue tasks and follow-ups

### Navigation Basics

**Main Navigation Menu (Left Sidebar):**
- 🏠 **Dashboard**: Home screen overview
- 👥 **Patients**: Patient search and management
- 📋 **Schedule**: Appointment calendar
- 📊 **Inbox**: Messages and notifications
- 🔬 **Orders**: Lab and imaging orders
- 💊 **Prescriptions**: Medication management
- 📈 **Reports**: Clinical reports and analytics

**Top Navigation:**
- **Search**: Global patient search
- **Notifications**: System alerts and messages
- **Profile**: User settings and preferences
- **Help**: Documentation and support

## Patient Chart Navigation

### Finding Patients

#### Quick Search
1. Use the search bar at the top of any page
2. Enter patient name, MRN, DOB, or phone number
3. Select from the autocomplete results
4. Recent patients appear in the dropdown

#### Advanced Search
1. Click **Patients** in the main menu
2. Use filters for detailed search:
   - Name (first, last, or both)
   - Date of birth range
   - Medical record number
   - Insurance information
   - Provider assignment

### Patient Chart Layout

The patient chart is organized into tabs for easy navigation:

#### **Summary Tab**
- Patient demographics and contact information
- Insurance and coverage details
- Emergency contacts
- Problem list (active diagnoses)
- Current medications
- Known allergies and adverse reactions
- Recent vital signs
- Upcoming appointments

#### **Encounters Tab**
- Chronological list of all patient visits
- Filter by date range, provider, or encounter type
- Quick preview of visit summaries
- Direct access to encounter documentation

#### **History Tab**
- Comprehensive medical history
- Family history
- Social history (smoking, alcohol, etc.)
- Surgical history
- Immunization record

#### **Medications Tab**
- Active prescriptions with dosages and frequencies
- Medication history and changes
- Pharmacy information
- Medication reconciliation tools
- Drug interaction warnings

#### **Results Tab**
- Laboratory results with trending graphs
- Imaging reports and images
- Pathology reports
- Cardiology studies (EKGs, echocardiograms)
- Filter by test type, date range, or abnormal values

#### **Documents Tab**
- Scanned documents and external records
- Patient-provided documents
- Consent forms
- Insurance cards and identification

### Patient Context Bar

The patient context bar remains visible throughout the chart:
- **Patient Name** and **MRN**
- **Age** and **DOB**
- **Current Encounter** information
- **Alert Icons** for allergies, advanced directives, etc.
- **Quick Actions**: Message patient, schedule appointment, print summary

## Clinical Documentation

### Creating Documentation

#### Starting a New Note
1. Navigate to the patient chart
2. Click **New Note** or **+ Add Documentation**
3. Select the note type:
   - Progress Note
   - Consultation Note
   - Procedure Note
   - Discharge Summary
   - Telephone Encounter

#### Smart Text and Templates

**Using Smart Text:**
- Type `.` followed by abbreviation (e.g., `.pe` for physical exam)
- Select from autocomplete suggestions
- Smart text adapts based on specialty and preferences

**Common Smart Text Examples:**
- `.cc` - Chief complaint template
- `.pe` - Physical examination template
- `.ap` - Assessment and plan template
- `.ros` - Review of systems template

**Template Management:**
1. Access **Templates** from the documentation toolbar
2. Select from personal or shared templates
3. Create custom templates with favorite phrases
4. Share templates with colleagues or department

#### AI-Assisted Documentation

**Clinical Concept Detection:**
- System automatically suggests ICD-10 codes as you type
- Highlights potential coding opportunities
- Provides clinical decision support recommendations

**Voice Recognition:**
1. Click the microphone icon in any text field
2. Speak clearly and naturally
3. Review and edit transcribed text
4. Voice recognition learns your speech patterns

### Documentation Best Practices

#### Structured Documentation
- Use problem-oriented documentation (SOAP format)
- Include relevant history and physical findings
- Document medical decision-making process
- Specify follow-up plans and patient instructions

#### Time-Saving Tips
- Use templates for routine encounters
- Master smart text abbreviations
- Leverage copy-forward functionality for chronic conditions
- Utilize voice recognition for longer notes

#### Quality Documentation
- Be specific and objective
- Avoid copy-paste without review
- Document negative findings when relevant
- Include patient education provided

### Signing and Finalizing Notes

#### Electronic Signature
1. Review completed documentation
2. Click **Sign Note**
3. Enter your PIN or use biometric authentication
4. Note becomes part of the permanent medical record

#### Addenda and Amendments
- **Addendum**: Add additional information without changing original note
- **Amendment**: Correct errors in signed documentation
- Both require electronic signature and reason for change

## Order Management (CPOE)

### Computerized Provider Order Entry Overview

The CPOE system integrates with clinical decision support to ensure safe, efficient ordering.

### Laboratory Orders

#### Ordering Lab Tests
1. Navigate to patient chart
2. Click **Orders** > **Laboratory**
3. Search for test by name or browse by category:
   - Basic Metabolic Panel (BMP)
   - Complete Blood Count (CBC)
   - Lipid Panel
   - Hemoglobin A1c
   - Thyroid Function Tests

#### Order Details
- **Priority**: Routine, STAT, ASAP
- **Collection Instructions**: Fasting, timed collection
- **Frequency**: One-time, daily, weekly
- **Duration**: Number of days or specific dates

#### Order Sets
Use predefined order sets for common scenarios:
- **Diabetes Monitoring**: A1c, lipids, microalbumin
- **Hypertension Workup**: BMP, lipids, TSH, urinalysis
- **Annual Physical**: CBC, BMP, lipids, TSH, urinalysis

### Imaging Orders

#### Ordering Imaging Studies
1. Select **Orders** > **Imaging**
2. Choose study type:
   - X-ray
   - CT scan
   - MRI
   - Ultrasound
   - Nuclear medicine

#### Required Information
- **Clinical indication** (automatically suggests ICD-10 codes)
- **Body part/region**
- **Contrast requirements**
- **Priority level**
- **Special instructions**

#### Radiology Decision Support
- System provides appropriateness criteria
- Suggests alternative imaging when appropriate
- Alerts for duplicate orders
- Pre-authorization requirements displayed

### Procedure Orders

#### Ordering Procedures
1. Access **Orders** > **Procedures**
2. Search by procedure name or CPT code
3. Specify procedure details:
   - Scheduling requirements
   - Preparation instructions
   - Special equipment needs

### Referral Management

#### Creating Referrals
1. Go to **Orders** > **Referrals**
2. Select specialty or specific provider
3. Include:
   - Reason for referral
   - Relevant clinical information
   - Urgency level
   - Patient preferences

#### Tracking Referrals
- Monitor referral status
- Receive notifications when appointments are scheduled
- Track completion of referral recommendations

## Medication Management

### E-Prescribing

#### Writing Prescriptions
1. Navigate to patient chart
2. Click **Prescriptions** > **New Prescription**
3. Search for medication by:
   - Generic name
   - Brand name
   - Drug class
   - Indication

#### Prescription Details
- **Medication**: Select from formulary
- **Strength**: Available dosages displayed
- **Dosage Form**: Tablet, capsule, liquid, etc.
- **Quantity**: Number of units
- **Days Supply**: Duration of therapy
- **Refills**: Number of refills authorized
- **Directions**: Detailed instructions for patient

#### Drug Interaction Checking
System automatically checks for:
- **Drug-drug interactions**
- **Drug-allergy interactions**
- **Drug-disease interactions**
- **Duplicate therapy alerts**
- **Dosing alerts** based on age, weight, kidney function

### Medication Reconciliation

#### Performing Med Rec
1. Review current medication list
2. Compare with patient-reported medications
3. Identify discrepancies:
   - Medications patient is taking but not listed
   - Listed medications patient is not taking
   - Dosage differences
4. Update medication list with changes
5. Document reconciliation completion

#### Best Practices
- Perform med rec at every encounter
- Ask patients to bring medication bottles
- Check with pharmacy for recent fills
- Document reason for any changes

### Prescription Monitoring

#### Controlled Substances
- System integrates with state PDMP (Prescription Drug Monitoring Program)
- Automatic alerts for potential misuse
- Required PDMP checks for controlled substances
- Documentation of PDMP review

#### Prescription Status Tracking
Monitor prescription status:
- **Sent**: Transmitted to pharmacy
- **Received**: Pharmacy received prescription
- **In Progress**: Being filled
- **Ready**: Available for pickup
- **Picked Up**: Dispensed to patient

## Results Review

### Laboratory Results

#### Viewing Results
1. Navigate to patient chart
2. Click **Results** tab
3. Results organized by:
   - Date (newest first)
   - Test type
   - Abnormal values highlighted

#### Result Details
- **Reference ranges** displayed
- **Trending graphs** for serial results
- **Critical values** prominently marked
- **Previous results** for comparison

#### Taking Action on Results
- **Acknowledge**: Mark as reviewed
- **Comment**: Add clinical interpretation
- **Follow-up**: Create tasks or orders
- **Patient Communication**: Send results to patient portal

### Imaging Results

#### Radiology Reports
- **Preliminary reports** available immediately
- **Final reports** with radiologist interpretation
- **Images** viewable in integrated PACS viewer
- **Comparison** with prior studies

#### Critical Results Management
- **STAT notifications** for critical findings
- **Automatic alerts** via multiple channels
- **Acknowledgment required** for critical results
- **Follow-up tracking** for critical findings

### Pathology and Specialty Results

#### Pathology Reports
- **Gross description** and **microscopic findings**
- **Diagnosis** and **staging** information
- **Special stains** and **immunohistochemistry**
- **Molecular testing** results when applicable

## Clinical Decision Support

### Real-Time Alerts

#### Medication Alerts
- **Drug interactions**: Severity levels and recommendations
- **Allergy alerts**: Known allergies and cross-sensitivities
- **Dosing alerts**: Age, weight, and renal dosing adjustments
- **Duplicate therapy**: Multiple medications in same class

#### Preventive Care Reminders
- **Immunizations**: Due dates and overdue vaccines
- **Screening tests**: Mammography, colonoscopy, etc.
- **Chronic disease monitoring**: A1c, LDL, blood pressure goals

### Clinical Guidelines

#### Evidence-Based Recommendations
- **Treatment guidelines** integrated into workflow
- **Quality measures** tracking and reporting
- **Best practice alerts** for common conditions
- **Drug formulary** integration with cost information

### Risk Calculators

#### Integrated Calculators
- **Cardiovascular risk** (ASCVD Risk Calculator)
- **Fracture risk** (FRAX)
- **Bleeding risk** (HAS-BLED, CHADS2-VASc)
- **eGFR** and **drug dosing** adjustments

## Patient Communication

### Secure Messaging

#### Sending Messages
1. From patient chart, click **Message Patient**
2. Select message type:
   - General communication
   - Test results
   - Appointment reminder
   - Health maintenance
3. Compose message
4. Send to patient portal

#### Managing Inbox
- **Unread messages** highlighted
- **Priority levels** for urgent communications
- **Auto-replies** for common questions
- **Delegation** to staff members

### Patient Portal Integration

#### Sharing Information
- **Test results** with interpretations
- **Visit summaries** after encounters
- **Educational materials** specific to conditions
- **Care plans** and treatment goals

#### Patient Requests
Handle patient requests for:
- **Prescription refills**
- **Appointment scheduling**
- **Medical records**
- **Referrals and authorizations**

## Quality Measures

### Quality Reporting

#### Performance Dashboards
View performance on:
- **Diabetes care** (A1c, BP, LDL control)
- **Hypertension management**
- **Preventive care** (mammograms, colonoscopies)
- **Medication adherence**

#### HEDIS and MIPS Measures
- **Automated tracking** of quality measures
- **Patient registries** for chronic conditions
- **Intervention reminders** to close care gaps
- **Reporting tools** for quality programs

### Population Health

#### Patient Registries
- **Diabetes registry** with risk stratification
- **Hypertension registry** with BP trends
- **High-risk patients** identification
- **Care gaps** reporting and management

## Mobile Access

### OmniCare Provider Mobile App

#### Key Features
- **Patient lookup** and chart review
- **Secure messaging** with patients and staff
- **Lab results** review and acknowledgment
- **Prescription writing** and refill management
- **Schedule viewing** and basic updates

#### Offline Capability
- **Recent patients** cached for offline access
- **Sync** when connection restored
- **Critical alerts** pushed when online

### Mobile Workflow Tips

#### Efficient Mobile Use
- **Voice dictation** for notes and messages
- **Touch ID/Face ID** for quick authentication
- **Favorites** for frequently accessed patients
- **Quick actions** for common tasks

## Troubleshooting

### Common Issues and Solutions

#### Login Problems
**Issue**: Cannot access system
**Solutions**:
- Verify internet connection
- Clear browser cache and cookies
- Try different browser or incognito mode
- Contact IT support for password reset

#### Performance Issues
**Issue**: System running slowly
**Solutions**:
- Close unnecessary browser tabs
- Clear browser cache
- Check internet connection speed
- Try different browser

#### Prescription Problems
**Issue**: Cannot send prescription
**Solutions**:
- Verify patient pharmacy information
- Check for drug interaction alerts
- Ensure DEA number is current
- Contact pharmacy directly if needed

#### Results Not Appearing
**Issue**: Expected lab results not visible
**Solutions**:
- Check results tab filters
- Verify correct patient selected
- Refresh page or re-login
- Contact lab if results are overdue

#### Mobile App Issues
**Issue**: App not syncing or crashing
**Solutions**:
- Update app to latest version
- Restart device
- Check internet connection
- Delete and reinstall app if needed

### Getting Help

#### In-System Help
- **Help icon** (?) available on every page
- **Contextual help** for specific features
- **Video tutorials** for common tasks
- **Tip of the day** notifications

#### Technical Support
- **IT Help Desk**: Available 24/7
- **Clinical Support**: Business hours
- **Training Department**: Scheduled sessions
- **User Guides**: Comprehensive documentation

## Quick Reference

### Keyboard Shortcuts

| Function | Shortcut |
|----------|----------|
| Global search | Ctrl+K |
| New patient search | Ctrl+P |
| New note | Ctrl+N |
| New prescription | Ctrl+R |
| New order | Ctrl+O |
| Save document | Ctrl+S |
| Print | Ctrl+P |
| Navigate back | Alt+← |
| Navigate forward | Alt+→ |

### Smart Text Shortcuts

| Abbreviation | Expands To |
|--------------|------------|
| .cc | Chief Complaint template |
| .pe | Physical Exam template |
| .ros | Review of Systems template |
| .ap | Assessment and Plan template |
| .hpi | History of Present Illness template |
| .pmh | Past Medical History template |
| .sh | Social History template |
| .fh | Family History template |
| .meds | Current Medications list |
| .all | Allergies template |

### Common Lab Abbreviations

| Abbreviation | Full Name |
|--------------|-----------|
| BMP | Basic Metabolic Panel |
| CMP | Comprehensive Metabolic Panel |
| CBC | Complete Blood Count |
| A1c | Hemoglobin A1c |
| TSH | Thyroid Stimulating Hormone |
| PSA | Prostate Specific Antigen |
| PT/INR | Prothrombin Time/International Normalized Ratio |
| ESR | Erythrocyte Sedimentation Rate |
| CRP | C-Reactive Protein |
| UA | Urinalysis |

### Emergency Contacts

| Service | Contact |
|---------|---------|
| IT Help Desk | ext. 4357 (HELP) |
| Clinical Support | ext. 2877 |
| Pharmacy | ext. 7946 |
| Laboratory | ext. 5227 |
| Radiology | ext. 7234 |
| Medical Records | ext. 6372 |

### Tips for Efficient EMR Use

#### Documentation Efficiency
1. **Use templates** for routine visits
2. **Master smart text** for common phrases
3. **Voice recognition** for longer narratives
4. **Copy forward** stable chronic conditions
5. **Time your documentation** during patient visits

#### Order Management
1. **Use order sets** for common scenarios
2. **Favorite frequently ordered items**
3. **Check decision support alerts** before overriding
4. **Bundle related orders** to minimize clicks
5. **Set up default preferences** for ordering

#### Result Management
1. **Set up filters** for your specialty
2. **Use result folders** for organization
3. **Create result notification preferences**
4. **Batch review** similar result types
5. **Use trending views** for chronic conditions

This manual serves as your comprehensive guide to using OmniCare EMR effectively in your clinical practice. For additional support or training, contact the Clinical Informatics team or visit the help center within the application.