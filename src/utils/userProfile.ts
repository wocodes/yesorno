import { CommentReply, Issue, PublicUserProfile, UserProfile, VoiceAttachment, VoteChoice, VoteSubmission } from '../types';
import { TOP_CREATORS_AND_VOTERS, DEMO_USERS, GOOGLE_SAMPLE_ACCOUNTS, getSavedProfileByEmail } from './auth';
import { SEED_PERSONAS } from '../data/seedPersonas';

/**
 * In-memory cache for profiles fetched from the server / database
 */
const REMOTE_PROFILE_CACHE = new Map<string, PublicUserProfile>();

// Pre-fill cache from browser localStorage on load
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    const raw = localStorage.getItem('cached_remote_profiles');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        Object.entries(parsed).forEach(([key, val]) => {
          if (val && typeof val === 'object') {
            REMOTE_PROFILE_CACHE.set(key.toLowerCase(), val as PublicUserProfile);
          }
        });
      }
    }
  } catch (e) {
    // Ignore storage parse issues
  }
}

/**
 * Normalizes a handle or username into clean lowercase without @ prefix
 */
export function cleanHandle(handle?: string | null): string {
  if (!handle) return '';
  return handle.trim().replace(/^@/, '').toLowerCase();
}

/**
 * Resolves a full PublicUserProfile given any user identifier (username, name, email, avatar, etc.)
 */
export function resolveUserProfile(
  target: {
    username?: string;
    name?: string;
    email?: string;
    avatar?: string;
    role?: string;
    id?: string;
    bio?: string;
    region?: string;
    isVerified?: boolean;
    verificationBadge?: string;
    groups?: string[];
    interests?: string[];
  },
  issues: Issue[],
  currentUser: UserProfile | null
): PublicUserProfile {
  const cleanedHandleFromTarget = cleanHandle(target.username) || cleanHandle(target.name?.startsWith('@') ? target.name : '');
  const targetUsername = cleanedHandleFromTarget;
  const targetEmail = (target.email || '').trim().toLowerCase();
  let rawTargetName = (target.name || '').trim();
  if (rawTargetName.startsWith('@')) {
    rawTargetName = '';
  }
  const targetName = rawTargetName;
  const targetNameLower = targetName.toLowerCase();

  // 1. Check if matching current authenticated user
  if (currentUser) {
    const currentUsername = cleanHandle(currentUser.username);
    const currentEmail = (currentUser.email || '').trim().toLowerCase();
    const currentName = (currentUser.name || '').trim().toLowerCase();

    const isMatch = Boolean(
      (targetEmail && currentEmail && targetEmail === currentEmail) ||
      (targetUsername && currentUsername && targetUsername === currentUsername) ||
      (target.id && currentUser.id && target.id === currentUser.id) ||
      (targetName && currentName && targetNameLower === currentName)
    );

    if (isMatch) {
      return {
        id: currentUser.id,
        name: currentUser.name,
        username: currentUsername || cleanHandle(currentUser.name.split(' ')[0]) || 'me',
        email: currentUser.email,
        role: currentUser.role || 'Verified Member',
        bio: currentUser.bio || 'Active civic contributor shaping public policy and neighborhood consensus.',
        avatar: currentUser.avatar || `https://api.dicebear.com/7.x/micah/svg?seed=${encodeURIComponent(currentUser.email)}`,
        region: currentUser.region || 'Local District',
        groups: currentUser.groups || ['District 4 Council', 'Community Member'],
        interests: currentUser.interests || [],
        isVerified: true,
        votedIssues: currentUser.votedIssues,
      };
    }
  }

  // 2. Check saved profile by email in localStorage
  if (targetEmail) {
    const saved = getSavedProfileByEmail(targetEmail);
    if (saved) {
      return {
        id: saved.id,
        name: saved.name,
        username: cleanHandle(saved.username) || cleanHandle(saved.name.split(' ')[0]),
        email: saved.email,
        role: saved.role,
        bio: saved.bio,
        avatar: saved.avatar,
        region: saved.region,
        groups: saved.groups,
        interests: saved.interests,
        isVerified: true,
        votedIssues: saved.votedIssues,
      };
    }
  }

  // 3. Check SEED_PERSONAS (including Madam Rose and community personas)
  const seedPersona = SEED_PERSONAS.find(p => {
    const pHandle = cleanHandle(p.username);
    const pName = p.name.toLowerCase();
    const pEmail = (p.email || '').toLowerCase();
    return Boolean(
      (targetUsername && pHandle === targetUsername) ||
      (targetName && pName === targetNameLower) ||
      (targetEmail && pEmail === targetEmail) ||
      (target.id && p.id === target.id)
    );
  });

  if (seedPersona) {
    return {
      id: seedPersona.id,
      name: seedPersona.name,
      username: cleanHandle(seedPersona.username),
      email: seedPersona.email,
      role: seedPersona.role,
      bio: seedPersona.bio,
      avatar: seedPersona.avatar,
      region: (seedPersona.region as any) || 'Africa & Middle East',
      groups: [seedPersona.role, 'Civic Contributor'],
      interests: (seedPersona.interests as any) || ['Counselling', 'Family & Home'],
      isVerified: Boolean(seedPersona.isVerified ?? true),
      verificationBadge: seedPersona.verificationBadge || (seedPersona.name === 'Madam Rose' ? 'official_counsellor' : undefined),
    };
  }

  // 4. Check TOP_CREATORS_AND_VOTERS
  const topCreator = TOP_CREATORS_AND_VOTERS.find(c => {
    const cHandle = cleanHandle(c.handle);
    const cName = c.name.toLowerCase();
    return Boolean(
      (targetUsername && cHandle === targetUsername) ||
      (targetName && cName === targetNameLower) ||
      (target.id && c.id === target.id)
    );
  });

  if (topCreator) {
    return {
      id: topCreator.id,
      name: topCreator.name,
      username: cleanHandle(topCreator.handle),
      role: topCreator.role,
      bio: `${topCreator.role} focusing on ${topCreator.specialty}. Leading community dialogue and participatory civic governance.`,
      avatar: topCreator.avatar,
      region: (topCreator.region as any) || 'Local District',
      groups: [topCreator.role, topCreator.specialty, 'Civic Council'],
      isVerified: true,
    };
  }

  // 4. Check DEMO_USERS & GOOGLE_SAMPLE_ACCOUNTS
  const allKnownUsers = [...DEMO_USERS, ...GOOGLE_SAMPLE_ACCOUNTS];
  const known = allKnownUsers.find(u => {
    const uEmail = (u.email || '').toLowerCase();
    const uName = u.name.toLowerCase();
    const uUsername = cleanHandle(u.username);
    return Boolean(
      (targetEmail && uEmail === targetEmail) ||
      (targetUsername && uUsername === targetUsername) ||
      (targetName && uName === targetNameLower) ||
      (target.id && u.id === target.id)
    );
  });

  if (known) {
    return {
      id: known.id,
      name: known.name,
      username: cleanHandle(known.username) || cleanHandle(known.name.split(' ')[0]),
      email: known.email,
      role: known.role,
      bio: known.bio || `${known.role} participating in community consensus.`,
      avatar: known.avatar,
      region: known.region || 'Local District',
      groups: known.groups || ['Community Member'],
      interests: known.interests || [],
      isVerified: true,
    };
  }

  // 5. Look for matching author or creator in issues array
  const matchingIssue = issues.find(i => {
    const iCreatorEmail = (i.creatorEmail || '').toLowerCase();
    const iCreatorUsername = cleanHandle(i.creatorUsername);
    const iAuthor = (i.author || '').toLowerCase();
    return Boolean(
      (targetEmail && iCreatorEmail === targetEmail) ||
      (targetUsername && iCreatorUsername === targetUsername) ||
      (targetName && iAuthor === targetNameLower)
    );
  });

  if (matchingIssue) {
    const fallbackUsername = cleanHandle(matchingIssue.creatorUsername) || targetUsername || cleanHandle(matchingIssue.author.split(' ')[0]);
    return {
      id: matchingIssue.creatorId || `user-${fallbackUsername}`,
      name: matchingIssue.author || targetName || 'Civic Neighbor',
      username: fallbackUsername,
      email: matchingIssue.creatorEmail || targetEmail || undefined,
      role: target.role || (fallbackUsername === 'william' ? 'System Administrator' : 'Community Author'),
      bio: 'Civic pulse participant contributing questions and perspectives to open public debate.',
      avatar: matchingIssue.creatorAvatar || target.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(matchingIssue.author)}&backgroundColor=4f46e5,0d9488,d97706,e11d48`,
      region: matchingIssue.region || 'Local District',
      groups: ['Civic Member'],
      isVerified: false,
    };
  }

  // 6. Look for matching response or reply in issues array
  for (const issue of issues) {
    for (const resp of issue.responses) {
      if (resp.isAnonymous) continue;
      const rUsername = cleanHandle(resp.authorUsername);
      const rName = (resp.authorName || '').toLowerCase();
      const rEmail = (resp.authorEmail || '').toLowerCase();

      if (
        (targetUsername && rUsername === targetUsername) ||
        (targetEmail && rEmail === targetEmail) ||
        (targetName && rName === targetNameLower)
      ) {
        const username = rUsername || cleanHandle(resp.authorName.split(' ')[0]) || 'neighbor';
        return {
          id: `user-${username}`,
          name: resp.authorName,
          username,
          email: resp.authorEmail,
          role: resp.authorRole || target.role || 'Debate Participant',
          bio: 'Community member actively participating in local civic debates and voting on public policy issues.',
          avatar: target.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(resp.authorName)}&backgroundColor=4f46e5,0d9488,d97706,e11d48`,
          region: issue.region || 'Local District',
          groups: ['Community Member'],
          isVerified: false,
        };
      }
    }
  }

  // 6.5. Check cached remote database profiles
  if (targetUsername && REMOTE_PROFILE_CACHE.has(targetUsername)) {
    return REMOTE_PROFILE_CACHE.get(targetUsername)!;
  }
  if (targetEmail && REMOTE_PROFILE_CACHE.has(targetEmail)) {
    return REMOTE_PROFILE_CACHE.get(targetEmail)!;
  }

  // 7. Fallback generated public profile
  let resolvedName = targetName;
  if (!resolvedName || resolvedName.startsWith('@') || (targetUsername && resolvedName.toLowerCase() === targetUsername.toLowerCase())) {
    if (targetUsername) {
      // Convert handle like tobi_alabi or madam_rose or william.odio into proper Full Name
      const words = targetUsername.split(/[._-]/).filter(Boolean);
      resolvedName = words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    } else {
      resolvedName = 'Civic Member';
    }
  }
  const resolvedUsername = targetUsername || cleanHandle(resolvedName.split(' ')[0]) || 'member';

  return {
    id: target.id || `user-${resolvedUsername}`,
    name: resolvedName,
    username: resolvedUsername,
    email: targetEmail || undefined,
    role: target.role || 'Civic Participant',
    bio: target.bio || 'Participating in civic decisions and consensus building.',
    avatar: target.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(resolvedName)}&backgroundColor=4f46e5,0d9488,d97706,e11d48`,
    region: (target.region as any) || 'Local District',
    groups: target.groups && target.groups.length > 0 ? target.groups : ['Community Member'],
    interests: (target.interests as any) || [],
    isVerified: typeof target.isVerified === 'boolean' ? target.isVerified : false,
  };
}

/**
 * Retrieves all issues created by a specific user
 */
export function getUserCreatedIssues(user: PublicUserProfile, issues: Issue[]): Issue[] {
  const userHandle = cleanHandle(user.username);
  const userEmail = (user.email || '').toLowerCase();
  const userName = user.name.toLowerCase();

  return issues
    .filter(issue => {
      if (issue.isDeletedByAuthor) return false;
      const iCreatorEmail = (issue.creatorEmail || '').toLowerCase();
      const iCreatorUsername = cleanHandle(issue.creatorUsername);
      const iAuthor = (issue.author || '').toLowerCase();

      return Boolean(
        (userEmail && iCreatorEmail === userEmail) ||
        (userHandle && iCreatorUsername === userHandle) ||
        (userName && iAuthor === userName)
      );
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export interface UserVoteRecord {
  issue: Issue;
  choice: VoteChoice;
  createdAt: string;
  note?: string;
  voiceNote?: VoiceAttachment;
  likesCount?: number;
  responseId?: string;
}

/**
 * Retrieves all votes cast by a specific user across issues, sorted by latest
 */
export function getUserVotes(
  user: PublicUserProfile,
  issues: Issue[],
  currentUser?: UserProfile | null,
  userVotesMap?: Record<string, { choice: 'YES' | 'NO'; responseId?: string }>
): UserVoteRecord[] {
  const userHandle = cleanHandle(user.username);
  const userEmail = (user.email || '').toLowerCase();
  const userName = user.name.toLowerCase();

  const userResponseIds = new Set<string>();
  if (user.votedIssues) {
    Object.values(user.votedIssues).forEach(v => {
      if (typeof v === 'object' && v && (v as any).responseId) {
        userResponseIds.add((v as any).responseId);
      }
    });
  }

  const voteMap = new Map<string, UserVoteRecord>();

  // 1. Scan all issue responses for this user's submissions
  for (const issue of issues) {
    if (issue.isDeletedByAuthor) continue;
    for (const resp of issue.responses) {
      const rUsername = cleanHandle(resp.authorUsername);
      const rEmail = (resp.authorEmail || '').toLowerCase();
      const rName = (resp.authorName || '').toLowerCase();

      const isMatch = userResponseIds.has(resp.id) || Boolean(
        (userHandle && rUsername === userHandle) ||
        (userEmail && rEmail === userEmail) ||
        (userName && rName === userName)
      );

      if (isMatch) {
        voteMap.set(issue.id, {
          issue,
          choice: resp.choice,
          createdAt: resp.createdAt || issue.createdAt,
          note: resp.note,
          voiceNote: resp.voiceNote,
          likesCount: resp.likesCount,
          responseId: resp.id
        });
      }
    }
  }

  // 2. Check user's stored vote records (e.g. for current user or saved profile)
  const isTargetCurrentUser = Boolean(
    currentUser && (
      (userEmail && currentUser.email && userEmail === currentUser.email.toLowerCase()) ||
      (userHandle && currentUser.username && userHandle === cleanHandle(currentUser.username)) ||
      (userName && currentUser.name && userName === currentUser.name.toLowerCase())
    )
  );

  const directVotes = user.votedIssues || (isTargetCurrentUser ? (userVotesMap || currentUser?.votedIssues) : undefined);

  if (directVotes) {
    for (const [issueId, raw] of Object.entries(directVotes)) {
      if (voteMap.has(issueId)) continue;
      const targetIssue = issues.find(i => i.id === issueId && !i.isDeletedByAuthor);
      if (targetIssue) {
        const choice: VoteChoice = typeof raw === 'string' ? (raw as VoteChoice) : raw.choice;
        const responseId = typeof raw === 'object' ? raw.responseId : undefined;
        const matchedResp = responseId ? targetIssue.responses.find(r => r.id === responseId) : undefined;

        voteMap.set(issueId, {
          issue: targetIssue,
          choice,
          createdAt: matchedResp?.createdAt || targetIssue.createdAt,
          note: matchedResp?.note,
          voiceNote: matchedResp?.voiceNote,
          likesCount: matchedResp?.likesCount,
          responseId
        });
      }
    }
  }

  return Array.from(voteMap.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export interface UserReplyRecord {
  issue: Issue;
  parentResponse: VoteSubmission;
  reply: CommentReply;
}

/**
 * Retrieves all direct comment replies made by a specific user, sorted by latest
 */
export function getUserReplies(user: PublicUserProfile, issues: Issue[]): UserReplyRecord[] {
  const userHandle = cleanHandle(user.username);
  const userEmail = (user.email || '').toLowerCase();
  const userName = user.name.toLowerCase();

  const repliesList: UserReplyRecord[] = [];

  for (const issue of issues) {
    if (issue.isDeletedByAuthor) continue;
    for (const resp of issue.responses) {
      if (!resp.replies || resp.replies.length === 0) continue;
      for (const rep of resp.replies) {
        const repUsername = cleanHandle(rep.authorUsername);
        const repEmail = (rep.authorEmail || '').toLowerCase();
        const repName = (rep.authorName || '').toLowerCase();

        const isMatch = Boolean(
          (userHandle && repUsername === userHandle) ||
          (userEmail && repEmail === userEmail) ||
          (userName && repName === userName)
        );

        if (isMatch) {
          repliesList.push({
            issue,
            parentResponse: resp,
            reply: rep
          });
        }
      }
    }
  }

  return repliesList.sort(
    (a, b) => new Date(b.reply.createdAt).getTime() - new Date(a.reply.createdAt).getTime()
  );
}

/**
 * Retrieves all public perspectives and stances contributed by a specific user across issues
 */
export function getUserPerspectives(
  user: PublicUserProfile,
  issues: Issue[]
): Array<{ issue: Issue; response: VoteSubmission }> {
  const userHandle = cleanHandle(user.username);
  const userEmail = (user.email || '').toLowerCase();
  const userName = user.name.toLowerCase();

  const userResponseIds = new Set<string>();
  if (user.votedIssues) {
    Object.values(user.votedIssues).forEach(v => {
      if (typeof v === 'object' && v && (v as any).responseId) {
        userResponseIds.add((v as any).responseId);
      }
    });
  }

  const results: Array<{ issue: Issue; response: VoteSubmission }> = [];

  for (const issue of issues) {
    if (issue.isDeletedByAuthor) continue;
    for (const resp of issue.responses) {
      const isKnownUserResp = userResponseIds.has(resp.id);
      if (resp.isAnonymous && !isKnownUserResp) continue;

      const rUsername = cleanHandle(resp.authorUsername);
      const rEmail = (resp.authorEmail || '').toLowerCase();
      const rName = (resp.authorName || '').toLowerCase();

      const isMatch = isKnownUserResp || Boolean(
        (userHandle && rUsername === userHandle) ||
        (userEmail && rEmail === userEmail) ||
        (userName && rName === userName)
      );

      if (isMatch && (resp.note || resp.voiceNote)) {
        results.push({ issue, response: resp });
      }
    }
  }

  // Sort newest first
  return results.sort((a, b) => new Date(b.response.createdAt).getTime() - new Date(a.response.createdAt).getTime());
}

/**
 * Checks whether the current user follows a target profile
 */
export function isFollowingUser(target: PublicUserProfile, currentUser: UserProfile | null): boolean {
  if (!currentUser || !currentUser.followingCreators) return false;
  const targetId = target.id || '';
  const targetHandle = cleanHandle(target.username);
  const targetName = target.name.toLowerCase();

  return currentUser.followingCreators.some(followed => {
    const fLower = followed.toLowerCase();
    const fHandle = cleanHandle(followed);
    return (
      (targetId && followed === targetId) ||
      (targetHandle && fHandle === targetHandle) ||
      (fLower.includes(targetName) || targetName.includes(fLower))
    );
  });
}

/**
 * Asynchronously fetches a registered user profile from the server database by username or email.
 * Updates in-memory and local caches so subsequent views resolve synchronously.
 */
export async function fetchRemoteUserProfile(identifier: {
  username?: string;
  email?: string;
}): Promise<PublicUserProfile | null> {
  const username = cleanHandle(identifier.username);
  const email = (identifier.email || '').trim().toLowerCase();

  if (!username && !email) return null;

  if (username && REMOTE_PROFILE_CACHE.has(username)) {
    return REMOTE_PROFILE_CACHE.get(username)!;
  }
  if (email && REMOTE_PROFILE_CACHE.has(email)) {
    return REMOTE_PROFILE_CACHE.get(email)!;
  }

  try {
    const query = new URLSearchParams({ action: 'get_profile' });
    if (username) query.set('username', username);
    if (email) query.set('email', email);

    const res = await fetch(`/api-issues.php?${query.toString()}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.success && data.profile) {
      const p = data.profile;
      const cleanUser = cleanHandle(p.username) || username;
      const rawName = (p.name || '').trim();
      const realName = rawName.startsWith('@') ? rawName.slice(1) : (rawName || cleanUser);

      const resolved: PublicUserProfile = {
        id: p.id || `user-${cleanUser}`,
        name: realName,
        username: cleanUser,
        email: p.email || (email || undefined),
        role: p.role || 'Verified Member',
        bio: p.bio || 'Active civic contributor shaping public policy and neighborhood consensus.',
        avatar: p.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(realName)}&backgroundColor=4f46e5,0d9488,d97706,e11d48`,
        region: p.region || 'Local District',
        groups: Array.isArray(p.groups) && p.groups.length > 0 ? p.groups : ['District 4 Council', 'Community Member'],
        interests: Array.isArray(p.interests) ? p.interests : [],
        isVerified: typeof p.isVerified === 'boolean' ? p.isVerified : true,
        verificationBadge: p.verificationBadge || (p.role?.toLowerCase().includes('google') ? 'google' : 'resident'),
      };

      if (cleanUser) REMOTE_PROFILE_CACHE.set(cleanUser, resolved);
      if (resolved.email) REMOTE_PROFILE_CACHE.set(resolved.email.toLowerCase(), resolved);

      // Persist in localStorage for instant synchronous loads next time
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          const raw = localStorage.getItem('cached_remote_profiles');
          const stored = raw ? JSON.parse(raw) : {};
          if (cleanUser) stored[cleanUser] = resolved;
          if (resolved.email) stored[resolved.email.toLowerCase()] = resolved;
          localStorage.setItem('cached_remote_profiles', JSON.stringify(stored));
        } catch (e) {
          // ignore storage error
        }
      }

      return resolved;
    }
  } catch (err) {
    console.warn('Could not fetch remote user profile:', err);
  }

  return null;
}
