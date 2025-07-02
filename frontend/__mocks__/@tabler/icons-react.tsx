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
export const IconChevronDown = createIcon('IconChevronDown');
export const IconChevronUp = createIcon('IconChevronUp');
export const IconFilter = createIcon('IconFilter');
export const IconFilterOff = createIcon('IconFilterOff');
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
export const IconHeart = createIcon('IconHeart');
export const IconShield = createIcon('IconShield');
export const IconTrendingUp = createIcon('IconTrendingUp');
export const IconTrendingDown = createIcon('IconTrendingDown');
export const IconDroplet = createIcon('IconDroplet');
export const IconLungs = createIcon('IconLungs');
export const IconScale = createIcon('IconScale');
export const IconExternalLink = createIcon('IconExternalLink');
export const IconCloudOff = createIcon('IconCloudOff');
export const IconCloudCheck = createIcon('IconCloudCheck');
export const IconBrain = createIcon('IconBrain');
export const IconKeyboard = createIcon('IconKeyboard');
export const IconWifi = createIcon('IconWifi');
export const IconWifiOff = createIcon('IconWifiOff');
export const IconList = createIcon('IconList');
export const IconLayoutGrid = createIcon('IconLayoutGrid');
export const IconCloud = createIcon('IconCloud');
export const IconExclamationCircle = createIcon('IconExclamationCircle');
export const IconChartLine = createIcon('IconChartLine');
export const IconPhoto = createIcon('IconPhoto');
export const IconPlayerPlay = createIcon('IconPlayerPlay');
export const IconUserPlus = createIcon('IconUserPlus');
export const IconMessage = createIcon('IconMessage');