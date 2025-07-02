"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRoles = exports.ROLE_HIERARCHY = exports.ROLE_DISPLAY_NAMES = exports.ROLE_MAPPINGS = void 0;
exports.toCanonicalRole = toCanonicalRole;
exports.toShortRole = toShortRole;
exports.isCanonicalRole = isCanonicalRole;
exports.isShortRole = isShortRole;
exports.isValidRole = isValidRole;
exports.getRoleDisplayName = getRoleDisplayName;
exports.hasHigherRole = hasHigherRole;
exports.ROLE_MAPPINGS = {
    'SUPER_ADMIN': 'SUPER_ADMINISTRATOR',
    'ADMIN': 'ADMINISTRATOR',
    'PHYSICIAN': 'PHYSICIAN',
    'NURSE': 'REGISTERED_NURSE',
    'PATIENT': 'PATIENT',
    'COMPLIANCE_OFFICER': 'COMPLIANCE_OFFICER',
    'MEDICAL_ASSISTANT': 'MEDICAL_ASSISTANT',
    'LAB_TECHNICIAN': 'LABORATORY_TECHNICIAN'
};
exports.ROLE_DISPLAY_NAMES = {
    'SUPER_ADMIN': 'Super Administrator',
    'SUPER_ADMINISTRATOR': 'Super Administrator',
    'ADMIN': 'Administrator',
    'ADMINISTRATOR': 'Administrator',
    'PHYSICIAN': 'Physician',
    'NURSE': 'Nurse',
    'REGISTERED_NURSE': 'Registered Nurse',
    'PATIENT': 'Patient',
    'COMPLIANCE_OFFICER': 'Compliance Officer',
    'MEDICAL_ASSISTANT': 'Medical Assistant',
    'LAB_TECHNICIAN': 'Lab Technician',
    'LABORATORY_TECHNICIAN': 'Laboratory Technician'
};
exports.ROLE_HIERARCHY = {
    'PATIENT': 1,
    'LAB_TECHNICIAN': 2,
    'LABORATORY_TECHNICIAN': 2,
    'MEDICAL_ASSISTANT': 3,
    'NURSE': 4,
    'REGISTERED_NURSE': 4,
    'PHYSICIAN': 5,
    'COMPLIANCE_OFFICER': 6,
    'ADMIN': 7,
    'ADMINISTRATOR': 7,
    'SUPER_ADMIN': 8,
    'SUPER_ADMINISTRATOR': 8
};
function toCanonicalRole(role) {
    if (role in exports.ROLE_MAPPINGS) {
        return exports.ROLE_MAPPINGS[role];
    }
    return role;
}
function toShortRole(role) {
    const reverseMapping = Object.entries(exports.ROLE_MAPPINGS).find(([_, long]) => long === role);
    return reverseMapping ? reverseMapping[0] : role;
}
function isCanonicalRole(role) {
    return Object.values(exports.ROLE_MAPPINGS).includes(role);
}
function isShortRole(role) {
    return Object.keys(exports.ROLE_MAPPINGS).includes(role);
}
function isValidRole(role) {
    return isCanonicalRole(role) || isShortRole(role);
}
function getRoleDisplayName(role) {
    return exports.ROLE_DISPLAY_NAMES[role] || role;
}
function hasHigherRole(role1, role2) {
    return exports.ROLE_HIERARCHY[role1] > exports.ROLE_HIERARCHY[role2];
}
exports.UserRoles = {
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN: 'ADMIN',
    PHYSICIAN: 'PHYSICIAN',
    NURSE: 'NURSE',
    PATIENT: 'PATIENT',
    COMPLIANCE_OFFICER: 'COMPLIANCE_OFFICER',
    MEDICAL_ASSISTANT: 'MEDICAL_ASSISTANT',
    LAB_TECHNICIAN: 'LAB_TECHNICIAN',
    SUPER_ADMINISTRATOR: 'SUPER_ADMINISTRATOR',
    ADMINISTRATOR: 'ADMINISTRATOR',
    REGISTERED_NURSE: 'REGISTERED_NURSE',
    LABORATORY_TECHNICIAN: 'LABORATORY_TECHNICIAN'
};
//# sourceMappingURL=user-roles.types.js.map