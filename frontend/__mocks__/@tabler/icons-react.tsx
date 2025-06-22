import React from 'react';

// Mock icon component factory
const createIcon = (name: string) => {
  const MockIcon = React.forwardRef((props: any, ref: any) => (
    <span ref={ref} data-testid={`icon-${name.toLowerCase()}`} {...props}>
      {name}
    </span>
  ));
  MockIcon.displayName = name;
  return MockIcon;
};

// Export all icons used in the app
export const IconLogin = createIcon('IconLogin');
export const IconStethoscope = createIcon('IconStethoscope');
export const IconAlertCircle = createIcon('IconAlertCircle');
export const IconUser = createIcon('IconUser');
export const IconLock = createIcon('IconLock');
export const IconChevronRight = createIcon('IconChevronRight');
export const IconHome = createIcon('IconHome');
export const IconUsers = createIcon('IconUsers');
export const IconCalendar = createIcon('IconCalendar');
export const IconPill = createIcon('IconPill');
export const IconFileText = createIcon('IconFileText');
export const IconActivity = createIcon('IconActivity');
export const IconSettings = createIcon('IconSettings');
export const IconLogout = createIcon('IconLogout');
export const IconBell = createIcon('IconBell');
export const IconSearch = createIcon('IconSearch');
export const IconMail = createIcon('IconMail');
export const IconPhone = createIcon('IconPhone');
export const IconMapPin = createIcon('IconMapPin');
export const IconClock = createIcon('IconClock');
export const IconEdit = createIcon('IconEdit');
export const IconTrash = createIcon('IconTrash');
export const IconPlus = createIcon('IconPlus');
export const IconX = createIcon('IconX');
export const IconCheck = createIcon('IconCheck');
export const IconAlertTriangle = createIcon('IconAlertTriangle');
export const IconInfoCircle = createIcon('IconInfoCircle');
export const IconEye = createIcon('IconEye');
export const IconEyeOff = createIcon('IconEyeOff');
export const IconRefresh = createIcon('IconRefresh');
export const IconDownload = createIcon('IconDownload');
export const IconUpload = createIcon('IconUpload');
export const IconPrinter = createIcon('IconPrinter');
export const IconMedicalCross = createIcon('IconMedicalCross');
export const IconVaccine = createIcon('IconVaccine');
export const IconTestPipe = createIcon('IconTestPipe');
export const IconHeartbeat = createIcon('IconHeartbeat');
export const IconTemperature = createIcon('IconTemperature');
export const IconStethoscope2 = createIcon('IconStethoscope2');
export const IconMicroscope = createIcon('IconMicroscope');
export const IconReportMedical = createIcon('IconReportMedical');
export const IconNotes = createIcon('IconNotes');
export const IconDeviceFloppy = createIcon('IconDeviceFloppy');
export const IconTemplate = createIcon('IconTemplate');
export const IconCopy = createIcon('IconCopy');
export const IconShare = createIcon('IconShare');
export const IconHistory = createIcon('IconHistory');