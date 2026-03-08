import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useImpersonation } from '@/providers/impersonation-provider';
import type { EmploymentType } from './use-admin-users';

// ── Types ──────────────────────────────────────────────────────────────────

export type LeaveVisibility = 'all' | 'contractor' | 'employee';

export interface LeaveType {
  id: string;
  name: string;
  daysPerYear: number;
  color: string | null;
  deducted: boolean;
  groupId: string | null;
  active: boolean;
  visibility: LeaveVisibility;
  isContractorDefault: boolean;
  groupName: string | null;
  groupColor: string | null;
}

export interface LeaveTypeGroup {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  createdAt: string;
  typeCount: number;
  activeTypeCount: number;
}

/** Admin view of a leave type — includes all fields, no filtering */
export interface AdminLeaveType {
  id: string;
  name: string;
  daysPerYear: number;
  color: string | null;
  deducted: boolean;
  groupId: string | null;
  active: boolean;
  visibility: LeaveVisibility;
  isContractorDefault: boolean;
}

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'autoconfirmed';

export interface LeaveBooking {
  id: string;
  userId?: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  hours: number | null;
  startHour: string | null;
  note: string | null;
  status: LeaveStatus;
  createdAt?: string;
}

export interface WallchartUser {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  teamId: string | null;
  teamName: string | null;
  teamColor: string | null;
  bookings: LeaveBooking[];
}

export interface WallchartData {
  users: WallchartUser[];
  leaveTypes: LeaveType[];
}

export interface LeaveAllowance {
  id: string;
  leaveTypeId: string;
  year: number;
  totalDays: number;
  usedDays: number;
}

export interface BookLeaveInput {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  hours?: number;
  startHour?: string;
  note?: string;
}

// ── Hooks ──────────────────────────────────────────────────────────────────

interface LeaveTypesResponse {
  types: LeaveType[];
  employmentType: EmploymentType;
}

/** Fetch leave types visible to the current user + their employment type */
export function useLeaveTypes() {
  return useQuery({
    queryKey: ['leave-types'],
    queryFn: () => apiFetch<LeaveTypesResponse>('/leave/types'),
    staleTime: 5 * 60 * 1000, // 5 min — leave types rarely change
  });
}

/** Fetch Polish public holidays for a year */
export function useHolidays(year: number) {
  return useQuery({
    queryKey: ['leave-holidays', year],
    queryFn: () => apiFetch<Record<string, string>>(`/leave/holidays?year=${year}`),
    staleTime: Infinity, // holidays never change
  });
}

/** Fetch wallchart data for a date range */
export function useWallchart(from: string, to: string) {
  return useQuery({
    queryKey: ['leave-wallchart', from, to],
    queryFn: () => apiFetch<WallchartData>(`/leave/wallchart?from=${from}&to=${to}`),
    enabled: !!from && !!to,
  });
}

/** Fetch current user's leave requests */
export function useMyLeave(year?: number) {
  const { effectiveUserId } = useImpersonation();
  const yearParam = year ? `?year=${year}` : '';
  return useQuery({
    queryKey: year
      ? ['leave-requests', effectiveUserId, year]
      : ['leave-requests', effectiveUserId],
    queryFn: () => apiFetch<LeaveBooking[]>(`/leave/requests${yearParam}`),
  });
}

/** Fetch current user's leave allowances */
export function useLeaveAllowances(year?: number) {
  const { effectiveUserId } = useImpersonation();
  const y = year ?? new Date().getFullYear();
  return useQuery({
    queryKey: ['leave-allowances', effectiveUserId, y],
    queryFn: () => apiFetch<LeaveAllowance[]>(`/leave/allowances?year=${y}`),
  });
}

/** Book time off */
export function useBookLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BookLeaveInput) =>
      apiFetch<LeaveBooking>('/leave/requests', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      // Invalidate all leave-related queries
      qc.invalidateQueries({ queryKey: ['leave-wallchart'] });
      qc.invalidateQueries({ queryKey: ['leave-requests'] });
      qc.invalidateQueries({ queryKey: ['leave-allowances'] });
    },
  });
}

/** Update an existing leave request */
export function useUpdateLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Partial<BookLeaveInput>) =>
      apiFetch<LeaveBooking>(`/leave/requests/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leave-wallchart'] });
      qc.invalidateQueries({ queryKey: ['leave-requests'] });
      qc.invalidateQueries({ queryKey: ['leave-allowances'] });
    },
  });
}

/** Cancel a leave request */
export function useCancelLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<LeaveBooking>(`/leave/requests/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leave-wallchart'] });
      qc.invalidateQueries({ queryKey: ['leave-requests'] });
      qc.invalidateQueries({ queryKey: ['leave-allowances'] });
    },
  });
}

// ── Admin hooks ────────────────────────────────────────────────────────────

/** Fetch all leave type groups (admin) */
export function useAdminLeaveTypeGroups() {
  return useQuery({
    queryKey: ['admin-leave-type-groups'],
    queryFn: () => apiFetch<LeaveTypeGroup[]>('/admin/leave-type-groups'),
  });
}

/** Fetch all leave types (admin — unfiltered) */
export function useAdminLeaveTypes() {
  return useQuery({
    queryKey: ['admin-leave-types'],
    queryFn: () => apiFetch<AdminLeaveType[]>('/admin/leave-types'),
  });
}

/** Create a leave type group */
export function useCreateLeaveTypeGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; color: string }) =>
      apiFetch<LeaveTypeGroup>('/admin/leave-type-groups', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-leave-type-groups'] });
    },
  });
}

/** Update a leave type group */
export function useUpdateLeaveTypeGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      color?: string;
      sortOrder?: number;
    }) =>
      apiFetch<LeaveTypeGroup>(`/admin/leave-type-groups/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-leave-type-groups'] });
    },
  });
}

/** Delete a leave type group */
export function useDeleteLeaveTypeGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch('/admin/leave-type-groups/' + id, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-leave-type-groups'] });
      qc.invalidateQueries({ queryKey: ['admin-leave-types'] });
    },
  });
}

/** Create a new leave type */
export function useCreateLeaveType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      daysPerYear: number;
      color?: string | null;
      deducted?: boolean;
      groupId?: string | null;
      visibility?: string;
    }) =>
      apiFetch<AdminLeaveType>('/admin/leave-types', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-leave-types'] });
      qc.invalidateQueries({ queryKey: ['admin-leave-type-groups'] });
      qc.invalidateQueries({ queryKey: ['leave-types'] });
    },
  });
}

/** Update a single leave type (admin fields) */
export function useUpdateAdminLeaveType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      groupId?: string | null;
      active?: boolean;
      visibility?: string;
      color?: string | null;
      name?: string;
      isContractorDefault?: boolean;
    }) =>
      apiFetch<AdminLeaveType>(`/admin/leave-types/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-leave-types'] });
      qc.invalidateQueries({ queryKey: ['leave-types'] });
    },
  });
}

/** Bulk update leave types */
export function useBulkUpdateLeaveTypes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      ids: string[];
      groupId?: string | null;
      active?: boolean;
      visibility?: string;
    }) =>
      apiFetch('/admin/leave-types/bulk', {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-leave-types'] });
      qc.invalidateQueries({ queryKey: ['leave-types'] });
    },
  });
}
