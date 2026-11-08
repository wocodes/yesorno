import { Issue, PublicUserProfile, UserProfile, VoteSubmission } from '../types';
import { TOP_CREATORS_AND_VOTERS, DEMO_USERS, GOOGLE_SAMPLE_ACCOUNTS, getSavedProfileByEmail } from './auth';

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
  },
  issues: Issue[],
  currentUser: UserProfile | null
): PublicUserProfile {
  const targetUsername = cleanHandle(target.username);
  const targetEmail = (target.email || '').trim().toLowerCase();
  const targetName = (target.name || '').trim();
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
      };
    }
  }

  // 3. Check TOP_CREATORS_AND_VOTERS
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

  // 7. Fallback generated public profile
  const resolvedName = targetName || (targetUsername ? `@${targetUsername}` : 'Civic Member');
  const resolvedUsername = targetUsername || cleanHandle(resolvedName.split(' ')[0]) || 'member';

  return {
    id: `user-${resolvedUsername}`,
    name: resolvedName,
    username: resolvedUsername,
    email: targetEmail || undefined,
    role: target.role || 'Civic Participant',
    bio: 'Participating in civic decisions and consensus building.',
    avatar: target.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(resolvedName)}&backgroundColor=4f46e5,0d9488,d97706,e11d48`,
    region: 'Local District',
    groups: ['Community Member'],
    isVerified: false,
  };
}

/**
 * Retrieves all issues created by a specific user
 */
export function getUserCreatedIssues(user: PublicUserProfile, issues: Issue[]): Issue[] {
  const userHandle = cleanHandle(user.username);
  const userEmail = (user.email || '').toLowerCase();
  const userName = user.name.toLowerCase();

  return issues.filter(issue => {
    if (issue.isDeletedByAuthor) return false;
    const iCreatorEmail = (issue.creatorEmail || '').toLowerCase();
    const iCreatorUsername = cleanHandle(issue.creatorUsername);
    const iAuthor = (issue.author || '').toLowerCase();

    return Boolean(
      (userEmail && iCreatorEmail === userEmail) ||
      (userHandle && iCreatorUsername === userHandle) ||
      (userName && iAuthor === userName)
    );
  });
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

  const results: Array<{ issue: Issue; response: VoteSubmission }> = [];

  for (const issue of issues) {
    if (issue.isDeletedByAuthor) continue;
    for (const resp of issue.responses) {
      if (resp.isAnonymous) continue;

      const rUsername = cleanHandle(resp.authorUsername);
      const rEmail = (resp.authorEmail || '').toLowerCase();
      const rName = (resp.authorName || '').toLowerCase();

      const isMatch = Boolean(
        (userHandle && rUsername === userHandle) ||
        (userEmail && rEmail === userEmail) ||
        (userName && rName === userName)
      );

      if (isMatch) {
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
