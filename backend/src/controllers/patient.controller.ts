import { Patient, Condition, MedicationRequest, AllergyIntolerance, Encounter, Observation, Immunization } from '@medplum/fhirtypes';
import { Request, Response } from 'express';

import { auditService } from '../services/audit.service';
import { fhirResourcesService } from '../services/fhir-resources.service';
import { medplumService } from '../services/medplum.service';
import { FHIRSearchParams } from '../types/fhir';
import logger from '../utils/logger';

/**
 * Enhanced Patient Controller with comprehensive search and profile capabilities
 * Optimized for mobile performance with support for partial loading and efficient data fetching
 */
export class PatientController {
  /**
   * Enhanced patient search with multiple filter options
   * Supports: name, DOB, MRN, phone, insurance ID
   * Includes pagination, sorting, mobile optimization, and selective field loading
   */
  async searchPatients(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const cacheHit = false;
    
    try {
      const {
        name,
        birthdate,
        identifier, // MRN
        phone,
        email,
        gender,
        address,
        'insurance-id': insuranceId,
        _count,
        _offset,
        _sort,
        _elements,
        _summary,
        _minimal, // New: return minimal patient data
        _include, // New: specify which related resources to include
        ...otherParams
      } = req.query as { [key: string]: string | undefined };

      logger.info('Patient search requested', {
        userId: req.user?.id,
        filters: Object.keys(req.query),
        ip: req.ip
      });

      // Build search parameters
      const searchParams: FHIRSearchParams = {};
      
      // Only add valid FHIR search parameters
      Object.entries(otherParams).forEach(([key, value]) => {
        if (typeof value === 'string' || typeof value === 'number') {
          searchParams[key] = value;
        }
      });

      // Add specific search filters
      if (name) searchParams.name = name;
      if (birthdate) searchParams.birthdate = birthdate;
      if (identifier) searchParams.identifier = identifier;
      if (phone) searchParams.phone = phone;
      if (email) searchParams.email = email;
      if (gender) searchParams.gender = gender;
      if (address) searchParams.address = address;
      
      // Handle insurance ID search through identifier
      if (insuranceId) {
        searchParams.identifier = `http://example.org/insurance|${insuranceId}`;
      }

      // Pagination and sorting with optimization
      const maxCount = _minimal === 'true' ? 50 : 25; // Higher limit for minimal data
      searchParams._count = _count ? Math.min(Number(_count), maxCount) : 10;
      if (_offset) searchParams._offset = Number(_offset);
      searchParams._sort = _sort || '-_lastUpdated';

      // Mobile and performance optimization parameters
      if (_elements) {
        searchParams._elements = _elements;
      } else if (_minimal === 'true') {
        // Minimal field set for fast loading
        searchParams._elements = 'id,meta,identifier,name,birthDate,gender,active';
      }
      
      if (_summary) searchParams._summary = _summary;
      
      // Include related resources selectively
      if (_include) {
        searchParams._include = _include;
      }

      // Execute search with caching
      const searchResults = await medplumService.searchResources<Patient>('Patient', searchParams);
      
      // Optimize response based on request type
      let optimizedResults = searchResults;
      if (_minimal === 'true' && searchResults.entry) {
        // For minimal requests, strip unnecessary data
        optimizedResults = {
          ...searchResults,
          entry: searchResults.entry.map(entry => ({
            ...entry,
            resource: entry.resource ? this.minimizePatientData(entry.resource) : entry.resource
          }))
        };
      }

      // Track performance metrics
      const responseTime = Date.now() - startTime;
      
      // Log successful search
      await auditService.logAccess({
        userId: req.user?.id || 'anonymous',
        action: 'SEARCH',
        resource: 'Patient',
        resourceId: 'multiple',
        metadata: {
          outcome: 'SUCCESS',
          ipAddress: req.ip || 'unknown',
          resultCount: optimizedResults.total || 0,
          filters: Object.keys(req.query).filter(k => !k.startsWith('_')),
          responseTime,
          cacheHit,
          minimal: _minimal === 'true'
        }
      });

      // Set performance headers
      res.setHeader('X-Response-Time', `${responseTime}ms`);
      res.setHeader('X-Cache-Status', cacheHit ? 'HIT' : 'MISS');
      res.setHeader('X-Result-Count', optimizedResults.total?.toString() || '0');
      
      res.json(optimizedResults);
    } catch (error) {
      logger.error('Failed to search patients:', error);
      
      await auditService.logAccess({
        userId: req.user?.id || 'anonymous',
        action: 'SEARCH',
        resource: 'Patient',
        resourceId: 'multiple',
        metadata: {
          outcome: 'FAILURE',
          ipAddress: req.ip || 'unknown',
          error: (error as Error).message
        }
      });

      res.status(500).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'exception',
          diagnostics: 'Failed to search patients'
        }]
      });
    }
  }

  /**
   * Minimize patient data for performance-optimized responses
   */
  private minimizePatientData(patient: Patient): Partial<Patient> {
    return {
      resourceType: patient.resourceType,
      id: patient.id,
      meta: patient.meta,
      identifier: patient.identifier,
      name: patient.name,
      birthDate: patient.birthDate,
      gender: patient.gender,
      active: patient.active,
      // Only include essential contact info
      telecom: patient.telecom?.slice(0, 2), // First 2 contact methods
      // Basic address info only
      address: patient.address?.map(addr => ({
        use: addr.use,
        type: addr.type,
        city: addr.city,
        state: addr.state,
        postalCode: addr.postalCode,
        country: addr.country
      })).slice(0, 1) // Only primary address
    };
  }

  /**
   * Get comprehensive patient profile including:
   * - Demographics
   * - Medical history (conditions)
   * - Current medications
   * - Allergies
   * - Recent encounters
   * - Vital signs
   * - Immunizations
   */
  async getPatientProfile(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      logger.info('Patient profile requested', {
        patientId: id,
        userId: req.user?.id,
        ip: req.ip
      });

      // Get all patient data using $everything operation
      const everythingBundle = await fhirResourcesService.getPatientEverything(id!);

      // Extract and organize resources from the bundle
      const patient = everythingBundle.entry?.find(
        entry => entry.resource?.resourceType === 'Patient'
      )?.resource as Patient;

      if (!patient) {
        res.status(404).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'not-found',
            diagnostics: 'Patient not found'
          }]
        });
        return;
      }

      const conditions = everythingBundle.entry
        ?.filter(entry => entry.resource?.resourceType === 'Condition')
        ?.map(entry => entry.resource as Condition) || [];

      const medications = everythingBundle.entry
        ?.filter(entry => entry.resource?.resourceType === 'MedicationRequest')
        ?.map(entry => entry.resource as MedicationRequest) || [];

      const allergies = everythingBundle.entry
        ?.filter(entry => entry.resource?.resourceType === 'AllergyIntolerance')
        ?.map(entry => entry.resource as AllergyIntolerance) || [];

      const encounters = everythingBundle.entry
        ?.filter(entry => entry.resource?.resourceType === 'Encounter')
        ?.map(entry => entry.resource as Encounter)
        ?.sort((a, b) => {
          const dateA = new Date(a.period?.start || 0).getTime();
          const dateB = new Date(b.period?.start || 0).getTime();
          return dateB - dateA; // Sort by most recent
        })
        ?.slice(0, 5) || []; // Last 5 encounters

      const vitals = everythingBundle.entry
        ?.filter(entry => 
          entry.resource?.resourceType === 'Observation' &&
          (entry.resource).category?.some(cat => 
            cat.coding?.some(code => code.code === 'vital-signs')
          )
        )
        ?.map(entry => entry.resource as Observation)
        ?.sort((a, b) => {
          const dateA = new Date(a.effectiveDateTime || 0).getTime();
          const dateB = new Date(b.effectiveDateTime || 0).getTime();
          return dateB - dateA;
        })
        ?.slice(0, 10) || []; // Last 10 vital sign sets

      const immunizations = everythingBundle.entry
        ?.filter(entry => entry.resource?.resourceType === 'Immunization')
        ?.map(entry => entry.resource as Immunization) || [];

      // Build comprehensive profile response
      const profile = {
        patient,
        conditions,
        medications,
        allergies,
        recentEncounters: encounters,
        vitals,
        immunizations
      };

      // Log successful profile retrieval
      await auditService.logAccess({
        userId: req.user?.id || 'anonymous',
        action: 'READ',
        resource: 'Patient',
        resourceId: id,
        metadata: {
          outcome: 'SUCCESS',
          ipAddress: req.ip || 'unknown',
          profileSections: Object.keys(profile)
        }
      });

      res.json(profile);
    } catch (error) {
      logger.error('Failed to get patient profile:', error);
      
      const isNotFound = (error as Error).message?.includes('not found');
      
      await auditService.logAccess({
        userId: req.user?.id || 'anonymous',
        action: 'READ',
        resource: 'Patient',
        resourceId: req.params.id,
        metadata: {
          outcome: 'FAILURE',
          ipAddress: req.ip || 'unknown',
          error: (error as Error).message
        }
      });

      if (isNotFound) {
        res.status(404).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'not-found',
            diagnostics: 'Patient not found'
          }]
        });
      } else {
        res.status(500).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'exception',
            diagnostics: 'Failed to retrieve patient profile'
          }]
        });
      }
    }
  }

  /**
   * Create a new patient
   */
  async createPatient(req: Request, res: Response): Promise<void> {
    try {
      const patient: Patient = req.body;

      logger.info('Creating new patient', {
        userId: req.user?.id,
        ip: req.ip
      });

      // Validate required fields
      if (!patient.name || patient.name.length === 0) {
        res.status(400).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'required',
            diagnostics: 'Patient name is required'
          }]
        });
        return;
      }

      // Ensure resource type is set
      const patientToCreate: Patient = {
        ...patient,
        resourceType: 'Patient'
      };

      // Create the patient
      const createdPatient = await medplumService.createResource(patientToCreate);

      // Log successful creation
      await auditService.logAccess({
        userId: req.user?.id || 'anonymous',
        action: 'CREATE',
        resource: 'Patient',
        resourceId: createdPatient.id || 'unknown',
        metadata: {
          outcome: 'SUCCESS',
          ipAddress: req.ip || 'unknown'
        }
      });

      res.status(201)
        .location(`/fhir/R4/Patient/${createdPatient.id}`)
        .json(createdPatient);
    } catch (error) {
      logger.error('Failed to create patient:', error);
      
      await auditService.logAccess({
        userId: req.user?.id || 'anonymous',
        action: 'CREATE',
        resource: 'Patient',
        resourceId: 'new',
        metadata: {
          outcome: 'FAILURE',
          ipAddress: req.ip || 'unknown',
          error: (error as Error).message
        }
      });

      res.status(500).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'exception',
          diagnostics: 'Failed to create patient'
        }]
      });
    }
  }

  /**
   * Update an existing patient
   */
  async updatePatient(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const patient: Patient = req.body;

      logger.info('Updating patient', {
        patientId: id,
        userId: req.user?.id,
        ip: req.ip
      });

      // Ensure the patient ID matches
      const patientToUpdate: Patient = {
        ...patient,
        id,
        resourceType: 'Patient'
      };

      // Update the patient
      const updatedPatient = await medplumService.updateResource(patientToUpdate);

      // Log successful update
      await auditService.logAccess({
        userId: req.user?.id || 'anonymous',
        action: 'UPDATE',
        resource: 'Patient',
        resourceId: id,
        metadata: {
          outcome: 'SUCCESS',
          ipAddress: req.ip || 'unknown'
        }
      });

      res.json(updatedPatient);
    } catch (error) {
      logger.error('Failed to update patient:', error);
      
      const isNotFound = (error as Error).message?.includes('not found');
      
      await auditService.logAccess({
        userId: req.user?.id || 'anonymous',
        action: 'UPDATE',
        resource: 'Patient',
        resourceId: req.params.id,
        metadata: {
          outcome: 'FAILURE',
          ipAddress: req.ip || 'unknown',
          error: (error as Error).message
        }
      });

      if (isNotFound) {
        res.status(404).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'not-found',
            diagnostics: 'Patient not found'
          }]
        });
      } else {
        res.status(500).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'exception',
            diagnostics: 'Failed to update patient'
          }]
        });
      }
    }
  }

  /**
   * Delete a patient
   */
  async deletePatient(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      logger.info('Deleting patient', {
        patientId: id,
        userId: req.user?.id,
        ip: req.ip
      });

      await medplumService.deleteResource('Patient', id!);

      // Log successful deletion
      await auditService.logAccess({
        userId: req.user?.id || 'anonymous',
        action: 'DELETE',
        resource: 'Patient',
        resourceId: id,
        metadata: {
          outcome: 'SUCCESS',
          ipAddress: req.ip || 'unknown'
        }
      });

      res.status(204).send();
    } catch (error) {
      logger.error('Failed to delete patient:', error);
      
      const isNotFound = (error as Error).message?.includes('not found');
      
      await auditService.logAccess({
        userId: req.user?.id || 'anonymous',
        action: 'DELETE',
        resource: 'Patient',
        resourceId: req.params.id,
        metadata: {
          outcome: 'FAILURE',
          ipAddress: req.ip || 'unknown',
          error: (error as Error).message
        }
      });

      if (isNotFound) {
        res.status(404).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'not-found',
            diagnostics: 'Patient not found'
          }]
        });
      } else {
        res.status(500).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'exception',
            diagnostics: 'Failed to delete patient'
          }]
        });
      }
    }
  }
}

// Export singleton instance
export const patientController = new PatientController();