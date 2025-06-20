"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fhirTransformationService = exports.FHIRTransformationService = void 0;
const logger_1 = __importDefault(require("@/utils/logger"));
class FHIRTransformationService {
    transformToFHIRPatient(omnicarePatient) {
        try {
            const patient = {
                resourceType: 'Patient',
                id: omnicarePatient.id || undefined,
                meta: {
                    profile: ['http://omnicare.com/fhir/StructureDefinition/OmniCarePatient'],
                    lastUpdated: new Date().toISOString(),
                    versionId: '1',
                    source: 'OmniCare EMR System'
                },
                active: omnicarePatient.active !== false,
                name: this.transformNames(omnicarePatient.names || omnicarePatient.name || []),
                identifier: this.transformIdentifiers(omnicarePatient.identifiers || omnicarePatient.identifier || [], omnicarePatient.mrn),
                gender: this.transformGender(omnicarePatient.gender),
                birthDate: this.transformDate(omnicarePatient.birthDate || omnicarePatient.dateOfBirth),
                deceasedBoolean: omnicarePatient.deceased || false,
                deceasedDateTime: omnicarePatient.dateOfDeath ? this.transformDateTime(omnicarePatient.dateOfDeath) : undefined,
                telecom: this.transformTelecom(omnicarePatient.contacts || omnicarePatient.telecom || []),
                address: this.transformAddresses(omnicarePatient.addresses || omnicarePatient.address || []),
                maritalStatus: omnicarePatient.maritalStatus ? this.transformCodeableConcept(omnicarePatient.maritalStatus) : undefined,
                multipleBirthBoolean: omnicarePatient.multipleBirth || false,
                multipleBirthInteger: omnicarePatient.birthOrder || undefined,
                photo: omnicarePatient.photo ? [{ contentType: 'image/jpeg', data: omnicarePatient.photo }] : undefined,
                contact: this.transformEmergencyContacts(omnicarePatient.emergencyContacts || []),
                communication: this.transformCommunication(omnicarePatient.languages || []),
                generalPractitioner: this.transformPractitionerReferences(omnicarePatient.primaryCareProviders || []),
                managingOrganization: omnicarePatient.managingOrganization ? { reference: `Organization/${omnicarePatient.managingOrganization}` } : undefined,
                link: omnicarePatient.linkedPatients ? this.transformPatientLinks(omnicarePatient.linkedPatients) : undefined,
                extension: [
                    {
                        url: 'http://omnicare.com/fhir/StructureDefinition/registration-date',
                        valueDateTime: omnicarePatient.registrationDate || new Date().toISOString()
                    },
                    {
                        url: 'http://omnicare.com/fhir/StructureDefinition/preferred-language',
                        valueString: omnicarePatient.preferredLanguage || 'en'
                    },
                    {
                        url: 'http://omnicare.com/fhir/StructureDefinition/patient-portal-access',
                        valueBoolean: omnicarePatient.portalAccess || false
                    },
                    {
                        url: 'http://omnicare.com/fhir/StructureDefinition/insurance-verification-status',
                        valueString: omnicarePatient.insuranceStatus || 'pending'
                    }
                ].filter(ext => ext.valueDateTime || ext.valueString || ext.valueBoolean !== undefined),
                omnicarePatientId: omnicarePatient.omnicareId || omnicarePatient.id,
                registrationDate: omnicarePatient.registrationDate,
                preferredLanguage: omnicarePatient.preferredLanguage,
                emergencyContact: omnicarePatient.emergencyContact,
                insuranceInformation: omnicarePatient.insurance
            };
            logger_1.default.debug('Transformed OmniCare patient to FHIR', { patientId: patient.id });
            return patient;
        }
        catch (error) {
            logger_1.default.error('Failed to transform patient to FHIR:', error);
            throw new Error(`Patient transformation failed: ${error}`);
        }
    }
    transformFromFHIRPatient(fhirPatient) {
        try {
            const omnicarePatient = {
                id: fhirPatient.id,
                mrn: this.extractMRN(fhirPatient.identifier || []),
                active: fhirPatient.active !== false,
                firstName: fhirPatient.name?.[0]?.given?.[0] || '',
                middleName: fhirPatient.name?.[0]?.given?.[1] || '',
                lastName: fhirPatient.name?.[0]?.family || '',
                preferredName: fhirPatient.name?.find(n => n.use === 'nickname')?.given?.[0] || '',
                gender: fhirPatient.gender,
                dateOfBirth: fhirPatient.birthDate,
                deceased: fhirPatient.deceasedBoolean || false,
                dateOfDeath: fhirPatient.deceasedDateTime,
                phoneNumbers: this.extractPhoneNumbers(fhirPatient.telecom || []),
                emailAddresses: this.extractEmailAddresses(fhirPatient.telecom || []),
                addresses: this.extractAddresses(fhirPatient.address || []),
                maritalStatus: fhirPatient.maritalStatus?.coding?.[0]?.code,
                emergencyContacts: this.extractEmergencyContacts(fhirPatient.contact || []),
                languages: this.extractLanguages(fhirPatient.communication || []),
                omnicareId: this.extractExtensionValue(fhirPatient.extension, 'http://omnicare.com/fhir/StructureDefinition/omnicare-patient-id'),
                registrationDate: this.extractExtensionValue(fhirPatient.extension, 'http://omnicare.com/fhir/StructureDefinition/registration-date'),
                preferredLanguage: this.extractExtensionValue(fhirPatient.extension, 'http://omnicare.com/fhir/StructureDefinition/preferred-language'),
                portalAccess: this.extractExtensionValue(fhirPatient.extension, 'http://omnicare.com/fhir/StructureDefinition/patient-portal-access'),
                insuranceStatus: this.extractExtensionValue(fhirPatient.extension, 'http://omnicare.com/fhir/StructureDefinition/insurance-verification-status'),
                lastUpdated: fhirPatient.meta?.lastUpdated,
                version: fhirPatient.meta?.versionId
            };
            logger_1.default.debug('Transformed FHIR patient to OmniCare format', { patientId: omnicarePatient.id });
            return omnicarePatient;
        }
        catch (error) {
            logger_1.default.error('Failed to transform FHIR patient to OmniCare format:', error);
            throw new Error(`Patient transformation failed: ${error}`);
        }
    }
    transformToFHIREncounter(omnicareEncounter) {
        try {
            const encounter = {
                resourceType: 'Encounter',
                id: omnicareEncounter.id || undefined,
                meta: {
                    profile: ['http://omnicare.com/fhir/StructureDefinition/OmniCareEncounter'],
                    lastUpdated: new Date().toISOString(),
                    versionId: '1',
                    source: 'OmniCare EMR System'
                },
                identifier: this.transformIdentifiers(omnicareEncounter.identifiers || [], omnicareEncounter.encounterId),
                status: this.mapEncounterStatus(omnicareEncounter.status),
                class: this.transformEncounterClass(omnicareEncounter.type || omnicareEncounter.class),
                type: omnicareEncounter.encounterTypes ? omnicareEncounter.encounterTypes.map((type) => this.transformCodeableConcept(type)) : undefined,
                serviceType: omnicareEncounter.serviceType ? this.transformCodeableConcept(omnicareEncounter.serviceType) : undefined,
                priority: omnicareEncounter.priority ? this.transformCodeableConcept(omnicareEncounter.priority) : undefined,
                subject: { reference: `Patient/${omnicareEncounter.patientId}` },
                episodeOfCare: omnicareEncounter.episodeOfCare ? [{ reference: `EpisodeOfCare/${omnicareEncounter.episodeOfCare}` }] : undefined,
                basedOn: omnicareEncounter.referrals ? omnicareEncounter.referrals.map((ref) => ({ reference: `ServiceRequest/${ref}` })) : undefined,
                participant: this.transformEncounterParticipants(omnicareEncounter.participants || []),
                appointment: omnicareEncounter.appointmentId ? [{ reference: `Appointment/${omnicareEncounter.appointmentId}` }] : undefined,
                period: this.transformPeriod(omnicareEncounter.startTime, omnicareEncounter.endTime),
                length: omnicareEncounter.duration ? { value: omnicareEncounter.duration, unit: 'min', system: 'http://unitsofmeasure.org', code: 'min' } : undefined,
                reasonCode: omnicareEncounter.reasonCodes ? omnicareEncounter.reasonCodes.map((code) => this.transformCodeableConcept(code)) : undefined,
                reasonReference: omnicareEncounter.reasonReferences ? omnicareEncounter.reasonReferences.map((ref) => ({ reference: ref })) : undefined,
                diagnosis: this.transformEncounterDiagnoses(omnicareEncounter.diagnoses || []),
                account: omnicareEncounter.accountId ? [{ reference: `Account/${omnicareEncounter.accountId}` }] : undefined,
                hospitalization: this.transformHospitalization(omnicareEncounter.hospitalization),
                location: this.transformEncounterLocations(omnicareEncounter.locations || []),
                serviceProvider: omnicareEncounter.serviceProviderId ? { reference: `Organization/${omnicareEncounter.serviceProviderId}` } : undefined,
                partOf: omnicareEncounter.parentEncounterId ? { reference: `Encounter/${omnicareEncounter.parentEncounterId}` } : undefined,
                extension: [
                    {
                        url: 'http://omnicare.com/fhir/StructureDefinition/appointment-type',
                        valueString: omnicareEncounter.appointmentType || 'routine'
                    },
                    {
                        url: 'http://omnicare.com/fhir/StructureDefinition/chief-complaint',
                        valueString: omnicareEncounter.chiefComplaint || ''
                    },
                    {
                        url: 'http://omnicare.com/fhir/StructureDefinition/visit-summary',
                        valueString: omnicareEncounter.visitSummary || ''
                    },
                    {
                        url: 'http://omnicare.com/fhir/StructureDefinition/follow-up-instructions',
                        valueString: omnicareEncounter.followUpInstructions || ''
                    }
                ].filter(ext => ext.valueString),
                omnicareEncounterId: omnicareEncounter.omnicareId || omnicareEncounter.id,
                appointmentType: omnicareEncounter.appointmentType,
                chiefComplaint: omnicareEncounter.chiefComplaint,
                visitSummary: omnicareEncounter.visitSummary,
                followUpInstructions: omnicareEncounter.followUpInstructions,
                billingNotes: omnicareEncounter.billingNotes
            };
            logger_1.default.debug('Transformed OmniCare encounter to FHIR', { encounterId: encounter.id });
            return encounter;
        }
        catch (error) {
            logger_1.default.error('Failed to transform encounter to FHIR:', error);
            throw new Error(`Encounter transformation failed: ${error}`);
        }
    }
    transformToFHIRObservation(omnicareObservation) {
        try {
            const observation = {
                resourceType: 'Observation',
                id: omnicareObservation.id || undefined,
                meta: {
                    profile: ['http://omnicare.com/fhir/StructureDefinition/OmniCareObservation'],
                    lastUpdated: new Date().toISOString(),
                    versionId: '1',
                    source: 'OmniCare EMR System'
                },
                identifier: this.transformIdentifiers(omnicareObservation.identifiers || [], omnicareObservation.observationId),
                basedOn: omnicareObservation.orderIds ? omnicareObservation.orderIds.map((id) => ({ reference: `ServiceRequest/${id}` })) : undefined,
                partOf: omnicareObservation.partOfIds ? omnicareObservation.partOfIds.map((id) => ({ reference: `MedicationAdministration/${id}` })) : undefined,
                status: this.mapObservationStatus(omnicareObservation.status),
                category: this.transformObservationCategories(omnicareObservation.categories || []),
                code: this.transformCodeableConcept(omnicareObservation.code),
                subject: { reference: `Patient/${omnicareObservation.patientId}` },
                focus: omnicareObservation.focusIds ? omnicareObservation.focusIds.map((id) => ({ reference: id })) : undefined,
                encounter: omnicareObservation.encounterId ? { reference: `Encounter/${omnicareObservation.encounterId}` } : undefined,
                effectiveDateTime: this.transformDateTime(omnicareObservation.effectiveTime || omnicareObservation.observationTime),
                effectivePeriod: omnicareObservation.effectivePeriod ? this.transformPeriod(omnicareObservation.effectivePeriod.start, omnicareObservation.effectivePeriod.end) : undefined,
                issued: omnicareObservation.issuedTime ? this.transformDateTime(omnicareObservation.issuedTime) : undefined,
                performer: this.transformPerformerReferences(omnicareObservation.performers || []),
                valueQuantity: omnicareObservation.valueQuantity ? this.transformQuantity(omnicareObservation.valueQuantity) : undefined,
                valueCodeableConcept: omnicareObservation.valueCodeableConcept ? this.transformCodeableConcept(omnicareObservation.valueCodeableConcept) : undefined,
                valueString: omnicareObservation.valueString,
                valueBoolean: omnicareObservation.valueBoolean,
                valueInteger: omnicareObservation.valueInteger,
                valueRange: omnicareObservation.valueRange ? this.transformRange(omnicareObservation.valueRange) : undefined,
                valueRatio: omnicareObservation.valueRatio ? this.transformRatio(omnicareObservation.valueRatio) : undefined,
                valueSampledData: omnicareObservation.valueSampledData,
                valueTime: omnicareObservation.valueTime,
                valueDateTime: omnicareObservation.valueDateTime ? this.transformDateTime(omnicareObservation.valueDateTime) : undefined,
                valuePeriod: omnicareObservation.valuePeriod ? this.transformPeriod(omnicareObservation.valuePeriod.start, omnicareObservation.valuePeriod.end) : undefined,
                dataAbsentReason: omnicareObservation.dataAbsentReason ? this.transformCodeableConcept(omnicareObservation.dataAbsentReason) : undefined,
                interpretation: omnicareObservation.interpretation ? omnicareObservation.interpretation.map((interp) => this.transformCodeableConcept(interp)) : undefined,
                note: omnicareObservation.notes ? omnicareObservation.notes.map((note) => this.transformAnnotation(note)) : undefined,
                bodySite: omnicareObservation.bodySite ? this.transformCodeableConcept(omnicareObservation.bodySite) : undefined,
                method: omnicareObservation.method ? this.transformCodeableConcept(omnicareObservation.method) : undefined,
                specimen: omnicareObservation.specimenId ? { reference: `Specimen/${omnicareObservation.specimenId}` } : undefined,
                device: omnicareObservation.deviceId ? { reference: `Device/${omnicareObservation.deviceId}` } : undefined,
                referenceRange: this.transformReferenceRanges(omnicareObservation.referenceRanges || []),
                hasMember: omnicareObservation.memberIds ? omnicareObservation.memberIds.map((id) => ({ reference: `Observation/${id}` })) : undefined,
                derivedFrom: omnicareObservation.derivedFromIds ? omnicareObservation.derivedFromIds.map((id) => ({ reference: id })) : undefined,
                component: this.transformObservationComponents(omnicareObservation.components || []),
                extension: [
                    {
                        url: 'http://omnicare.com/fhir/StructureDefinition/device-used',
                        valueString: omnicareObservation.deviceUsed || ''
                    },
                    {
                        url: 'http://omnicare.com/fhir/StructureDefinition/quality-flags',
                        valueString: omnicareObservation.qualityFlags ? omnicareObservation.qualityFlags.join(',') : ''
                    },
                    {
                        url: 'http://omnicare.com/fhir/StructureDefinition/abnormal-flags',
                        valueString: omnicareObservation.abnormalFlags ? omnicareObservation.abnormalFlags.join(',') : ''
                    },
                    {
                        url: 'http://omnicare.com/fhir/StructureDefinition/critical-alerts',
                        valueBoolean: omnicareObservation.criticalAlerts || false
                    }
                ].filter(ext => ext.valueString || ext.valueBoolean !== undefined),
                omnicareObservationId: omnicareObservation.omnicareId || omnicareObservation.id,
                deviceUsed: omnicareObservation.deviceUsed,
                qualityFlags: omnicareObservation.qualityFlags,
                abnormalFlags: omnicareObservation.abnormalFlags,
                criticalAlerts: omnicareObservation.criticalAlerts
            };
            logger_1.default.debug('Transformed OmniCare observation to FHIR', { observationId: observation.id });
            return observation;
        }
        catch (error) {
            logger_1.default.error('Failed to transform observation to FHIR:', error);
            throw new Error(`Observation transformation failed: ${error}`);
        }
    }
    transformNames(names) {
        return names.map(name => ({
            use: name.use || 'official',
            family: name.family || name.lastName,
            given: [name.given, name.firstName, name.middleName].filter(Boolean).flat(),
            prefix: name.prefix ? [name.prefix] : undefined,
            suffix: name.suffix ? [name.suffix] : undefined,
            period: name.period ? this.transformPeriod(name.period.start, name.period.end) : undefined
        }));
    }
    transformIdentifiers(identifiers, mrn) {
        const transformed = identifiers.map(id => ({
            use: id.use || 'usual',
            type: id.type ? this.transformCodeableConcept(id.type) : undefined,
            system: id.system,
            value: id.value,
            period: id.period ? this.transformPeriod(id.period.start, id.period.end) : undefined,
            assigner: id.assigner ? { reference: id.assigner } : undefined
        }));
        if (mrn && !identifiers.find(id => id.type?.coding?.[0]?.code === 'MR')) {
            transformed.push({
                use: 'usual',
                type: {
                    coding: [{
                            system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                            code: 'MR',
                            display: 'Medical Record Number'
                        }]
                },
                system: 'http://omnicare.com/patient-id',
                value: mrn
            });
        }
        return transformed;
    }
    transformGender(gender) {
        if (!gender)
            return undefined;
        const normalized = gender.toLowerCase();
        if (['male', 'm'].includes(normalized))
            return 'male';
        if (['female', 'f'].includes(normalized))
            return 'female';
        if (['other', 'o'].includes(normalized))
            return 'other';
        return 'unknown';
    }
    transformDate(date) {
        if (!date)
            return undefined;
        if (date instanceof Date)
            return date.toISOString().split('T')[0];
        if (typeof date === 'string') {
            const parsed = new Date(date);
            return parsed.toISOString().split('T')[0];
        }
        return undefined;
    }
    transformDateTime(dateTime) {
        if (!dateTime)
            return undefined;
        if (dateTime instanceof Date)
            return dateTime.toISOString();
        if (typeof dateTime === 'string') {
            const parsed = new Date(dateTime);
            return parsed.toISOString();
        }
        return undefined;
    }
    transformTelecom(contacts) {
        return contacts.map(contact => ({
            system: this.mapContactSystem(contact.type || contact.system),
            value: contact.value || contact.number || contact.email,
            use: contact.use || 'home',
            rank: contact.rank || 1,
            period: contact.period ? this.transformPeriod(contact.period.start, contact.period.end) : undefined
        }));
    }
    transformAddresses(addresses) {
        return addresses.map(addr => ({
            use: addr.use || 'home',
            type: addr.type || 'both',
            text: addr.text,
            line: [addr.line1, addr.line2, addr.street, addr.streetAddress].filter(Boolean),
            city: addr.city,
            district: addr.district || addr.county,
            state: addr.state || addr.stateProvince,
            postalCode: addr.postalCode || addr.zipCode,
            country: addr.country,
            period: addr.period ? this.transformPeriod(addr.period.start, addr.period.end) : undefined
        }));
    }
    transformCodeableConcept(concept) {
        if (!concept)
            return { text: 'Unknown' };
        return {
            coding: concept.coding ? concept.coding.map((c) => ({
                system: c.system,
                version: c.version,
                code: c.code,
                display: c.display,
                userSelected: c.userSelected
            })) : concept.code ? [{
                    system: concept.system,
                    code: concept.code,
                    display: concept.display
                }] : undefined,
            text: concept.text || concept.display || concept.name
        };
    }
    transformQuantity(quantity) {
        return {
            value: quantity.value,
            comparator: quantity.comparator,
            unit: quantity.unit,
            system: quantity.system || 'http://unitsofmeasure.org',
            code: quantity.code || quantity.unit
        };
    }
    transformPeriod(start, end) {
        if (!start && !end)
            return undefined;
        return {
            start: start ? this.transformDateTime(start) : undefined,
            end: end ? this.transformDateTime(end) : undefined
        };
    }
    transformAnnotation(note) {
        return {
            authorReference: note.authorId ? { reference: `Practitioner/${note.authorId}` } : undefined,
            authorString: note.authorName,
            time: note.time ? this.transformDateTime(note.time) : undefined,
            text: note.text || note.content
        };
    }
    mapContactSystem(type) {
        const normalized = type?.toLowerCase();
        if (['phone', 'mobile', 'cell'].includes(normalized))
            return 'phone';
        if (['fax'].includes(normalized))
            return 'fax';
        if (['email'].includes(normalized))
            return 'email';
        if (['pager'].includes(normalized))
            return 'pager';
        if (['url', 'web', 'website'].includes(normalized))
            return 'url';
        if (['sms', 'text'].includes(normalized))
            return 'sms';
        return 'other';
    }
    mapEncounterStatus(status) {
        const normalized = status?.toLowerCase();
        if (['planned', 'scheduled'].includes(normalized))
            return 'planned';
        if (['arrived', 'checked-in'].includes(normalized))
            return 'arrived';
        if (['triaged'].includes(normalized))
            return 'triaged';
        if (['in-progress', 'active', 'ongoing'].includes(normalized))
            return 'in-progress';
        if (['onleave', 'on-leave'].includes(normalized))
            return 'onleave';
        if (['finished', 'completed', 'discharged'].includes(normalized))
            return 'finished';
        if (['cancelled', 'canceled'].includes(normalized))
            return 'cancelled';
        if (['entered-in-error', 'error'].includes(normalized))
            return 'entered-in-error';
        return 'unknown';
    }
    mapObservationStatus(status) {
        const normalized = status?.toLowerCase();
        if (['registered'].includes(normalized))
            return 'registered';
        if (['preliminary', 'pending'].includes(normalized))
            return 'preliminary';
        if (['final', 'completed'].includes(normalized))
            return 'final';
        if (['amended'].includes(normalized))
            return 'amended';
        if (['corrected'].includes(normalized))
            return 'corrected';
        if (['cancelled', 'canceled'].includes(normalized))
            return 'cancelled';
        if (['entered-in-error', 'error'].includes(normalized))
            return 'entered-in-error';
        return 'unknown';
    }
    extractMRN(identifiers) {
        const mrn = identifiers.find(id => id.type?.coding?.[0]?.code === 'MR');
        return mrn?.value || '';
    }
    extractPhoneNumbers(telecom) {
        return telecom.filter(t => t.system === 'phone').map(t => t.value || '');
    }
    extractEmailAddresses(telecom) {
        return telecom.filter(t => t.system === 'email').map(t => t.value || '');
    }
    extractAddresses(addresses) {
        return addresses.map(addr => ({
            line1: addr.line?.[0] || '',
            line2: addr.line?.[1] || '',
            city: addr.city || '',
            state: addr.state || '',
            postalCode: addr.postalCode || '',
            country: addr.country || '',
            use: addr.use || 'home'
        }));
    }
    extractEmergencyContacts(contacts) {
        return (contacts || []).map(contact => ({
            name: contact.name ? `${contact.name.given?.join(' ')} ${contact.name.family}`.trim() : '',
            relationship: contact.relationship?.[0]?.coding?.[0]?.display || '',
            phone: contact.telecom?.find(t => t.system === 'phone')?.value || '',
            email: contact.telecom?.find(t => t.system === 'email')?.value || ''
        }));
    }
    extractLanguages(communication) {
        return (communication || []).map(comm => comm.language?.coding?.[0]?.code || '');
    }
    extractExtensionValue(extensions, url) {
        const extension = extensions?.find(ext => ext.url === url);
        return extension?.valueString || extension?.valueBoolean || extension?.valueDateTime || extension?.valueInteger || extension?.valueDecimal;
    }
    transformEmergencyContacts(contacts) {
        return contacts.map(contact => ({
            relationship: [{
                    coding: [{
                            system: 'http://terminology.hl7.org/CodeSystem/v2-0131',
                            code: contact.relationshipCode || 'C',
                            display: contact.relationship || 'Emergency Contact'
                        }]
                }],
            name: {
                family: contact.lastName || contact.name?.split(' ').pop(),
                given: contact.firstName ? [contact.firstName] : contact.name?.split(' ').slice(0, -1) || []
            },
            telecom: [
                contact.phone ? { system: 'phone', value: contact.phone, use: 'home' } : null,
                contact.email ? { system: 'email', value: contact.email, use: 'home' } : null
            ].filter(Boolean)
        }));
    }
    transformCommunication(languages) {
        return languages.map(lang => ({
            language: {
                coding: [{
                        system: 'urn:ietf:bcp:47',
                        code: lang.code || lang,
                        display: lang.display || lang.name
                    }]
            },
            preferred: lang.preferred || false
        }));
    }
    transformPractitionerReferences(providers) {
        return providers.map(provider => ({
            reference: typeof provider === 'string' ? `Practitioner/${provider}` : `Practitioner/${provider.id}`,
            display: provider.name || provider.display
        }));
    }
    transformPatientLinks(linkedPatients) {
        return linkedPatients.map(link => ({
            other: { reference: `Patient/${link.patientId || link.id}` },
            type: link.type || 'seealso'
        }));
    }
    transformEncounterClass(encounterClass) {
        if (!encounterClass) {
            return {
                system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
                code: 'AMB',
                display: 'Ambulatory'
            };
        }
        return {
            system: encounterClass.system || 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
            code: encounterClass.code || 'AMB',
            display: encounterClass.display || 'Ambulatory'
        };
    }
    transformEncounterParticipants(participants) {
        return participants.map(participant => ({
            type: participant.types ? participant.types.map((type) => this.transformCodeableConcept(type)) : undefined,
            period: participant.period ? this.transformPeriod(participant.period.start, participant.period.end) : undefined,
            individual: participant.practitionerId ? { reference: `Practitioner/${participant.practitionerId}` } : undefined
        }));
    }
    transformEncounterDiagnoses(diagnoses) {
        return diagnoses.map(diag => ({
            condition: { reference: `Condition/${diag.conditionId || diag.id}` },
            use: diag.use ? this.transformCodeableConcept(diag.use) : undefined,
            rank: diag.rank || 1
        }));
    }
    transformHospitalization(hospitalization) {
        if (!hospitalization)
            return undefined;
        return {
            preAdmissionIdentifier: hospitalization.preAdmissionId ? { value: hospitalization.preAdmissionId } : undefined,
            origin: hospitalization.originLocationId ? { reference: `Location/${hospitalization.originLocationId}` } : undefined,
            admitSource: hospitalization.admitSource ? this.transformCodeableConcept(hospitalization.admitSource) : undefined,
            reAdmission: hospitalization.reAdmission ? this.transformCodeableConcept(hospitalization.reAdmission) : undefined,
            dietPreference: hospitalization.dietPreferences ? hospitalization.dietPreferences.map((diet) => this.transformCodeableConcept(diet)) : undefined,
            specialCourtesy: hospitalization.specialCourtesies ? hospitalization.specialCourtesies.map((courtesy) => this.transformCodeableConcept(courtesy)) : undefined,
            specialArrangement: hospitalization.specialArrangements ? hospitalization.specialArrangements.map((arrangement) => this.transformCodeableConcept(arrangement)) : undefined,
            destination: hospitalization.destinationLocationId ? { reference: `Location/${hospitalization.destinationLocationId}` } : undefined,
            dischargeDisposition: hospitalization.dischargeDisposition ? this.transformCodeableConcept(hospitalization.dischargeDisposition) : undefined
        };
    }
    transformEncounterLocations(locations) {
        return locations.map(loc => ({
            location: { reference: `Location/${loc.locationId || loc.id}` },
            status: loc.status || 'active',
            physicalType: loc.physicalType ? this.transformCodeableConcept(loc.physicalType) : undefined,
            period: loc.period ? this.transformPeriod(loc.period.start, loc.period.end) : undefined
        }));
    }
    transformObservationCategories(categories) {
        return categories.map(category => this.transformCodeableConcept(category));
    }
    transformPerformerReferences(performers) {
        return performers.map(performer => ({
            reference: `${performer.resourceType || 'Practitioner'}/${performer.id}`,
            display: performer.name || performer.display
        }));
    }
    transformRange(range) {
        return {
            low: range.low ? this.transformQuantity(range.low) : undefined,
            high: range.high ? this.transformQuantity(range.high) : undefined
        };
    }
    transformRatio(ratio) {
        return {
            numerator: ratio.numerator ? this.transformQuantity(ratio.numerator) : undefined,
            denominator: ratio.denominator ? this.transformQuantity(ratio.denominator) : undefined
        };
    }
    transformReferenceRanges(ranges) {
        return ranges.map(range => ({
            low: range.low ? this.transformQuantity(range.low) : undefined,
            high: range.high ? this.transformQuantity(range.high) : undefined,
            type: range.type ? this.transformCodeableConcept(range.type) : undefined,
            appliesTo: range.appliesTo ? range.appliesTo.map((applies) => this.transformCodeableConcept(applies)) : undefined,
            age: range.age ? this.transformRange(range.age) : undefined,
            text: range.text
        }));
    }
    transformObservationComponents(components) {
        return components.map(comp => ({
            code: this.transformCodeableConcept(comp.code),
            valueQuantity: comp.valueQuantity ? this.transformQuantity(comp.valueQuantity) : undefined,
            valueCodeableConcept: comp.valueCodeableConcept ? this.transformCodeableConcept(comp.valueCodeableConcept) : undefined,
            valueString: comp.valueString,
            valueBoolean: comp.valueBoolean,
            valueInteger: comp.valueInteger,
            valueRange: comp.valueRange ? this.transformRange(comp.valueRange) : undefined,
            valueRatio: comp.valueRatio ? this.transformRatio(comp.valueRatio) : undefined,
            valueSampledData: comp.valueSampledData,
            valueTime: comp.valueTime,
            valueDateTime: comp.valueDateTime ? this.transformDateTime(comp.valueDateTime) : undefined,
            valuePeriod: comp.valuePeriod ? this.transformPeriod(comp.valuePeriod.start, comp.valuePeriod.end) : undefined,
            dataAbsentReason: comp.dataAbsentReason ? this.transformCodeableConcept(comp.dataAbsentReason) : undefined,
            interpretation: comp.interpretation ? comp.interpretation.map((interp) => this.transformCodeableConcept(interp)) : undefined,
            referenceRange: comp.referenceRanges ? this.transformReferenceRanges(comp.referenceRanges) : undefined
        }));
    }
    async validateTransformation(original, transformed, resourceType) {
        const errors = [];
        try {
            if (!transformed.resourceType) {
                errors.push('Missing resourceType');
            }
            if (transformed.resourceType !== resourceType) {
                errors.push(`Resource type mismatch: expected ${resourceType}, got ${transformed.resourceType}`);
            }
            switch (resourceType) {
                case 'Patient':
                    if (!transformed.name || transformed.name.length === 0) {
                        errors.push('Patient must have at least one name');
                    }
                    break;
                case 'Encounter':
                    if (!transformed.subject) {
                        errors.push('Encounter must have a subject reference');
                    }
                    if (!transformed.status) {
                        errors.push('Encounter must have a status');
                    }
                    break;
                case 'Observation':
                    if (!transformed.code) {
                        errors.push('Observation must have a code');
                    }
                    if (!transformed.subject) {
                        errors.push('Observation must have a subject reference');
                    }
                    if (!transformed.status) {
                        errors.push('Observation must have a status');
                    }
                    break;
            }
            const valid = errors.length === 0;
            if (valid) {
                logger_1.default.debug(`Transformation validation passed for ${resourceType}`, { originalId: original.id });
            }
            else {
                logger_1.default.warn(`Transformation validation failed for ${resourceType}`, { errors, originalId: original.id });
            }
            return { valid, errors };
        }
        catch (error) {
            logger_1.default.error('Transformation validation error:', error);
            return { valid: false, errors: [`Validation error: ${error}`] };
        }
    }
    async transformBundle(omnicareBundle, bundleType = 'collection') {
        try {
            const bundle = {
                resourceType: 'Bundle',
                id: omnicareBundle.id || `bundle-${Date.now()}`,
                meta: {
                    lastUpdated: new Date().toISOString(),
                    source: 'OmniCare EMR System'
                },
                type: bundleType,
                timestamp: new Date().toISOString(),
                total: omnicareBundle.resources?.length || 0,
                entry: []
            };
            if (omnicareBundle.resources && Array.isArray(omnicareBundle.resources)) {
                for (const resource of omnicareBundle.resources) {
                    try {
                        let transformed;
                        switch (resource.resourceType || resource.type) {
                            case 'Patient':
                                transformed = this.transformToFHIRPatient(resource);
                                break;
                            case 'Encounter':
                                transformed = this.transformToFHIREncounter(resource);
                                break;
                            case 'Observation':
                                transformed = this.transformToFHIRObservation(resource);
                                break;
                            default:
                                logger_1.default.warn('Unsupported resource type in bundle transformation', { type: resource.resourceType || resource.type });
                                continue;
                        }
                        bundle.entry.push({
                            resource: transformed,
                            request: bundleType === 'transaction' || bundleType === 'batch' ? {
                                method: resource.id ? 'PUT' : 'POST',
                                url: resource.id ? `${transformed.resourceType}/${resource.id}` : transformed.resourceType
                            } : undefined
                        });
                    }
                    catch (error) {
                        logger_1.default.error('Failed to transform resource in bundle:', { error, resource: resource.id });
                    }
                }
            }
            logger_1.default.info('Bundle transformation completed', {
                bundleId: bundle.id,
                totalResources: bundle.total,
                transformedResources: bundle.entry?.length || 0
            });
            return bundle;
        }
        catch (error) {
            logger_1.default.error('Bundle transformation failed:', error);
            throw new Error(`Bundle transformation failed: ${error}`);
        }
    }
}
exports.FHIRTransformationService = FHIRTransformationService;
exports.fhirTransformationService = new FHIRTransformationService();
//# sourceMappingURL=fhir-transformation.service.js.map