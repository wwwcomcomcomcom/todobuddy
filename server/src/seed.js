/** 개발용 데모 데이터. `npm run seed` 로 실행한다. */
import { devEmail, upsertUser } from './auth.js';
import { get, run, tx } from './db.js';

const today = new Date().toLocaleDateString('sv-SE');
const shift = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('sv-SE');
};

const me = upsertUser({ email: devEmail('하루'), name: '하루' });
const friend = upsertUser({ email: devEmail('민서'), name: '민서' });
run('UPDATE users SET bio = ? WHERE id = ?', '프로필에 자기소개를 입력해보세요', me.id);

tx(() => {
  // 친구 관계
  if (!get('SELECT 1 FROM friendships WHERE requester_id = ? AND addressee_id = ?', me.id, friend.id)) {
    run("INSERT INTO friendships (requester_id, addressee_id, status, accepted_at) VALUES (?, ?, 'accepted', datetime('now'))", me.id, friend.id);
  }

  // 크루
  let crew = get('SELECT * FROM crews WHERE name = ?', '달리기모임');
  if (!crew) {
    const info = run('INSERT INTO crews (name, bio, invite_code, owner_id) VALUES (?, ?, ?, ?)',
      '달리기모임', '같이 달리는 사람들', 'RUNNING1', me.id);
    crew = get('SELECT * FROM crews WHERE id = ?', info.lastInsertRowid);
  }
  run("INSERT OR IGNORE INTO crew_members (crew_id, user_id, role) VALUES (?, ?, 'owner')", crew.id, me.id);
  run('INSERT OR IGNORE INTO crew_members (crew_id, user_id) VALUES (?, ?)', crew.id, friend.id);

  const category = (ownerId, name, color, visibility, order) => {
    const found = get('SELECT * FROM categories WHERE owner_id = ? AND name = ?', ownerId, name);
    if (found) return found;
    const info = run('INSERT INTO categories (owner_id, name, color, visibility, sort_order) VALUES (?, ?, ?, ?, ?)',
      ownerId, name, color, visibility, order);
    return get('SELECT * FROM categories WHERE id = ?', info.lastInsertRowid);
  };

  const work = category(me.id, '회사에서 할 일', '#F08080', 'private', 0);
  const personal = category(me.id, '혼자 하는 일', '#F6C445', 'public', 1);
  const hers = category(friend.id, '민서의 하루', '#7AA2F7', 'public', 0);

  const todo = (categoryId, date, title, done, order) => {
    if (get('SELECT 1 FROM todos WHERE category_id = ? AND date = ? AND title = ?', categoryId, date, title)) return;
    run('INSERT INTO todos (category_id, date, title, done, sort_order) VALUES (?, ?, ?, ?, ?)',
      categoryId, date, title, done ? 1 : 0, order);
  };

  todo(work.id, today, '주간 보고서 쓰기', true, 0);
  ['디자인 리뷰 준비', '장보기 목록 적기', '방 정리하기', '영어 단어 외우기']
    .forEach((t, i) => todo(personal.id, today, t, false, i));
  ['러닝 30분', '책 20쪽 읽기', '물 여덟 잔'].forEach((t, i) => todo(personal.id, today, t, true, 4 + i));

  todo(work.id, shift(-3), '지난주 회고', true, 0);
  todo(personal.id, shift(-1), '어제 못한 일', false, 0);
  todo(personal.id, shift(2), '주말 계획 세우기', false, 0);
  todo(hers.id, today, '러닝 5km', true, 0);
  todo(hers.id, today, '책 30쪽', false, 1);
});

console.log(`시드 완료: ${me.name}(@${me.handle}), ${friend.name}(@${friend.handle}), 크루 달리기모임(초대코드 RUNNING1)`);
