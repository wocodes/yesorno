import React, { useState, useEffect } from 'react';
import { 
  X, AlertCircle, Clock, Lock, Globe, 
  Users, Image as ImageIcon, Trash2, Mic, Tag, ShieldCheck, Layers, Plus
} from 'lucide-react';
import { Issue, IssueCategory, IssueRegion, IssueVisibility, UserProfile, VoiceAttachment } from '../types';
import { moderateText, generateCivicAlias } from '../utils/moderation';
import { VoiceRecorder } from './VoiceRecorder';
import { fileToDataUrl } from '../utils/audio';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreateIssue: (issue: Issue) => void;
  onOpenGuidelines: () => void;
  currentUser: UserProfile | null;
}

const CATEGORIES: { key: IssueCategory; label: string; emoji: string }[] = [
  { key: 'Workplace & Career', label: 'Workplace', emoji: '💼' },
  { key: 'Family & Home', label: 'Family', emoji: '👨‍👩‍👧' },
  { key: 'Community & Neighborhood', label: 'Community', emoji: '🏡' },
  { key: 'Religious & Faith', label: 'Faith', emoji: '🕊️' },
  { key: 'Clubs & Groups', label: 'Clubs', emoji: '👥' },
  { key: 'Politics & Policy', label: 'Policy', emoji: '🏛️' },
  { key: 'Environment & Climate', label: 'Climate', emoji: '🌱' },
  { key: 'Economy & Finance', label: 'Economy', emoji: '📈' },
  { key: 'Education & Campus', label: 'Education', emoji: '🎓' },
  { key: 'Private & Internal', label: 'Private Circle', emoji: '🔒' },
];

interface DurationOption {
  label: string;
  hours: number;
}

const DURATION_OPTIONS: DurationOption[] = [
  { label: '24 Hours', hours: 24 },
  { label: '48 Hours', hours: 48 },
  { label: '3 Days', hours: 72 },
  { label: '7 Days', hours: 168 },
  { label: '14 Days', hours: 336 },
  { label: '30 Days', hours: 720 },
];

const CIVIC_PHOTO_PRESETS = import.meta.env.DEV
  ? [
      { label: 'Pedestrian St', url: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=600&auto=format&fit=crop&q=80' },
      { label: 'Park Path', url: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=600&auto=format&fit=crop&q=80' },
      { label: 'Solar Rooftop', url: 'https://images.unsplash.com/photo-1509391365360-2e959784a276?w=600&auto=format&fit=crop&q=80' },
      { label: 'Town Square', url: 'https://images.unsplash.com/photo-1477959858617-67f30bc75b82?w=600&auto=format&fit=crop&q=80' },
    ]
  : [];

type ActiveToolPanel = 'deadline' | 'privacy' | 'photos' | 'audio' | 'category' | 'tags' | 'identity' | null;

export const CreateIssueModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onCreateIssue,
  onOpenGuidelines,
  currentUser
}) => {
  const [title, setTitle] = useState('');
  const [showDescription, setShowDescription] = useState(false);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<IssueCategory>(
    currentUser?.interests && currentUser.interests.length > 0
      ? currentUser.interests[0]
      : 'Workplace & Career'
  );
  // Region always defaults to the user's selected location
  const userRegion: IssueRegion = currentUser?.region || 'Global / Remote';

  const [tagsInput, setTagsInput] = useState('');
  const [duration, setDuration] = useState<DurationOption>(DURATION_OPTIONS[3]); // 7 Days default
  const [activeTool, setActiveTool] = useState<ActiveToolPanel>(null);

  // Media attachments
  const [creatorVoice, setCreatorVoice] = useState<VoiceAttachment | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState('');

  // Visibility
  const [visibility, setVisibility] = useState<IssueVisibility>('public');
  const [emailsInput, setEmailsInput] = useState('');
  const [invitedEmails, setInvitedEmails] = useState<string[]>([]);
  const [groupInput, setGroupInput] = useState('');
  const [invitedGroups, setInvitedGroups] = useState<string[]>(currentUser?.groups || []);

  // Author identity
  const [isAnonymous, setIsAnonymous] = useState(currentUser?.defaultAnonymous ?? false);
  const [authorName, setAuthorName] = useState(currentUser?.name || '');
  const [alias] = useState(() => generateCivicAlias());

  useEffect(() => {
    if (isOpen && currentUser) {
      setAuthorName(currentUser.name || '');
      if (currentUser.interests && currentUser.interests.length > 0) {
        setCategory(currentUser.interests[0]);
      }
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const titleMod = moderateText(title);
  const descMod = moderateText(description);
  const hasModViolation = 
    (!titleMod.isAppropriate && titleMod.severity === 'rejected') ||
    (description.trim().length > 0 && !descMod.isAppropriate && descMod.severity === 'rejected');

  // Description is completely optional — only the Yes/No question is required
  const isValid = 
    title.trim().length >= 5 && 
    !hasModViolation &&
    (!isAnonymous ? (currentUser?.name || authorName.trim()).length > 0 : true);

  const toggleTool = (tool: Exclude<ActiveToolPanel, null>) => {
    setActiveTool(prev => (prev === tool ? null : tool));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    for (const f of files) {
      if (f.type.startsWith('image/')) {
        try {
          const dataUrl = await fileToDataUrl(f);
          setImages(prev => [...prev, dataUrl]);
        } catch (err) {
          console.warn('Image upload failed:', err);
        }
      }
    }
  };

  const handleAddImageUrl = () => {
    if (imageUrlInput.trim() && !images.includes(imageUrlInput.trim())) {
      setImages([...images, imageUrlInput.trim()]);
      setImageUrlInput('');
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleAddEmail = () => {
    if (emailsInput.trim() && !invitedEmails.includes(emailsInput.trim().toLowerCase())) {
      setInvitedEmails([...invitedEmails, emailsInput.trim().toLowerCase()]);
      setEmailsInput('');
    }
  };

  const handleRemoveEmail = (em: string) => {
    setInvitedEmails(invitedEmails.filter(e => e !== em));
  };

  const handleAddGroup = () => {
    if (groupInput.trim() && !invitedGroups.includes(groupInput.trim())) {
      setInvitedGroups([...invitedGroups, groupInput.trim()]);
      setGroupInput('');
    }
  };

  const handleRemoveGroup = (grp: string) => {
    setInvitedGroups(invitedGroups.filter(g => g !== grp));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    const tags = tagsInput
      .split(',')
      .map(t => t.trim().replace(/^#/, ''))
      .filter(Boolean);

    const now = Date.now();
    const closingTime = new Date(now + duration.hours * 60 * 60 * 1000).toISOString();

    // Normalize question mark: strip any trailing ? or . or whitespace and append a single ?
    const normalizedTitle = title.trim().replace(/[?.!\s]+$/, '') + '?';

    const newIssue: Issue = {
      id: `issue-${Date.now()}`,
      title: normalizedTitle,
      description: description.trim(),
      category: visibility === 'private' ? 'Private & Internal' : category,
      region: userRegion,
      tags: tags.length > 0 ? tags : [category.split(' ')[0]],
      author: isAnonymous ? alias : (currentUser?.name || authorName.trim()),
      creatorId: currentUser?.id,
      creatorEmail: currentUser?.email,
      isAnonymousAuthor: isAnonymous,
      createdAt: new Date().toISOString(),
      closingDate: closingTime,
      durationLabel: duration.label,
      visibility,
      invitedEmails: visibility === 'private' ? invitedEmails : [],
      invitedGroups: visibility === 'private' ? invitedGroups : [],
      yesCount: 0,
      noCount: 0,
      responses: [],
      images: images.length > 0 ? images : undefined,
      creatorVoiceNote: creatorVoice || undefined
    };

    onCreateIssue(newIssue);
    setTitle('');
    setDescription('');
    setShowDescription(false);
    setImages([]);
    setCreatorVoice(null);
    setActiveTool(null);
    onClose();
  };

  const activeCategoryObj = CATEGORIES.find(c => c.key === category) || CATEGORIES[0];

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2 sm:p-4 pt-12 sm:pt-4 bg-ink-950/75 backdrop-blur-md animate-fade-in overflow-y-auto overscroll-contain"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-issue-title"
    >
      <div className="relative w-full max-w-lg bg-white dark:bg-ink-900 rounded-3xl shadow-lift overflow-hidden flex flex-col max-h-[92vh] animate-slide-up overscroll-contain">
        {/* Minimal Social Composer Top Bar */}
        <div className="px-5 pt-4 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full bg-brand-50 dark:bg-brand-500/20 text-brand-600 dark:text-brand-300 font-bold text-sm flex items-center justify-center overflow-hidden shrink-0">
              {isAnonymous ? (
                <ShieldCheck className="w-4 h-4 text-brand-500" />
              ) : currentUser?.avatar ? (
                <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
              ) : (
                (currentUser?.name || 'U').charAt(0)
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-bold text-ink-950 dark:text-white truncate">
                <span id="create-issue-title" className="truncate">
                  {isAnonymous ? alias : (currentUser?.name || 'Member')}
                </span>
                <span className="text-slate-300 dark:text-zinc-600">•</span>
                <span className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 whitespace-nowrap">
                  {activeCategoryObj.emoji} {activeCategoryObj.label}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-zinc-500">
                <span>{visibility === 'private' ? '🔒 Private Circle' : '🌐 Public Poll'}</span>
                <span>•</span>
                <span>⏳ {duration.label}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-ink-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Social Composer Form */}
        <form onSubmit={handleSubmit} className="px-5 pb-4 pt-2 space-y-3 overflow-y-auto overscroll-contain flex-1">
          {/* Primary Yes/No Question Input */}
          <div>
            <textarea
              id="issue-title-input"
              rows={2}
              autoFocus
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ask a Yes or No question... (e.g. Should our team adopt a 4-day work week?)"
              className="w-full text-base sm:text-lg font-bold bg-transparent text-ink-950 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none resize-none leading-snug"
            />
            {title.trim().length > 0 && !titleMod.isAppropriate && (
              <p className="text-xs text-rose-500 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {titleMod.flags[0]}
              </p>
            )}
          </div>

          {/* Optional "+ Add Description" Link or Expandable Textarea */}
          {!showDescription && !description ? (
            <button
              type="button"
              onClick={() => setShowDescription(true)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Description</span>
            </button>
          ) : (
            <div className="space-y-1 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400 dark:text-zinc-500">
                  Description (Optional)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setDescription('');
                    setShowDescription(false);
                  }}
                  className="text-[11px] text-slate-400 hover:text-rose-500 cursor-pointer"
                >
                  Remove
                </button>
              </div>
              <textarea
                id="issue-desc-input"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add optional context or background details..."
                className="w-full text-xs sm:text-sm p-3 rounded-2xl bg-slate-50 dark:bg-ink-950 text-ink-950 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 resize-none"
              />
              {description.trim().length > 0 && !descMod.isAppropriate && (
                <p className="text-xs text-rose-500 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {descMod.flags[0]}
                </p>
              )}
            </div>
          )}

          {/* Attached Photos Preview Strip (if photos added) */}
          {images.length > 0 && (
            <div className="grid grid-cols-4 gap-2 pt-1">
              {images.map((img, idx) => (
                <div key={idx} className="relative rounded-xl overflow-hidden aspect-video bg-slate-100 dark:bg-ink-950">
                  <img src={img} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(idx)}
                    className="absolute top-1 right-1 p-1 bg-ink-950/80 hover:bg-rose-600 text-white rounded-full cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Attached Audio Badge (if recorded and audio panel closed) */}
          {creatorVoice && activeTool !== 'audio' && (
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 text-xs">
              <span className="font-bold flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5" />
                <span>60s Audio Briefing Attached</span>
              </span>
              <button
                type="button"
                onClick={() => setCreatorVoice(null)}
                className="text-rose-500 hover:underline text-[11px] font-semibold cursor-pointer"
              >
                Remove
              </button>
            </div>
          )}

          {/* Expandable Option Popover Panel when an Icon is clicked */}
          {activeTool === 'deadline' && (
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-ink-950 space-y-2 animate-fade-in">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-brand-500" /> Voting Deadline
                </span>
                <button type="button" onClick={() => setActiveTool(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => {
                      setDuration(opt);
                      setActiveTool(null);
                    }}
                    className={`py-2 px-2 text-center rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      duration.label === opt.label
                        ? 'bg-brand-600 text-white shadow-2xs'
                        : 'bg-white dark:bg-ink-900 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-ink-800'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTool === 'privacy' && (
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-ink-950 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200">
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-purple-500" /> Issue Privacy &amp; Access
                </span>
                <button type="button" onClick={() => setActiveTool(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setVisibility('public')}
                  className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    visibility === 'public'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-white dark:bg-ink-900 text-slate-600 dark:text-zinc-300'
                  }`}
                >
                  <Globe className="w-4 h-4 shrink-0" />
                  <div className="text-left">
                    <div>Public Poll</div>
                    <div className={`text-[10px] font-normal ${visibility === 'public' ? 'text-emerald-100' : 'text-slate-400'}`}>
                      Anyone can vote
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setVisibility('private')}
                  className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    visibility === 'private'
                      ? 'bg-purple-600 text-white shadow-2xs'
                      : 'bg-white dark:bg-ink-900 text-slate-600 dark:text-zinc-300'
                  }`}
                >
                  <Lock className="w-4 h-4 shrink-0" />
                  <div className="text-left">
                    <div>Private Circle</div>
                    <div className={`text-[10px] font-normal ${visibility === 'private' ? 'text-purple-100' : 'text-slate-400'}`}>
                      Invite-only
                    </div>
                  </div>
                </button>
              </div>

              {visibility === 'private' && (
                <div className="space-y-2 pt-1">
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={emailsInput}
                      onChange={(e) => setEmailsInput(e.target.value)}
                      placeholder="Invite by email (e.g. alex@company.com)..."
                      className="flex-1 text-xs px-3 py-2 rounded-xl bg-white dark:bg-ink-900 text-ink-950 dark:text-white"
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddEmail(); } }}
                    />
                    <button
                      type="button"
                      onClick={handleAddEmail}
                      className="px-3 py-2 bg-purple-600 text-white text-xs font-bold rounded-xl cursor-pointer"
                    >
                      + Email
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={groupInput}
                      onChange={(e) => setGroupInput(e.target.value)}
                      placeholder="Invite group (e.g. Leadership Board)..."
                      className="flex-1 text-xs px-3 py-2 rounded-xl bg-white dark:bg-ink-900 text-ink-950 dark:text-white"
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddGroup(); } }}
                    />
                    <button
                      type="button"
                      onClick={handleAddGroup}
                      className="px-3 py-2 bg-slate-200 dark:bg-ink-800 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl cursor-pointer"
                    >
                      + Group
                    </button>
                  </div>

                  {(invitedEmails.length > 0 || invitedGroups.length > 0) && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {invitedEmails.map((em) => (
                        <span key={em} className="text-[11px] bg-brand-50 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300 px-2 py-0.5 rounded-lg flex items-center gap-1 font-mono">
                          {em}
                          <button type="button" onClick={() => handleRemoveEmail(em)} className="hover:text-rose-500 cursor-pointer">×</button>
                        </span>
                      ))}
                      {invitedGroups.map((grp) => (
                        <span key={grp} className="text-[11px] bg-purple-50 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-lg flex items-center gap-1 font-semibold">
                          <Users className="w-3 h-3" />
                          {grp}
                          <button type="button" onClick={() => handleRemoveGroup(grp)} className="hover:text-rose-500 cursor-pointer">×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTool === 'photos' && (
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-ink-950 space-y-2.5 animate-fade-in">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200">
                <span className="flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-emerald-500" /> Attach Photos
                </span>
                <button type="button" onClick={() => setActiveTool(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="cursor-pointer px-3 py-1.5 bg-white dark:bg-ink-900 hover:bg-slate-100 dark:hover:bg-ink-800 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs">
                  <ImageIcon className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Upload Image</span>
                  <input type="file" accept="image/*" multiple onChange={handleFileUpload} className="hidden" />
                </label>
                {CIVIC_PHOTO_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      if (!images.includes(preset.url)) setImages([...images, preset.url]);
                    }}
                    className="text-[11px] bg-white dark:bg-ink-900 text-slate-600 dark:text-zinc-300 px-2.5 py-1 rounded-lg cursor-pointer"
                  >
                    + {preset.label}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="url"
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  placeholder="Or paste image URL (https://...)"
                  className="flex-1 text-xs px-3 py-1.5 rounded-xl bg-white dark:bg-ink-900 text-ink-950 dark:text-white"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddImageUrl(); } }}
                />
                <button
                  type="button"
                  onClick={handleAddImageUrl}
                  className="px-3 py-1.5 bg-brand-600 text-white text-xs font-bold rounded-xl cursor-pointer"
                >
                  Add
                </button>
              </div>
            </div>
          )}

          {activeTool === 'audio' && (
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-ink-950 space-y-2 animate-fade-in">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200">
                <span className="flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5 text-amber-500" /> 60s Spoken Audio Briefing
                </span>
                <button type="button" onClick={() => setActiveTool(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <VoiceRecorder
                existingAttachment={creatorVoice}
                label="Creator 60s Audio Briefing"
                onRecordingComplete={(attachment) => setCreatorVoice(attachment)}
              />
            </div>
          )}

          {activeTool === 'category' && (
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-ink-950 space-y-2 animate-fade-in">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-brand-500" /> Sphere / Category
                </span>
                <button type="button" onClick={() => setActiveTool(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => {
                      setCategory(cat.key);
                      setActiveTool(null);
                    }}
                    className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      category === cat.key
                        ? 'bg-brand-600 text-white shadow-2xs'
                        : 'bg-white dark:bg-ink-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-ink-800'
                    }`}
                  >
                    <span>{cat.emoji}</span>
                    <span className="truncate">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTool === 'tags' && (
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-ink-950 space-y-2 animate-fade-in">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200">
                <span className="flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-sky-500" /> Topic Tags
                </span>
                <button type="button" onClick={() => setActiveTool(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <input
                id="issue-tags-input"
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="Comma separated tags (e.g. RemoteWork, Schedule, Q3)"
                className="w-full text-xs p-2.5 bg-white dark:bg-ink-900 text-ink-950 dark:text-white rounded-xl"
              />
            </div>
          )}

          {/* Bottom Icon Action Bar (X / Instagram / Facebook Style) + Post Button */}
          <div className="pt-2 border-t border-slate-100 dark:border-white/10 flex items-center justify-between gap-1.5 sm:gap-2">
            <div className="flex items-center gap-0.5 sm:gap-1 min-w-0">
              {/* Photo Icon */}
              <button
                type="button"
                onClick={() => toggleTool('photos')}
                title="Add Photos"
                className={`p-2 sm:p-2.5 rounded-full transition-colors cursor-pointer relative shrink-0 ${
                  activeTool === 'photos' || images.length > 0
                    ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-ink-800 hover:text-emerald-500'
                }`}
              >
                <ImageIcon className="w-4 h-4" />
                {images.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {images.length}
                  </span>
                )}
              </button>

              {/* Voice Briefing Mic Icon */}
              <button
                type="button"
                onClick={() => toggleTool('audio')}
                title="Record 60s Audio Briefing"
                className={`p-2 sm:p-2.5 rounded-full transition-colors cursor-pointer relative shrink-0 ${
                  activeTool === 'audio' || creatorVoice
                    ? 'bg-amber-50 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'
                    : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-ink-800 hover:text-amber-500'
                }`}
              >
                <Mic className="w-4 h-4" />
                {creatorVoice && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-500" />
                )}
              </button>

              {/* Voting Deadline Clock Icon */}
              <button
                type="button"
                onClick={() => toggleTool('deadline')}
                title={`Voting Deadline (${duration.label})`}
                className={`p-2 sm:p-2.5 rounded-full transition-colors cursor-pointer shrink-0 ${
                  activeTool === 'deadline'
                    ? 'bg-brand-50 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400'
                    : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-ink-800 hover:text-brand-500'
                }`}
              >
                <Clock className="w-4 h-4" />
              </button>

              {/* Privacy Lock Icon */}
              <button
                type="button"
                onClick={() => toggleTool('privacy')}
                title={`Privacy (${visibility === 'private' ? 'Private Circle' : 'Public Poll'})`}
                className={`p-2 sm:p-2.5 rounded-full transition-colors cursor-pointer shrink-0 ${
                  activeTool === 'privacy' || visibility === 'private'
                    ? 'bg-purple-50 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400'
                    : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-ink-800 hover:text-purple-500'
                }`}
              >
                <Lock className="w-4 h-4" />
              </button>

              {/* Category / Sphere Icon */}
              <button
                type="button"
                onClick={() => toggleTool('category')}
                title={`Category (${activeCategoryObj.label})`}
                className={`p-2 sm:p-2.5 rounded-full transition-colors cursor-pointer shrink-0 ${
                  activeTool === 'category'
                    ? 'bg-brand-50 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400'
                    : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-ink-800 hover:text-brand-500'
                }`}
              >
                <Layers className="w-4 h-4" />
              </button>

              {/* Anonymous Identity Shield Toggle Icon */}
              <button
                type="button"
                onClick={() => setIsAnonymous(!isAnonymous)}
                title={isAnonymous ? `Posting Anonymously as ${alias}` : 'Click to Post Anonymously'}
                className={`p-2 sm:p-2.5 rounded-full transition-colors cursor-pointer shrink-0 ${
                  isAnonymous
                    ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-ink-800 hover:text-emerald-500'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="submit"
                disabled={!isValid}
                className={`py-2 px-4 sm:py-2.5 sm:px-5 rounded-full font-extrabold text-xs sm:text-sm transition-all whitespace-nowrap shrink-0 ${
                  isValid
                    ? 'bg-brand-600 hover:bg-brand-500 text-white shadow-glow cursor-pointer active:scale-95'
                    : 'bg-slate-200 dark:bg-ink-800 text-slate-400 dark:text-zinc-500 cursor-not-allowed'
                }`}
              >
                Post Issue
              </button>
            </div>
          </div>

          <div className="text-[10px] text-right text-slate-400 dark:text-zinc-500">
            By posting, you agree to our{' '}
            <button type="button" onClick={onOpenGuidelines} className="text-brand-600 dark:text-brand-400 font-semibold hover:underline cursor-pointer">
              Community Guidelines
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
