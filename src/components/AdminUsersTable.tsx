import React, { useState, useMemo } from 'react';
import {
  Search, Users2, ShieldCheck, CheckCircle2,
  Clock, Activity, Vote, MessageSquare, FileText, Download,
  RefreshCw, Copy, Check, Eye, SlidersHorizontal, Filter,
  ChevronLeft, ChevronRight, X, Award, Sparkles, UserCheck
} from 'lucide-react';
import { AdminUserRecord } from '../types';

interface AdminUsersTableProps {
  users: AdminUserRecord[];
  isLoading: boolean;
  onRefresh: () => void;
}

export function formatTableDate(iso?: string): { formatted: string; relative: string; full: string; isRecent: boolean } {
  if (!iso) return { formatted: 'Never', relative: '—', full: 'Never recorded', isRecent: false };
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return { formatted: 'Invalid date', relative: '—', full: 'Invalid', isRecent: false };

    const formatted = d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    const full = d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
    const isRecent = diffSec >= 0 && diffSec < 86400; // active within 24h
    let relative = '';
    if (diffSec < 60) relative = 'just now';
    else if (diffSec < 3600) relative = `${Math.floor(diffSec / 60)}m ago`;
    else if (diffSec < 86400) relative = `${Math.floor(diffSec / 3600)}h ago`;
    else if (diffSec < 86400 * 30) relative = `${Math.floor(diffSec / 86400)}d ago`;
    else relative = `${Math.floor(diffSec / (86400 * 30))}mo ago`;

    return { formatted, relative, full, isRecent };
  } catch {
    return { formatted: iso, relative: '—', full: iso, isRecent: false };
  }
}

export const AdminUsersTable: React.FC<AdminUsersTableProps> = ({
  users,
  isLoading,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'registered' | 'verified' | 'seed'>('all');
  const [sortField, setSortField] = useState<'lastActionAt' | 'lastLoginAt' | 'registeredAt' | 'votesCount' | 'issuesCount' | 'name'>('lastActionAt');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const [selectedUser, setSelectedUser] = useState<AdminUserRecord | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  // Copy email helper
  const handleCopyEmail = (email: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    navigator.clipboard?.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  // High-level KPI aggregations
  const totalCount = users.length;
  const registeredCount = useMemo(() => users.filter((u) => u.userType === 'registered').length, [users]);
  const seedCount = useMemo(() => users.filter((u) => u.userType === 'seed').length, [users]);
  const verifiedCount = useMemo(() => users.filter((u) => u.isVerified).length, [users]);
  const activeParticipantsCount = useMemo(
    () => users.filter((u) => (u.votesCount + u.issuesCount + u.commentsCount) > 0).length,
    [users]
  );

  // Filter & Sort
  const filteredAndSortedUsers = useMemo(() => {
    let list = [...users];

    // Filter by type
    if (typeFilter === 'registered') {
      list = list.filter((u) => u.userType === 'registered');
    } else if (typeFilter === 'seed') {
      list = list.filter((u) => u.userType === 'seed');
    } else if (typeFilter === 'verified') {
      list = list.filter((u) => u.isVerified);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((u) =>
        u.name.toLowerCase().includes(q) ||
        (u.username && u.username.toLowerCase().includes(q)) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q) ||
        (u.region && u.region.toLowerCase().includes(q)) ||
        (u.lastAction && u.lastAction.toLowerCase().includes(q))
      );
    }

    // Sort
    list.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortField === 'votesCount' || sortField === 'issuesCount') {
        comparison = (a[sortField] || 0) - (b[sortField] || 0);
      } else {
        const valA = a[sortField] || '';
        const valB = b[sortField] || '';
        comparison = valA.localeCompare(valB);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return list;
  }, [users, typeFilter, searchQuery, sortField, sortOrder]);

  // Reset page when filter or search changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [typeFilter, searchQuery, sortField, sortOrder]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredAndSortedUsers.length / pageSize));
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedUsers.slice(start, start + pageSize);
  }, [filteredAndSortedUsers, currentPage, pageSize]);

  // CSV Export handler
  const handleExportCSV = () => {
    const headers = [
      'User ID',
      'Full Name',
      'Handle',
      'Email Address',
      'Role / Title',
      'User Type',
      'Is Verified',
      'Verification Badge',
      'Date Registered',
      'Last Login',
      'Last Action Description',
      'Last Action Timestamp',
      'Votes Cast',
      'Issues Created',
      'Comments Count',
      'Region',
    ];

    const rows = filteredAndSortedUsers.map((u) => [
      `"${u.id.replace(/"/g, '""')}"`,
      `"${u.name.replace(/"/g, '""')}"`,
      `"@${(u.username || '').replace(/"/g, '""')}"`,
      `"${u.email.replace(/"/g, '""')}"`,
      `"${(u.role || '').replace(/"/g, '""')}"`,
      `"${u.userType}"`,
      u.isVerified ? 'YES' : 'NO',
      `"${u.verificationBadge}"`,
      `"${u.registeredAt || ''}"`,
      `"${u.lastLoginAt || ''}"`,
      `"${(u.lastAction || '').replace(/"/g, '""')}"`,
      `"${u.lastActionAt || ''}"`,
      u.votesCount,
      u.issuesCount,
      u.commentsCount,
      `"${(u.region || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `yesorno-system-users-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* KPI Overview Summary Cards */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="card p-4 space-y-1 bg-gradient-to-br from-slate-900/5 to-transparent dark:from-white/5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 font-semibold">
            <span>Total System Users</span>
            <Users2 className="w-4 h-4 text-brand-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold font-mono text-ink-950 dark:text-white">
            {isLoading ? '...' : totalCount}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-zinc-400">
            {registeredCount} Registered • {seedCount} Seed Personas
          </div>
        </div>

        <div className="card p-4 space-y-1 bg-gradient-to-br from-emerald-500/5 to-transparent">
          <div className="flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
            <span>Registered Accounts</span>
            <UserCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold font-mono text-ink-950 dark:text-white">
            {isLoading ? '...' : registeredCount}
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400">
            Real citizen signups &amp; Google logins
          </div>
        </div>

        <div className="card p-4 space-y-1 bg-gradient-to-br from-sky-500/5 to-transparent">
          <div className="flex items-center justify-between text-xs text-sky-600 dark:text-sky-400 font-semibold">
            <span>Verified Identities</span>
            <ShieldCheck className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold font-mono text-ink-950 dark:text-white">
            {isLoading ? '...' : verifiedCount}
          </div>
          <div className="text-[11px] text-sky-600 dark:text-sky-400">
            Google OAuth &amp; Official credentials
          </div>
        </div>

        <div className="card p-4 space-y-1 bg-gradient-to-br from-purple-500/5 to-transparent">
          <div className="flex items-center justify-between text-xs text-purple-600 dark:text-purple-400 font-semibold">
            <span>Active Participants</span>
            <Activity className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold font-mono text-ink-950 dark:text-white">
            {isLoading ? '...' : activeParticipantsCount}
          </div>
          <div className="text-[11px] text-purple-600 dark:text-purple-400">
            Recorded votes, issues, or replies
          </div>
        </div>
      </section>

      {/* Interactive Toolbar & Controls */}
      <section className="card p-4 sm:p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Live Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, @handle, email, role, or action..."
              className="w-full pl-10 pr-9 py-2 rounded-xl text-xs sm:text-sm bg-slate-100/80 dark:bg-ink-950/70 border border-slate-200 dark:border-white/10 text-ink-950 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-ink-950 dark:hover:text-white p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Action buttons (CSV & Refresh) */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={isLoading || filteredAndSortedUsers.length === 0}
              className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-ink-950 dark:text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="Download tabulated users to CSV"
            >
              <Download className="w-3.5 h-3.5 text-brand-500" />
              <span>Export Users CSV</span>
            </button>

            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="p-2 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-600 dark:text-zinc-300 transition-colors cursor-pointer"
              title="Refresh users directory from database"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-brand-500' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filter Pills & Sort Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-white/5">
          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Filter:
            </span>
            <button
              type="button"
              onClick={() => setTypeFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                typeFilter === 'all'
                  ? 'bg-brand-500 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-white/10'
              }`}
            >
              All Users ({totalCount})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('registered')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                typeFilter === 'registered'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-white/10'
              }`}
            >
              Registered Only ({registeredCount})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('verified')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                typeFilter === 'verified'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-white/10'
              }`}
            >
              Verified Accounts ({verifiedCount})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('seed')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                typeFilter === 'seed'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-white/10'
              }`}
            >
              Seed Personas ({seedCount})
            </button>
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <SlidersHorizontal className="w-3 h-3" /> Sort:
            </span>
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as any)}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-ink-950/70 border border-slate-200 dark:border-white/10 text-ink-950 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="lastActionAt">Most Recent Action</option>
              <option value="lastLoginAt">Most Recent Login</option>
              <option value="registeredAt">Date Registered</option>
              <option value="votesCount">Most Votes Cast</option>
              <option value="issuesCount">Most Issues Created</option>
              <option value="name">Name (Alphabetical)</option>
            </select>
            <button
              type="button"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="p-1 px-2 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-xs font-bold text-slate-600 dark:text-zinc-300 cursor-pointer"
              title={`Currently: ${sortOrder === 'desc' ? 'Descending' : 'Ascending'}. Click to toggle.`}
            >
              {sortOrder === 'desc' ? '↓ DESC' : '↑ ASC'}
            </button>
          </div>
        </div>
      </section>

      {/* Tabulated System Users Table */}
      <section className="card p-0 overflow-hidden shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-100/80 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-3">Role &amp; Classification</th>
                <th className="py-3 px-3">Verified</th>
                <th className="py-3 px-3">Date Registered</th>
                <th className="py-3 px-3">Last Login</th>
                <th className="py-3 px-3 min-w-[200px]">Last Action</th>
                <th className="py-3 px-3 text-center">Civic Activity</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-sans">
              {isLoading && paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-500" />
                    <span>Loading system users directory from database...</span>
                  </td>
                </tr>
              ) : paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Users2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-semibold text-ink-950 dark:text-white">No users match your criteria</p>
                    <p className="text-xs text-slate-400 mt-1">Try adjusting your search terms or filter selection.</p>
                    {(searchQuery || typeFilter !== 'all') && (
                      <button
                        type="button"
                        onClick={() => { setSearchQuery(''); setTypeFilter('all'); }}
                        className="mt-3 px-3 py-1.5 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 text-xs font-bold hover:bg-brand-500/20 cursor-pointer"
                      >
                        Reset Filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user) => {
                  const regDate = formatTableDate(user.registeredAt);
                  const loginDate = formatTableDate(user.lastLoginAt);
                  const actionDate = formatTableDate(user.lastActionAt);

                  return (
                    <tr
                      key={user.id || user.email}
                      className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors group"
                    >
                      {/* User Column */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="relative shrink-0">
                            {user.avatar ? (
                              <img
                                src={user.avatar}
                                alt={user.name}
                                className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-white/10"
                                onError={(e) => {
                                  // Fallback to initials if image fails
                                  (e.currentTarget as HTMLElement).style.display = 'none';
                                }}
                              />
                            ) : null}
                            <div
                              className="w-9 h-9 rounded-full bg-brand-500/20 text-brand-600 dark:text-brand-300 font-bold text-xs flex items-center justify-center border border-brand-500/30"
                              style={{ display: user.avatar ? 'none' : 'flex' }}
                            >
                              {user.name.slice(0, 2).toUpperCase()}
                            </div>
                            {loginDate.isRecent && (
                              <span
                                className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-ink-950"
                                title="Active within last 24h"
                              />
                            )}
                          </div>

                          <div className="min-w-0 max-w-[180px]">
                            <div className="font-bold text-ink-950 dark:text-white truncate flex items-center gap-1.5">
                              <span className="truncate">{user.name}</span>
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono truncate">
                              @{user.username || user.email.split('@')[0]}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-zinc-400 truncate flex items-center gap-1">
                              <span className="truncate">{user.email}</span>
                              <button
                                type="button"
                                onClick={(e) => handleCopyEmail(user.email, e)}
                                className="text-slate-400 hover:text-brand-500 p-0.5 shrink-0"
                                title="Copy email address"
                              >
                                {copiedEmail === user.email ? (
                                  <Check className="w-3 h-3 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role & Classification */}
                      <td className="py-3 px-3">
                        <div className="space-y-1 max-w-[180px]">
                          <div className="font-semibold text-ink-950 dark:text-white truncate" title={user.role}>
                            {user.role || 'Civic Participant'}
                          </div>
                          <div>
                            {user.userType === 'registered' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                <UserCheck className="w-2.5 h-2.5" /> Registered User
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                                <Sparkles className="w-2.5 h-2.5" /> Seed Persona
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Verified Badge */}
                      <td className="py-3 px-3">
                        {user.isVerified ? (
                          user.verificationBadge === 'google' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-500/15 text-sky-600 dark:text-sky-300 border border-sky-400/30">
                              <ShieldCheck className="w-3 h-3 text-sky-500" /> Google Verified
                            </span>
                          ) : user.verificationBadge === 'official' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-400/30">
                              <Award className="w-3 h-3 text-amber-500" /> Official / Org
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-400/30">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Resident Verified
                            </span>
                          )
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-white/5 text-slate-400 border border-slate-200 dark:border-white/10">
                            Unverified
                          </span>
                        )}
                      </td>

                      {/* Date Registered */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-semibold text-ink-950 dark:text-white">
                          {regDate.formatted}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {regDate.relative}
                        </div>
                      </td>

                      {/* Last Login */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-semibold text-ink-950 dark:text-white flex items-center gap-1.5">
                          {loginDate.isRecent && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                          )}
                          <span>{loginDate.formatted}</span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {loginDate.relative}
                        </div>
                      </td>

                      {/* Last Action */}
                      <td className="py-3 px-3">
                        <div className="max-w-[260px] space-y-0.5">
                          <div className="font-semibold text-ink-950 dark:text-white truncate" title={user.lastAction}>
                            {user.lastAction || 'Active in civic deliberation'}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            <span>{actionDate.relative}</span>
                          </div>
                        </div>
                      </td>

                      {/* Civic Activity Breakdown */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1 font-mono text-[11px]">
                          <span
                            className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold"
                            title="Total Votes Cast"
                          >
                            🗳️ {user.votesCount}
                          </span>
                          <span
                            className="px-2 py-0.5 rounded-md bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold"
                            title="Issues Created"
                          >
                            📝 {user.issuesCount}
                          </span>
                          <span
                            className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold"
                            title="Deliberative Comments"
                          >
                            💬 {user.commentsCount}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedUser(user)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-white/10 hover:bg-brand-500 hover:text-white text-slate-700 dark:text-zinc-200 text-xs font-bold transition-all inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 border-t border-slate-200 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500 dark:text-zinc-400">
          <div>
            Showing <strong className="text-ink-950 dark:text-white">
              {filteredAndSortedUsers.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}
            </strong> to <strong className="text-ink-950 dark:text-white">
              {Math.min(currentPage * pageSize, filteredAndSortedUsers.length)}
            </strong> of <strong className="text-ink-950 dark:text-white">{filteredAndSortedUsers.length}</strong> system users
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5 inline mr-1" /> Prev
            </button>

            <span className="px-3 py-1 font-mono font-bold text-ink-950 dark:text-white">
              Page {currentPage} of {totalPages}
            </span>

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            >
              Next <ChevronRight className="w-3.5 h-3.5 inline ml-1" />
            </button>
          </div>
        </div>
      </section>

      {/* Deep User Detail Modal / Inspector Drawer */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in">
          <div
            className="card max-w-2xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto relative animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setSelectedUser(null)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-ink-950 dark:hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header: Avatar & Core Identifiers */}
            <div className="flex items-start gap-4 pr-8">
              <div className="relative shrink-0">
                {selectedUser.avatar ? (
                  <img
                    src={selectedUser.avatar}
                    alt={selectedUser.name}
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-brand-500/40"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-brand-500/20 text-brand-600 dark:text-brand-300 font-extrabold text-xl flex items-center justify-center border-2 border-brand-500/30">
                    {selectedUser.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                {selectedUser.isVerified && (
                  <div
                    className="absolute -bottom-1 -right-1 p-1 rounded-full bg-brand-500 text-white shadow-xs"
                    title="Verified Identity"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>

              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg sm:text-xl font-extrabold text-ink-950 dark:text-white">
                    {selectedUser.name}
                  </h3>
                  {selectedUser.userType === 'registered' ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Registered Citizen
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                      Seed Persona
                    </span>
                  )}
                </div>

                <div className="text-xs font-mono text-slate-400 flex items-center gap-2">
                  <span>@{selectedUser.username || selectedUser.email.split('@')[0]}</span>
                  <span>•</span>
                  <span className="text-brand-600 dark:text-brand-400 font-semibold">{selectedUser.role}</span>
                </div>

                <div className="text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-2 pt-0.5">
                  <span>{selectedUser.email}</span>
                  <button
                    type="button"
                    onClick={(e) => handleCopyEmail(selectedUser.email, e)}
                    className="text-slate-400 hover:text-brand-500 p-0.5"
                    title="Copy Email"
                  >
                    {copiedEmail === selectedUser.email ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                  {selectedUser.region && (
                    <>
                      <span>•</span>
                      <span>📍 {selectedUser.region}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* 4-Stat Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-ink-950/70 border border-slate-100 dark:border-white/5 space-y-0.5">
                <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                  <Vote className="w-3 h-3 text-emerald-500" /> Votes Cast
                </div>
                <div className="text-lg font-mono font-extrabold text-ink-950 dark:text-white">
                  {selectedUser.votesCount}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-ink-950/70 border border-slate-100 dark:border-white/5 space-y-0.5">
                <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                  <FileText className="w-3 h-3 text-brand-500" /> Issues Published
                </div>
                <div className="text-lg font-mono font-extrabold text-ink-950 dark:text-white">
                  {selectedUser.issuesCount}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-ink-950/70 border border-slate-100 dark:border-white/5 space-y-0.5">
                <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                  <MessageSquare className="w-3 h-3 text-purple-500" /> Comments
                </div>
                <div className="text-lg font-mono font-extrabold text-ink-950 dark:text-white">
                  {selectedUser.commentsCount}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-ink-950/70 border border-slate-100 dark:border-white/5 space-y-0.5">
                <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                  <Activity className="w-3 h-3 text-sky-500" /> Total Actions
                </div>
                <div className="text-lg font-mono font-extrabold text-ink-950 dark:text-white">
                  {selectedUser.votesCount + selectedUser.issuesCount + selectedUser.commentsCount}
                </div>
              </div>
            </div>

            {/* Audit & Activity Timeline Box */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-ink-950/50 border border-slate-200/80 dark:border-white/10 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                User Telemetry &amp; Access Timeline
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Date Registered:</span>
                  <strong className="text-ink-950 dark:text-white font-mono">
                    {formatTableDate(selectedUser.registeredAt).full}
                  </strong>
                  <span className="text-[10px] text-slate-400 block">
                    ({formatTableDate(selectedUser.registeredAt).relative})
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[11px]">Last Login Session:</span>
                  <strong className="text-ink-950 dark:text-white font-mono">
                    {formatTableDate(selectedUser.lastLoginAt).full}
                  </strong>
                  <span className="text-[10px] text-slate-400 block">
                    ({formatTableDate(selectedUser.lastLoginAt).relative})
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/60 dark:border-white/5 text-xs">
                <span className="text-slate-400 block text-[11px]">Most Recent Action:</span>
                <p className="font-semibold text-ink-950 dark:text-white mt-0.5">
                  {selectedUser.lastAction || 'Active deliberation in YesOrNo civic discourse'}
                </p>
                <span className="text-[10px] text-slate-400 font-mono">
                  Recorded: {formatTableDate(selectedUser.lastActionAt).full} ({formatTableDate(selectedUser.lastActionAt).relative})
                </span>
              </div>
            </div>

            {/* Bio */}
            {selectedUser.bio && (
              <div className="space-y-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Bio &amp; Perspective</h4>
                <p className="text-xs text-slate-700 dark:text-zinc-300 leading-relaxed bg-slate-50/50 dark:bg-white/[0.02] p-3 rounded-xl border border-slate-100 dark:border-white/5">
                  {selectedUser.bio}
                </p>
              </div>
            )}

            {/* Interests & Groups */}
            <div className="space-y-3 text-xs">
              {selectedUser.interests && selectedUser.interests.length > 0 && (
                <div>
                  <span className="text-slate-400 block text-[11px] mb-1.5 font-bold uppercase tracking-wider">
                    Followed Categories &amp; Interests:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedUser.interests.map((interest) => (
                      <span
                        key={interest}
                        className="px-2.5 py-0.5 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-300 font-semibold text-[11px]"
                      >
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedUser.groups && selectedUser.groups.length > 0 && (
                <div>
                  <span className="text-slate-400 block text-[11px] mb-1.5 font-bold uppercase tracking-wider">
                    Affiliated Civic Circles &amp; Groups:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedUser.groups.map((group) => (
                      <span
                        key={group}
                        className="px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-zinc-300 font-semibold text-[11px]"
                      >
                        {group}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="pt-2 border-t border-slate-200 dark:border-white/10 flex items-center justify-between">
              <div className="text-[11px] font-mono text-slate-400">
                User ID: {selectedUser.id}
              </div>
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="btn-brand text-xs py-2 px-5 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
