import React, { useState, useEffect } from 'react';
import { 
  X, PlusCircle, AlertCircle, Clock, Lock, Globe, 
  Users, Image as ImageIcon, Trash2, Mic, ChevronDown, ChevronUp 
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

const CATEGORIES: IssueCategory[] = [
  'Workplace & Career',
  'Family & Home',
  'Community & Neighborhood',
  'Religious & Faith',
  'Clubs & Groups',
  'Politics & Policy',
  'Environment & Climate',
  'Economy & Finance',
  'Education & Campus',
  'Private & Internal'
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

const REGIONS: IssueRegion[] = [
  'Global / Remote',
  'North America',
  'Europe & UK',
  'Africa & Middle East',
  'Asia-Pacific',
  'Local District'
];

export const CreateIssueModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onCreateIssue,
  onOpenGuidelines,
  currentUser
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<IssueCategory>(
    currentUser?.interests && currentUser.interests.length > 0
      ? currentUser.interests[0]
      : 'Workplace & Career'
  );
  const [region, setRegion] = useState<IssueRegion>(currentUser?.region || 'Global / Remote');
  const [tagsInput, setTagsInput] = useState('');
  const [duration, setDuration] = useState<DurationOption>(DURATION_OPTIONS[3]); // 7 Days default
  
  // Collapsible Attachments drawer
  const [showMediaDrawer, setShowMediaDrawer] = useState(false);
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
      setRegion(currentUser.region || 'Global / Remote');
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
    (!descMod.isAppropriate && descMod.severity === 'rejected');

  const isValid = 
    title.trim().length >= 8 && 
    description.trim().length >= 12 &&
    !hasModViolation &&
    (!isAnonymous ? (currentUser?.name || authorName.trim()).length > 0 : true);

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

    const newIssue: Issue = {
      id: `issue-${Date.now()}`,
      title: title.trim(),
      description: description.trim(),
      category: visibility === 'private' ? 'Private & Internal' : category,
      region,
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
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-ink-950/75 backdrop-blur-md animate-fade-in overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-issue-title"
    >
      <div className="relative w-full max-w-xl bg-white dark:bg-ink-900 sm:rounded-3xl shadow-lift border border-slate-200/80 dark:border-white/10 overflow-hidden h-full sm:h-auto sm:max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-ink-950 via-ink-900 to-brand-950 text-white relative">
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-brand-500/20 border border-brand-400/30 text-brand-300">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 id="create-issue-title" className="text-lg font-bold tracking-tight text-white">
                New Time-Bound Issue
              </h2>
              <p className="text-xs text-zinc-400">
                Create a YES/NO ballot for your group or the public.
              </p>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {/* Question */}
          <div>
            <label htmlFor="issue-title-input" className="block text-xs font-bold text-slate-700 mb-1">
              Yes / No Question <span className="text-rose-500">*</span>
            </label>
            <input
              id="issue-title-input"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Should our team adopt a 4-day work week?"
              className="w-full text-sm p-3 bg-slate-50/70 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 placeholder:text-slate-400 transition-all"
            />
            {title.trim().length > 0 && !titleMod.isAppropriate && (
              <p className="text-xs text-rose-600 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {titleMod.flags[0]}
              </p>
            )}
          </div>

          {/* Context */}
          <div>
            <label htmlFor="issue-desc-input" className="block text-xs font-bold text-slate-700 mb-1">
              Short Context <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="issue-desc-input"
              rows={2}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Briefly explain who this affects and what voting YES or NO means..."
              className="w-full text-xs sm:text-sm p-3 bg-slate-50/70 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 placeholder:text-slate-400 resize-none transition-all"
            />
            {description.trim().length > 0 && !descMod.isAppropriate && (
              <p className="text-xs text-rose-600 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {descMod.flags[0]}
              </p>
            )}
          </div>

          {/* Category, Region & Duration Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2.5">
              <div>
                <label htmlFor="issue-category-select" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Sphere / Category
                </label>
                <select
                  id="issue-category-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as IssueCategory)}
                  className="w-full text-xs sm:text-sm p-2.5 bg-white dark:bg-ink-950 dark:text-white border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-brand-500"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="issue-region-select" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Region / Scope
                </label>
                <select
                  id="issue-region-select"
                  value={region}
                  onChange={(e) => setRegion(e.target.value as IssueRegion)}
                  className="w-full text-xs sm:text-sm p-2.5 bg-white dark:bg-ink-950 dark:text-white border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-brand-500"
                >
                  {REGIONS.map(reg => (
                    <option key={reg} value={reg}>{reg}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-brand-600" />
                <span>Voting Deadline</span>
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => setDuration(opt)}
                    className={`py-1.5 px-1 text-center rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                      duration.label === opt.label
                        ? 'border-brand-600 bg-brand-50 text-brand-700'
                        : 'border-slate-200 hover:border-slate-300 text-slate-600 bg-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* VISIBILITY: PUBLIC VS PRIVATE */}
          <div className="bg-slate-50/80 rounded-2xl p-3.5 border border-slate-200/90 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setVisibility('public')}
                className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  visibility === 'public'
                    ? 'border-emerald-600 bg-white text-emerald-900 shadow-2xs'
                    : 'border-slate-200 hover:bg-white text-slate-600'
                }`}
              >
                <Globe className="w-4 h-4 text-emerald-600 shrink-0" />
                <div className="text-left">
                  <div>Public Poll</div>
                  <div className="text-[10px] font-normal text-slate-500">Anyone can vote</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setVisibility('private')}
                className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  visibility === 'private'
                    ? 'border-brand-600 bg-white text-brand-900 shadow-2xs'
                    : 'border-slate-200 hover:bg-white text-slate-600'
                }`}
              >
                <Lock className="w-4 h-4 text-brand-600 shrink-0" />
                <div className="text-left">
                  <div>Private Circle</div>
                  <div className="text-[10px] font-normal text-slate-500">Invite-only access</div>
                </div>
              </button>
            </div>

            {visibility === 'private' && (
              <div className="pt-2 border-t border-slate-200 space-y-2.5 animate-fade-in">
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={emailsInput}
                    onChange={(e) => setEmailsInput(e.target.value)}
                    placeholder="Invite by email (e.g. alex@company.com)..."
                    className="flex-1 text-xs px-3 py-2 border border-slate-200 rounded-xl bg-white"
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddEmail(); } }}
                  />
                  <button
                    type="button"
                    onClick={handleAddEmail}
                    className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl cursor-pointer"
                  >
                    + Email
                  </button>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={groupInput}
                    onChange={(e) => setGroupInput(e.target.value)}
                    placeholder="Invite group (e.g. District 4 Council)..."
                    className="flex-1 text-xs px-3 py-2 border border-slate-200 rounded-xl bg-white"
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddGroup(); } }}
                  />
                  <button
                    type="button"
                    onClick={handleAddGroup}
                    className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl cursor-pointer"
                  >
                    + Group
                  </button>
                </div>

                {(invitedEmails.length > 0 || invitedGroups.length > 0) && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {invitedEmails.map((em) => (
                      <span key={em} className="text-[11px] bg-brand-50 border border-brand-200 text-brand-700 px-2 py-0.5 rounded-lg flex items-center gap-1 font-mono">
                        {em}
                        <button type="button" onClick={() => handleRemoveEmail(em)} className="text-brand-400 hover:text-rose-600 cursor-pointer">×</button>
                      </span>
                    ))}
                    {invitedGroups.map((grp) => (
                      <span key={grp} className="text-[11px] bg-purple-50 border border-purple-200 text-purple-700 px-2 py-0.5 rounded-lg flex items-center gap-1 font-semibold">
                        <Users className="w-3 h-3" />
                        {grp}
                        <button type="button" onClick={() => handleRemoveGroup(grp)} className="text-purple-400 hover:text-rose-600 cursor-pointer">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* COLLAPSIBLE DRAWER: PHOTOS, AUDIO BRIEFING & TAGS */}
          <div className="border border-slate-200/90 rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowMediaDrawer(!showMediaDrawer)}
              className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/80 flex items-center justify-between text-xs font-bold text-slate-700 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-brand-600" />
                <Mic className="w-4 h-4 text-purple-600 -ml-1" />
                <span>Add Photos, Spoken Audio Briefing or Tags (Optional)</span>
              </span>
              <div className="flex items-center gap-2">
                {(images.length > 0 || creatorVoice) && (
                  <span className="px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 text-[10px]">
                    {images.length + (creatorVoice ? 1 : 0)} attached
                  </span>
                )}
                {showMediaDrawer ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {showMediaDrawer && (
              <div className="p-4 space-y-4 bg-white border-t border-slate-200/80 animate-fade-in">
                {/* Photos */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Photos / Visual Evidence</span>
                    <span className="text-[11px] text-slate-400">{images.length} added</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <label className="cursor-pointer px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors">
                      <ImageIcon className="w-3.5 h-3.5 text-brand-600" />
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
                        className="text-[11px] bg-white border border-slate-200 hover:border-brand-400 text-slate-600 px-2.5 py-1 rounded-lg cursor-pointer"
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
                      className="flex-1 text-xs px-3 py-1.5 border border-slate-200 rounded-xl bg-slate-50"
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddImageUrl(); } }}
                    />
                    <button
                      type="button"
                      onClick={handleAddImageUrl}
                      className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl cursor-pointer"
                    >
                      Add
                    </button>
                  </div>

                  {images.length > 0 && (
                    <div className="grid grid-cols-4 gap-2 pt-1">
                      {images.map((img, idx) => (
                        <div key={idx} className="relative rounded-xl overflow-hidden border border-slate-200 aspect-video bg-slate-100">
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
                </div>

                {/* Creator Audio Briefing */}
                <div className="pt-2 border-t border-slate-100">
                  <VoiceRecorder
                    existingAttachment={creatorVoice}
                    label="Creator 60s Audio Briefing"
                    onRecordingComplete={(attachment) => setCreatorVoice(attachment)}
                  />
                </div>

                {/* Tags */}
                <div className="pt-2 border-t border-slate-100">
                  <label htmlFor="issue-tags-input" className="block text-xs font-bold text-slate-700 mb-1">
                    Tags (Comma separated)
                  </label>
                  <input
                    id="issue-tags-input"
                    type="text"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="e.g. RemoteWork, Schedule, Q3"
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Author Identity */}
          <div className="p-3.5 bg-slate-50/80 border border-slate-200/90 rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800 block">Post Anonymously</span>
                <span className="text-[11px] text-slate-500">
                  {isAnonymous ? `Listed as ${alias}` : 'Listed with your display name'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsAnonymous(!isAnonymous)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  isAnonymous ? 'bg-brand-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    isAnonymous ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {!isAnonymous && (
              <input
                type="text"
                required={!isAnonymous}
                value={currentUser?.name || authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="Your Name or Organization *"
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl bg-white"
              />
            )}
          </div>

          {/* Submit */}
          <div className="pt-1 space-y-2">
            <button
              type="submit"
              disabled={!isValid}
              className={`w-full py-3.5 px-5 rounded-2xl font-bold text-sm shadow-lift transition-all ${
                isValid
                  ? 'bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-500 hover:to-brand-600 text-white cursor-pointer active:scale-[0.99]'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              Publish Issue ({duration.label})
            </button>
            <div className="text-[11px] text-center text-slate-400">
              Subject to our{' '}
              <button type="button" onClick={onOpenGuidelines} className="text-brand-600 font-semibold hover:underline cursor-pointer">
                Community Guidelines
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
