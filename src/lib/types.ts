export type StageType = 'meeting' | 'form' | 'task' | 'general';
export type StageProgressStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'blocked'
  | 'skipped';

export interface StageTemplate {
  id: string;
  name: string;
  description: string | null;
  orderIndex: number;
  stageType: StageType;
  durationDays: number | null;
  minDurationDays: number | null;
  maxDurationDays: number | null;
  formDeadlineDays: number | null;
  formUrl: string | null;
}

export interface ProcessTemplate {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  stages: StageTemplate[];
}

export type FollowUpType =
  | 'call'
  | 'meeting'
  | 'email'
  | 'visit'
  | 'note'
  | 'other';

export interface FollowUp {
  id: string;
  clientId: string;
  clientProcessId: string | null;
  title: string;
  description: string | null;
  followUpType: FollowUpType;
  occurredAt: string;
  nextActionAt: string | null;
  clientProcess?: ClientProcess | null;
}

export interface ClientFieldChange {
  field: string;
  label: string;
  oldValue: string | null;
  newValue: string | null;
}

export interface ClientUpdateLog {
  id: string;
  clientId: string;
  updatedByUserId: string | null;
  updatedByName: string | null;
  changes: ClientFieldChange[];
  createdAt: string;
}

export interface ClientFollowUpSummary {
  lastFollowUpAt: string | null;
  daysSinceLastFollowUp: number | null;
  nextActionAt: string | null;
  nextActionOverdue: boolean;
  totalFollowUps: number;
}

export interface FollowUpAlert {
  clientId: string;
  clientName: string;
  company: string | null;
  daysSinceLastFollowUp: number | null;
  lastFollowUpAt: string | null;
  nextActionAt: string | null;
  nextActionOverdue: boolean;
  totalFollowUps: number;
}

export type ClientUpdatePayload = Partial<{
  name: string;
  contactName: string;
  email: string;
  phone: string;
  company: string;
  notes: string;
  nextContactAt: string | null;
  nextContactTitle: string | null;
}>;

export interface Client {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  notes: string | null;
  nextContactAt?: string | null;
  nextContactTitle?: string | null;
  updatedAt?: string;
  processes?: ClientProcess[];
  followUps?: FollowUp[];
  updateLogs?: ClientUpdateLog[];
  followUpSummary?: ClientFollowUpSummary;
}

export interface Meeting {
  id: string;
  title: string;
  scheduledAt: string;
  durationMinutes: number;
  location: string | null;
  notes: string | null;
  status: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: string;
}

export interface StageProgress {
  id: string;
  status: StageProgressStatus;
  startedAt: string | null;
  dueDate: string | null;
  completedAt: string | null;
  notes: string | null;
  stageTemplate: StageTemplate;
  meetings?: Meeting[];
  tasks?: Task[];
}

export interface ClientProcess {
  id: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  client?: Client;
  processTemplate: ProcessTemplate;
  stageProgresses: StageProgress[];
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt?: string;
}

export type CalendarItemKind =
  | 'meeting'
  | 'client_delivery'
  | 'internal_delivery'
  | 'next_contact';

export interface CalendarMonthItem {
  id: string;
  kind: CalendarItemKind;
  title: string;
  at: string;
  status: string;
  clientId: string;
  clientName: string;
  processId: string | null;
  stageProgressId?: string | null;
  description?: string | null;
  processKind?: 'onboarding' | 'seguimiento';
  meetingSource?: 'stage' | 'followup';
  notes?: string | null;
  completionNotes?: string | null;
  /** Fecha original del compromiso si se muestra al inicio del mes por vencido */
  scheduledAt?: string | null;
  /** Próximo contacto del conjunto vs. compromiso en un seguimiento (legacy nextActionAt). */
  nextContactSource?: 'client' | 'followup';
}

export interface CalendarPickerOption {
  processId: string;
  clientId: string;
  clientName: string;
  templateName: string;
  processKind: 'onboarding' | 'seguimiento';
  currentStageProgressId: string | null;
  currentStageName: string | null;
}

export interface CalendarClientOption {
  id: string;
  name: string;
  processes: { id: string; name: string }[];
}

export interface CalendarBootstrap {
  items: CalendarMonthItem[];
  pickerOptions: CalendarPickerOption[];
  clients: CalendarClientOption[];
}

export interface HomeBootstrap {
  dashboard: Dashboard;
  calendar: CalendarBootstrap;
}

/** @deprecated use CalendarMonthItem */
export interface CalendarMeeting {
  id: string;
  title: string;
  scheduledAt: string;
  durationMinutes: number;
  status: string;
  clientName: string;
  processId: string | null;
}

export interface Dashboard {
  stats: {
    totalClients: number;
    activeProcesses: number;
    completedProcesses: number;
    overdueStages: number;
    needsFollowUp: number;
  };
  followUpAlerts: FollowUpAlert[];
  activeProcesses: Array<{
    id: string;
    clientId: string;
    clientName: string;
    company: string | null;
    templateName: string;
    currentStage: string;
    dueDate: string | null;
    status: string;
  }>;
  processesByStage: Array<{
    stageName: string;
    stageOrder: number;
    templateName: string;
    count: number;
    items: Array<{
      processId: string;
      clientId: string;
      clientName: string;
      company: string | null;
      dueDate: string | null;
      overdue: boolean;
    }>;
  }>;
  overdue: Array<{
    clientName: string;
    processId: string;
    stageName: string;
    dueDate: string;
  }>;
  upcomingMeetings: Array<{
    id: string;
    title: string;
    scheduledAt: string;
    clientName: string;
  }>;
}

export interface ConjuntoPickerItem {
  id: string;
  name: string;
  company: string | null;
}

export interface ConjuntoReportClient {
  id: string;
  name: string;
  company: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
}

export interface ConjuntoReportFollowUp {
  id: string;
  title: string;
  description: string | null;
  followUpType: FollowUpType;
  occurredAt: string;
  nextActionAt: string | null;
  stageName: string | null;
}

export interface ConjuntoReportStage {
  id: string;
  orderIndex: number;
  name: string;
  stageType: StageType;
  status: StageProgressStatus;
  startedAt: string | null;
  dueDate: string | null;
  completedAt: string | null;
  overdue: boolean;
  durationLabel: string;
  isCurrent: boolean;
}

export interface ConjuntoReportProcess {
  id: string;
  templateName: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  currentStageName: string | null;
  stages: ConjuntoReportStage[];
}

export interface ConjuntoReportMeeting {
  id: string;
  title: string;
  scheduledAt: string;
  status: string;
  stageName: string | null;
  source: 'stage' | 'followup';
  activityType?: 'meeting' | 'call' | 'visit' | 'other';
  notes?: string | null;
}

export interface ConjuntoReportDelivery {
  id: string;
  title: string;
  dueAt: string;
  status: string;
  eventType: 'client_delivery' | 'internal_delivery';
  description: string | null;
  overdue: boolean;
}

export interface ConjuntoReportNextContact {
  followUpId: string;
  title: string;
  at: string;
  overdue: boolean;
}

export interface ConjuntoReport {
  client: ConjuntoReportClient;
  followUpSummary: ClientFollowUpSummary;
  lastFollowUp: ConjuntoReportFollowUp | null;
  recentFollowUps: ConjuntoReportFollowUp[];
  pendingNextContacts: ConjuntoReportNextContact[];
  process: ConjuntoReportProcess | null;
  plannedMeetings: ConjuntoReportMeeting[];
  deliveries: ConjuntoReportDelivery[];
}
