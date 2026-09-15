import { all, get } from './db.js';

/** 두 사용자가 수락된 친구 관계인지. */
export function areFriends(a, b) {
  if (a === b) return true;
  return Boolean(
    get(
      `SELECT 1 FROM friendships
       WHERE status = 'accepted'
         AND ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))`,
      a, b, b, a,
    ),
  );
}

export function isCrewMember(crewId, userId) {
  return Boolean(get('SELECT 1 FROM crew_members WHERE crew_id = ? AND user_id = ?', crewId, userId));
}

const SELECT_CATEGORY = `
  SELECT c.*, u.id AS owner_user_id, u.name AS owner_name, u.avatar_url AS owner_avatar
  FROM categories c JOIN users u ON u.id = c.owner_id`;

/**
 * viewer 가 owner 의 프로필 페이지에서 볼 수 있는 카테고리 목록.
 * - 본인이면 전부
 * - 친구면 'public' 이거나 나에게 직접 공유한 것
 * - 그 외에는 없음
 */
export function categoriesVisibleToViewer(viewerId, ownerId) {
  if (viewerId === ownerId) {
    return all(`${SELECT_CATEGORY} WHERE c.owner_id = ? ORDER BY c.sort_order, c.id`, ownerId);
  }
  if (!areFriends(viewerId, ownerId)) return [];
  return all(
    `${SELECT_CATEGORY}
     WHERE c.owner_id = ?
       AND (c.visibility = 'public'
            OR EXISTS (SELECT 1 FROM category_shares s
                       WHERE s.category_id = c.id AND s.target_type = 'friend' AND s.target_id = ?))
     ORDER BY c.sort_order, c.id`,
    ownerId, viewerId,
  );
}

/**
 * 크루 페이지에서 보이는 카테고리 목록.
 * 크루원이 그 크루에 공유하기로 선택한 카테고리 + 'public' 카테고리.
 */
export function categoriesVisibleInCrew(crewId) {
  return all(
    `${SELECT_CATEGORY}
     JOIN crew_members m ON m.user_id = c.owner_id AND m.crew_id = ?
     WHERE c.visibility = 'public'
        OR EXISTS (SELECT 1 FROM category_shares s
                   WHERE s.category_id = c.id AND s.target_type = 'crew' AND s.target_id = ?)
     ORDER BY m.joined_at, c.sort_order, c.id`,
    crewId, crewId,
  );
}

/**
 * "me" | "user:<id>" | "crew:<id>" 스코프를 해석해
 * { kind, profile, categories, writable } 를 돌려준다. 권한이 없으면 null.
 */
export function resolveScope(viewer, scope = 'me') {
  const [kind, rawId] = String(scope).split(':');
  const id = Number(rawId);

  if (kind === 'me' || (kind === 'user' && id === viewer.id)) {
    return {
      kind: 'user',
      writable: true,
      profile: toUserProfile(viewer),
      categories: categoriesVisibleToViewer(viewer.id, viewer.id),
    };
  }

  if (kind === 'user') {
    const owner = get('SELECT * FROM users WHERE id = ?', id);
    if (!owner || !areFriends(viewer.id, id)) return null;
    return {
      kind: 'user',
      writable: false,
      profile: toUserProfile(owner),
      categories: categoriesVisibleToViewer(viewer.id, id),
    };
  }

  if (kind === 'crew') {
    const crew = get('SELECT * FROM crews WHERE id = ?', id);
    if (!crew || !isCrewMember(id, viewer.id)) return null;
    return {
      kind: 'crew',
      writable: false,
      profile: toCrewProfile(crew),
      categories: categoriesVisibleInCrew(id),
    };
  }

  return null;
}

export const toUserProfile = (u) => ({
  type: 'user',
  id: u.id,
  name: u.name,
  bio: u.bio,
  handle: u.handle,
  avatarUrl: u.avatar_url,
});

export const toCrewProfile = (c) => ({
  type: 'crew',
  id: c.id,
  name: c.name,
  bio: c.bio,
  avatarUrl: c.avatar_url,
  inviteCode: c.invite_code,
  ownerId: c.owner_id,
});
