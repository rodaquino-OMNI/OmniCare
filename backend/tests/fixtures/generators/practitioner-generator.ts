/**
 * OmniCare Test Data Generator - Practitioner Fixtures
 * Generates synthetic healthcare provider test data for testing
 */

import { faker } from '@faker-js/faker';
import { OmniCarePractitioner, PractitionerCredentials, BoardCertification, PractitionerSchedule } from '../../../src/models/practitioner.model';
import { HumanName, Address, ContactPoint, CodeableConcept, Identifier } from '../../../src/models/base.model';
import { HealthcareFaker } from './patient-generator';

export interface PractitionerGeneratorOptions {
  role?: 'physician' | 'nurse' | 'pa' | 'therapist' | 'technician' | 'admin';
  specialty?: 'cardiology' | 'oncology' | 'pediatrics' | 'general' | 'emergency' | 'surgery';
  experience?: 'junior' | 'mid' | 'senior';
  hasActiveCredentials?: boolean;
  gender?: 'male' | 'female' | 'other' | 'unknown';
}

export class PractitionerGenerator {
  private static readonly SPECIALTIES = {
    cardiology: {
      taxonomy: '207RC0000X',
      display: 'Cardiovascular Disease Physician',
      boardCode: 'ABIM-CV',
      boardName: 'American Board of Internal Medicine - Cardiovascular Disease'
    },
    oncology: {
      taxonomy: '207RH0000X',
      display: 'Hematology & Oncology Physician',
      boardCode: 'ABIM-HO',
      boardName: 'American Board of Internal Medicine - Hematology/Oncology'
    },
    pediatrics: {
      taxonomy: '208000000X',
      display: 'Pediatrics Physician',
      boardCode: 'ABP',
      boardName: 'American Board of Pediatrics'
    },
    general: {
      taxonomy: '208D00000X',
      display: 'General Practice Physician',
      boardCode: 'ABFM',
      boardName: 'American Board of Family Medicine'
    },
    emergency: {
      taxonomy: '207P00000X',
      display: 'Emergency Medicine Physician',
      boardCode: 'ABEM',
      boardName: 'American Board of Emergency Medicine'
    },
    surgery: {
      taxonomy: '208600000X',
      display: 'General Surgery Physician',
      boardCode: 'ABS',
      boardName: 'American Board of Surgery'
    }
  };

  private static readonly NURSING_ROLES = {
    'Registered Nurse': { code: '163W00000X', degree: 'RN' },
    'Nurse Practitioner': { code: '363L00000X', degree: 'NP' },
    'Licensed Practical Nurse': { code: '164W00000X', degree: 'LPN' },
    'Clinical Nurse Specialist': { code: '364S00000X', degree: 'CNS' }
  };

  private static readonly THERAPY_ROLES = {
    'Physical Therapist': { code: '225100000X', degree: 'PT' },
    'Occupational Therapist': { code: '225X00000X', degree: 'OT' },
    'Speech Language Pathologist': { code: '235Z00000X', degree: 'SLP' },
    'Respiratory Therapist': { code: '227800000X', degree: 'RT' }
  };

  static generatePractitioner(options: PractitionerGeneratorOptions = {}): OmniCarePractitioner {
    const {
      role = 'physician',
      specialty = 'general',
      experience = 'mid',
      hasActiveCredentials = true,
      gender
    } = options;

    const practitionerGender = gender || faker.helpers.arrayElement(['male', 'female']);
    const firstName = faker.person.firstName(practitionerGender as any);
    const lastName = faker.person.lastName();

    const practitioner: OmniCarePractitioner = {
      resourceType: 'Practitioner',
      id: `practitioner-${faker.string.uuid()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      active: true,
      identifier: this.generateIdentifiers(role),
      name: this.generateName(firstName, lastName, role),
      telecom: this.generateTelecom(),
      address: this.generateAddress(),
      gender: practitionerGender,
      birthDate: this.generateBirthDate(experience),
      qualification: this.generateQualifications(role, specialty),
      communication: [{
        language: {
          coding: [{
            system: 'urn:ietf:bcp:47',
            code: 'en',
            display: 'English'
          }]
        },
        preferred: true
      }],
      omnicarePractitionerId: `PR${faker.string.numeric(8)}`,
      employeeId: `EMP${faker.string.numeric(6)}`,
      hireDate: faker.date.past({ years: this.getExperienceYears(experience) }).toISOString().split('T')[0],
      departmentAffiliations: this.generateDepartmentAffiliations(role, specialty),
      credentials: hasActiveCredentials ? this.generateCredentials(role, specialty, experience) : undefined,
      schedule: this.generateSchedule(),
      preferences: this.generatePreferences(),
      performanceMetrics: this.generatePerformanceMetrics(experience),
      emergencyContact: this.generateEmergencyContact(),
      complianceInfo: this.generateComplianceInfo()
    };

    return practitioner;
  }

  private static generateIdentifiers(role: string): Identifier[] {
    const identifiers: Identifier[] = [
      {
        use: 'usual' as const,
        type: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
            code: 'PRN',
            display: 'Provider number'
          }]
        },
        system: 'http://omnicare.com/practitioner-id',
        value: `PR${faker.string.numeric(8)}`
      }
    ];

    if (role === 'physician' || role === 'nurse' || role === 'pa') {
      identifiers.push({
        use: 'official' as const,
        type: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
            code: 'NPI',
            display: 'National Provider Identifier'
          }]
        },
        system: 'http://hl7.org/fhir/sid/us-npi',
        value: HealthcareFaker.npi()
      });
    }

    return identifiers;
  }

  private static generateName(firstName: string, lastName: string, role: string): HumanName[] {
    const names: HumanName[] = [{
      use: 'official',
      given: [firstName],
      family: lastName
    }];

    // Add appropriate titles/prefixes
    if (role === 'physician') {
      names[0].prefix = ['Dr.'];
      names[0].suffix = ['MD'];
    } else if (role === 'nurse') {
      names[0].suffix = [faker.helpers.arrayElement(['RN', 'LPN', 'NP'])];
    } else if (role === 'pa') {
      names[0].suffix = ['PA-C'];
    } else if (role === 'therapist') {
      names[0].suffix = [faker.helpers.arrayElement(['PT', 'OT', 'SLP'])];
    }

    return names;
  }

  private static generateTelecom(): ContactPoint[] {
    return [
      {
        system: 'phone',
        value: faker.phone.number(),
        use: 'work',
        rank: 1
      },
      {
        system: 'email',
        value: faker.internet.email(),
        use: 'work',
        rank: 2
      },
      {
        system: 'pager',
        value: faker.phone.number(),
        use: 'work',
        rank: 3
      }
    ];
  }

  private static generateAddress(): Address[] {
    return [{
      use: 'work',
      type: 'both',
      line: [faker.location.streetAddress(), 'Medical Center'],
      city: faker.location.city(),
      state: faker.location.state({ abbreviated: true }),
      postalCode: faker.location.zipCode(),
      country: 'US'
    }];
  }

  private static generateBirthDate(experience: string): string {
    const baseAge = experience === 'junior' ? 28 : experience === 'senior' ? 45 : 35;
    const ageRange = 10;
    const age = faker.number.int({ min: baseAge, max: baseAge + ageRange });
    return faker.date.birthdate({ min: age, max: age, mode: 'age' }).toISOString().split('T')[0];
  }

  private static generateQualifications(role: string, specialty: string) {
    const qualifications = [];

    if (role === 'physician') {
      qualifications.push({
        code: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v2-0360',
            code: 'MD',
            display: 'Doctor of Medicine'
          }]
        },
        period: {
          start: faker.date.past({ years: 15 }).toISOString().split('T')[0]
        },
        issuer: {
          display: faker.helpers.arrayElement([
            'Harvard Medical School',
            'Johns Hopkins School of Medicine',
            'Mayo Clinic College of Medicine',
            'Stanford University School of Medicine'
          ])
        }
      });

      if (specialty !== 'general') {
        qualifications.push({
          code: {
            coding: [{
              system: 'http://nucc.org/provider-taxonomy',
              code: this.SPECIALTIES[specialty as keyof typeof this.SPECIALTIES].taxonomy,
              display: this.SPECIALTIES[specialty as keyof typeof this.SPECIALTIES].display
            }]
          },
          period: {
            start: faker.date.past({ years: 10 }).toISOString().split('T')[0]
          },
          issuer: {
            display: 'Specialty Board'
          }
        });
      }
    } else if (role === 'nurse') {
      const nursingRole = faker.helpers.arrayElement(Object.keys(this.NURSING_ROLES));
      const roleInfo = this.NURSING_ROLES[nursingRole as keyof typeof this.NURSING_ROLES];
      
      qualifications.push({
        code: {
          coding: [{
            system: 'http://nucc.org/provider-taxonomy',
            code: roleInfo.code,
            display: nursingRole
          }]
        },
        period: {
          start: faker.date.past({ years: 8 }).toISOString().split('T')[0]
        },
        issuer: {
          display: 'State Board of Nursing'
        }
      });
    }

    return qualifications;
  }

  private static generateCredentials(role: string, specialty: string, experience: string): PractitionerCredentials {
    const credentials: PractitionerCredentials = {
      licenseNumber: `${faker.location.state({ abbreviated: true })}${faker.string.numeric(9)}`,
      licenseState: faker.location.state({ abbreviated: true }),
      licenseExpiration: faker.date.future({ years: 2 }).toISOString().split('T')[0],
      licenseStatus: 'active'
    };

    if (role === 'physician') {
      credentials.npiNumber = HealthcareFaker.npi();
      credentials.deaNumber = `B${faker.string.alpha(1).toUpperCase()}${faker.string.numeric(7)}`;
      credentials.deaExpiration = faker.date.future({ years: 3 }).toISOString().split('T')[0];

      if (specialty !== 'general') {
        const specialtyInfo = this.SPECIALTIES[specialty as keyof typeof this.SPECIALTIES];
        credentials.boardCertifications = [{
          boardName: specialtyInfo.boardName,
          certificationDate: faker.date.past({ years: 5 }).toISOString().split('T')[0],
          expirationDate: faker.date.future({ years: 5 }).toISOString().split('T')[0],
          specialty: {
            coding: [{
              system: 'http://nucc.org/provider-taxonomy',
              code: specialtyInfo.taxonomy,
              display: specialtyInfo.display
            }]
          },
          status: 'active',
          maintenanceOfCertification: true
        }];
      }

      credentials.malpracticeInsurance = {
        provider: faker.helpers.arrayElement(['The Doctors Company', 'Medical Protective', 'ProAssurance']),
        policyNumber: `MP${faker.string.numeric(8)}`,
        effectiveDate: faker.date.past({ years: 1 }).toISOString().split('T')[0],
        expirationDate: faker.date.future({ years: 1 }).toISOString().split('T')[0],
        coverageAmount: {
          perClaim: 1000000,
          aggregate: 3000000
        },
        status: 'active'
      };
    }

    credentials.backgroundCheck = {
      performedDate: faker.date.past({ years: 1 }).toISOString().split('T')[0],
      performedBy: 'HireRight',
      status: 'cleared',
      expirationDate: faker.date.future({ years: 2 }).toISOString().split('T')[0]
    };

    return credentials;
  }

  private static generateDepartmentAffiliations(role: string, specialty: string) {
    const departments = {
      physician: ['Internal Medicine', 'Emergency Medicine', 'Surgery', 'Pediatrics'],
      nurse: ['Medical/Surgical', 'ICU', 'Emergency', 'Pediatrics'],
      pa: ['Emergency Medicine', 'Internal Medicine', 'Surgery'],
      therapist: ['Rehabilitation Services', 'Physical Therapy', 'Occupational Therapy'],
      technician: ['Laboratory', 'Radiology', 'Pharmacy'],
      admin: ['Administration', 'Health Information Management', 'Quality Assurance']
    };

    const deptList = departments[role as keyof typeof departments] || ['General'];
    const department = faker.helpers.arrayElement(deptList);

    return [{
      department: { reference: `Organization/dept-${department.toLowerCase().replace(/\s+/g, '-')}` },
      role: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/practitioner-role',
          code: role,
          display: role.charAt(0).toUpperCase() + role.slice(1)
        }]
      },
      specialty: specialty !== 'general' ? [{
        coding: [{
          system: 'http://nucc.org/provider-taxonomy',
          code: this.SPECIALTIES[specialty as keyof typeof this.SPECIALTIES]?.taxonomy || '',
          display: this.SPECIALTIES[specialty as keyof typeof this.SPECIALTIES]?.display || specialty
        }]
      }] : [],
      startDate: faker.date.past({ years: 5 }).toISOString().split('T')[0],
      isPrimary: true,
      responsibilities: this.generateResponsibilities(role)
    }];
  }

  private static generateResponsibilities(role: string): string[] {
    const responsibilities = {
      physician: ['Patient care', 'Medical decision making', 'Supervision of residents', 'Quality improvement'],
      nurse: ['Patient assessment', 'Medication administration', 'Patient education', 'Care coordination'],
      pa: ['Patient evaluation', 'Treatment planning', 'Procedures', 'Patient follow-up'],
      therapist: ['Patient assessment', 'Treatment planning', 'Therapy sessions', 'Progress monitoring'],
      technician: ['Equipment operation', 'Quality control', 'Safety protocols', 'Documentation'],
      admin: ['Administrative oversight', 'Policy development', 'Staff coordination', 'Compliance monitoring']
    };

    return responsibilities[role as keyof typeof responsibilities] || ['General duties'];
  }

  private static generateSchedule(): PractitionerSchedule {
    const workDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    
    return {
      defaultWorkingHours: workDays.map(day => ({
        dayOfWeek: day as any,
        startTime: '08:00',
        endTime: day === 'friday' ? '16:00' : '17:00'
      })),
      timeZone: 'America/Chicago',
      preferredSchedulingBuffer: 15,
      maxConsecutiveHours: 12,
      breakPreferences: [{
        type: 'lunch',
        preferredStartTime: '12:00',
        duration: 60,
        isFlexible: true
      }]
    };
  }

  private static generatePreferences() {
    return {
      communicationPreferences: {
        preferredContactMethod: faker.helpers.arrayElement(['phone', 'email', 'pager', 'secure-message']),
        emergencyContactMethod: faker.helpers.arrayElement(['phone', 'pager']),
        systemNotifications: true,
        appointmentReminders: true
      },
      workflowPreferences: {
        defaultAppointmentDuration: faker.number.int({ min: 15, max: 60 }),
        doubleBookingAllowed: faker.datatype.boolean(),
        patientMessagingEnabled: true
      }
    };
  }

  private static generatePerformanceMetrics(experience: string) {
    const baseScore = experience === 'senior' ? 4.5 : experience === 'junior' ? 3.8 : 4.2;
    
    return {
      patientSatisfactionScore: faker.number.float({ min: baseScore, max: 5.0, fractionDigits: 1 }),
      appointmentAdherence: faker.number.int({ min: 85, max: 98 }),
      averageAppointmentDuration: faker.number.int({ min: 20, max: 45 }),
      noShowRate: faker.number.int({ min: 5, max: 15 }),
      documentationCompletionRate: faker.number.int({ min: 90, max: 100 }),
      responseTimeToMessages: faker.number.int({ min: 2, max: 24 }),
      continuingEducationHours: faker.number.int({ min: 20, max: 60 })
    };
  }

  private static generateEmergencyContact() {
    return [{
      name: {
        given: [faker.person.firstName()],
        family: faker.person.lastName()
      },
      relationship: faker.helpers.arrayElement(['spouse', 'parent', 'sibling', 'friend']),
      contactInfo: [{
        system: 'phone' as const,
        value: faker.phone.number(),
        use: 'mobile' as const
      }],
      isPrimary: true
    }];
  }

  private static generateComplianceInfo() {
    return {
      mandatoryTraining: [
        {
          trainingName: 'HIPAA Privacy Training',
          completionDate: faker.date.past({ years: 1 }).toISOString().split('T')[0],
          expirationDate: faker.date.future({ years: 1 }).toISOString().split('T')[0],
          status: 'completed' as const
        },
        {
          trainingName: 'Fire Safety Training',
          completionDate: faker.date.past({ years: 1 }).toISOString().split('T')[0],
          expirationDate: faker.date.future({ years: 1 }).toISOString().split('T')[0],
          status: 'completed' as const
        }
      ],
      vaccinationRecords: [
        {
          vaccine: {
            coding: [{
              system: 'http://hl7.org/fhir/sid/cvx',
              code: '141',
              display: 'Influenza vaccine'
            }]
          },
          administrationDate: faker.date.past({ years: 1 }).toISOString().split('T')[0],
          status: 'current' as const
        }
      ]
    };
  }

  private static getExperienceYears(experience: string): number {
    switch (experience) {
      case 'junior': return 3;
      case 'senior': return 15;
      default: return 8;
    }
  }

  // Batch generation methods
  static generatePractitionerTeam(size: number = 5): OmniCarePractitioner[] {
    const team = [];
    
    // Add attending physician
    team.push(this.generatePractitioner({ 
      role: 'physician', 
      specialty: 'general', 
      experience: 'senior' 
    }));
    
    // Add nurses
    for (let i = 0; i < 2; i++) {
      team.push(this.generatePractitioner({ 
        role: 'nurse', 
        experience: faker.helpers.arrayElement(['mid', 'senior']) 
      }));
    }
    
    // Add other roles based on size
    if (size > 3) {
      team.push(this.generatePractitioner({ role: 'pa', experience: 'mid' }));
    }
    if (size > 4) {
      team.push(this.generatePractitioner({ role: 'technician', experience: 'mid' }));
    }
    
    return team;
  }

  static generateSpecialtyDepartment(specialty: string, size: number = 8): OmniCarePractitioner[] {
    return Array.from({ length: size }, () => 
      this.generatePractitioner({ 
        role: 'physician', 
        specialty: specialty as any, 
        experience: faker.helpers.arrayElement(['junior', 'mid', 'senior']) 
      })
    );
  }
}

// Convenience function for global test setup
export function createMockPractitioner(options: PractitionerGeneratorOptions = {}): OmniCarePractitioner {
  return PractitionerGenerator.generatePractitioner(options);
}